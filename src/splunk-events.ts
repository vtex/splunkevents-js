// debounce helper

function debounce(func: () => void, wait = 100) {
  let timeout: NodeJS.Timeout | null = null

  const debounced = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }

    timeout = setTimeout(func, wait)
  }

  debounced.clear = () => {
    if (!timeout) {
      return
    }

    clearTimeout(timeout)
    timeout = null
  }

  return debounced
}

// fetch helper

interface FetchContext extends Omit<RequestInit, 'body'> {
  url: string
  data: BodyInit
  responseType: string
}

function fetchRequest(context: FetchContext) {
  if (
    (typeof window !== 'undefined' && typeof window.fetch !== 'function') ||
    (typeof global !== 'undefined' &&
      typeof (global as any).fetch !== 'function')
  ) {
    console.log('Error, using fetchRequest without fetch object')
    return Promise.resolve(null)
  }

  return fetch(context.url, {
    ...context,
    body: context.data,
  }).then(response => {
    if (context.responseType === 'json') {
      return response.json()
    }
    return response
  })
}

// splunk class

interface Config {
  autoFlush?: boolean
  autoRetryFlush?: boolean
  debounceTime?: number
  debug?: boolean
  endpoint: string
  host?: string
  injectAdditionalInfo?: boolean
  /**
   * @deprecated Use `injectAdditionalInfo` instead
   */
  injectAditionalInfo?: boolean
  injectTimestamp?: boolean
  path?: string
  request?: (fetchContext: FetchContext) => Promise<Response>
  shouldParseEventData?: boolean
  source?: string
  token: string
}

type EventData = Record<string, string | number | boolean>

interface SplunkEvent {
  host: string
  sourcetype: string
  time?: number
  event: EventData | string
}

export default class SplunkEvents {
  private _requestImpl?: (
    fetchContext: FetchContext
  ) => Promise<Response | null>

  private autoFlush?: boolean
  private autoRetryFlush?: boolean
  private debounceTime?: number
  private debouncedFlush?: () => void
  private debug?: boolean
  private endpoint?: string
  private events: SplunkEvent[] = []
  private headers?: HeadersInit
  private host?: string
  private injectAdditionalInfo?: boolean
  private injectTimestamp?: boolean
  private isSendingEvents?: boolean
  private path?: string
  private pendingEvents: SplunkEvent[] = []
  private shouldParseEventData?: boolean
  private source?: string
  private token?: string
  private flushPending = false

  public config(config: Config) {
    this.events = this.events || []
    this.pendingEvents = this.pendingEvents || []
    this.isSendingEvents = this.isSendingEvents ?? false
    this.endpoint = config.endpoint // required
    this.token = config.token // required
    this.injectAdditionalInfo =
      config.injectAditionalInfo ?? config.injectAdditionalInfo ?? false
    this.autoFlush = config.autoFlush ?? true
    this.autoRetryFlush = config.autoRetryFlush ?? true
    this.source = config.source ?? 'log'
    this.path = config.path ?? '/services/collector/event'
    this.host = config.host ?? '-'
    this.debug = config.debug ?? false
    this.debounceTime = config.debounceTime ?? this.debounceTime ?? 2000
    this.debouncedFlush =
      this.debouncedFlush ?? debounce(this.flush, this.debounceTime)
    this._requestImpl = config.request ?? this.request ?? fetchRequest
    this.injectTimestamp = config.injectTimestamp ?? false
    this.shouldParseEventData = config.shouldParseEventData ?? true
    this.headers = {
      Authorization: `Splunk ${this.token}`,
    }
  }

  public logEvent = (
    level: string,
    type: string,
    workflowType: string,
    workflowInstance: string,
    eventData?: EventData | null,
    account = ''
  ) => {
    this.validateEvent(eventData)

    const eventObj = {
      level,
      type,
      workflowType,
      workflowInstance,
      account,
      ...eventData,
      ...(this.injectAdditionalInfo ? this.getAdditionalInfo() : {}),
    }
    const event = this.shouldParseEventData
      ? this.parseEventData(eventObj)
      : eventObj

    const data = {
      sourcetype: this.source!,
      host: this.host!,
      ...(this.injectTimestamp && { time: +new Date() }),
      event,
    }

    this.events.push(data)

    if (this.autoFlush) {
      this.debouncedFlush?.()
    }
  }

  public request(fetchContext: FetchContext) {
    return this._requestImpl!(fetchContext)
  }

  private parseEventData(event: EventData) {
    let parsedEvent = ''
    for (const key in event) {
      if (
        Object.prototype.hasOwnProperty.call(event, key) &&
        event[key] != null
      ) {
        const value = event[key]

        switch (typeof value) {
          case 'string':
            parsedEvent += `${key}="${value.replace(/"/g, '')}" `
            break
          case 'boolean':
          case 'number':
            parsedEvent += `${key}=${value} `
            break
          default:
            throw new Error('Event property must be string, number or boolean')
        }
      }
    }
    return parsedEvent
  }

  private validateEvent(event?: EventData | null): asserts event is EventData {
    if (event === null) {
      throw new Error('Event must not be null')
    }

    if (event === undefined) {
      throw new Error('Event must not be undefined')
    }

    if (typeof event !== 'object') {
      throw new Error('Event must be an object')
    }
  }

  public getAdditionalInfo() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return ''
    }
    const { screen, location } = window

    const additionalInfo =
      `${navigator.userAgent.replace(/,/g, ';')},` +
      `${(navigator as any).browserLanguage || navigator.language},` +
      `${navigator.platform},${screen.availWidth || '-'},${
        screen.availHeight || '-'
      },${location.hostname},` +
      `${location.pathname},${location.protocol.replace(':', '')},${
        location.hash || '-'
      }`

    return {
      additional_info: additionalInfo,
    }
  }

  public flush = () => {
    if (this.isSendingEvents) {
      this.flushPending = true
      return
    }

    this.validateConfig()

    this.pendingEvents = Array.from(this.events)
    this.events = []
    this.isSendingEvents = true

    if (this.debug) {
      console.log(`sending ${this.pendingEvents.length} events to splunk`)
    }

    if (this.pendingEvents.length === 0) {
      return
    }

    const splunkBatchedFormattedEvents = this.formatEventsForSplunkBatch(
      this.pendingEvents
    )

    this.request({
      url: `${this.endpoint}${this.path}`,
      method: 'POST',
      data: splunkBatchedFormattedEvents,
      headers: this.headers ?? {},
      responseType: 'json',
    })
      .then(() => {
        if (this.debug) {
          console.log(
            `${this.pendingEvents.length} events successfuly sent to splunk`
          )
        }
        this.pendingEvents = []
        this.isSendingEvents = false

        if (this.flushPending) {
          this.flushPending = false
          return this.flush()
        }
      })
      .catch(e => {
        this.events = this.events.concat(this.pendingEvents)
        this.pendingEvents = []
        this.isSendingEvents = false

        if (this.autoRetryFlush) {
          if (this.debug) {
            console.warn(
              'Error sending events to splunk. Retrying in 5 seconds.',
              e
            )
          }
          this.debouncedFlush?.()
        } else if (this.debug) {
          console.warn('Error sending events to splunk.', e)
        }
      })
  }

  private formatEventsForSplunkBatch(events: SplunkEvent[]) {
    let splunkBatchedFormattedEvents = ''

    for (let i = 0; i < events.length; i++) {
      splunkBatchedFormattedEvents += `\n${JSON.stringify(events[i])}\n`
    }

    return splunkBatchedFormattedEvents
  }

  private validateConfig() {
    if (this.token === null) {
      throw new Error('Token must not be null')
    }

    if (this.token === undefined) {
      throw new Error('Token must not be undefined')
    }

    if (this.endpoint === null) {
      throw new Error('endpoint must not be null')
    }

    if (this.endpoint === undefined) {
      throw new Error('endpoint must not be undefined')
    }
  }
}
