import debounce from './debounce'
import { FetchContext, fetchRequest } from './request'

export { FetchContext }

export interface Config {
  /**
   * Whether or not to automatically flush batched events
   * after calling {@link SplunkEvent#logEvent}
   */
  autoFlush?: boolean
  autoRetryFlush?: boolean
  /**
   * Timeout used to batch events together in one single request.
   */
  debounceTime?: number
  /**
   * Wether or not to enable debugging of the {@link SplunkEvent} class
   * itself.
   */
  debug?: boolean
  /**
   * Endpoint of your Splunk server.
   */
  endpoint: string
  /**
   * Host of your Splunk server.
   */
  host?: string
  /**
   * Whether or not to inject additional information about the user's
   * device and browser in the Splunk event.
   */
  injectAdditionalInfo?: boolean
  /**
   * @deprecated Use `injectAdditionalInfo` instead
   */
  injectAditionalInfo?: boolean
  /**
   * Whether or not to automatically add the timestamp to the Splunk event.
   */
  injectTimestamp?: boolean
  /**
   * Path of the Splunk server endpoint.
   */
  path?: string
  /**
   * Custom request function to use in environments where {@link window.fetch}
   * is not available.
   */
  request?: (fetchContext: FetchContext) => Promise<Response>
  /**
   * Whether or not to parse the event data in {@link SplunkEvent#logEvent}.
   */
  shouldParseEventData?: boolean
  /**
   * Source of the Splunk event.
   */
  source?: string
  /**
   * Token used to authenticate with the Splunk server.
   */
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

  /**
   * Configure (or reconfigure) this Splunk Event instance.
   */
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
    this._requestImpl = config.request ?? this._requestImpl ?? fetchRequest
    this.injectTimestamp = config.injectTimestamp ?? false
    this.shouldParseEventData = config.shouldParseEventData ?? true
    this.headers = {
      Authorization: `Splunk ${this.token}`,
    }
  }

  /**
   * Logs a event to Splunk.
   *
   * This method will send the data to the Splunk endpoint configured
   * in the {@link SplunkEvent#config} method. For now, you can only
   * send primitive types such as string, numbers and booleans in the
   * event data object.
   *
   * @argument level Level of criticity of this log, use values such as
   * "Critical", "Important" or "Debug"
   * @argument type Type of this log, use values such as "Error", "Warn"
   * or "Info"
   * @argument workflowType Type of this "workflow", you can use something
   * related to your application domain, such as "checkout" for events happening
   * in the Checkout page.
   * @argument workflowInstance A more fine-grained level of information
   * regarding the workflow, use values such as "checkout-cart" for events
   * that happened in the Cart page of Checkout.
   * @argument eventData Any custom event data you may find useful to log
   * together that can provide more information in case of debugging.
   * @argument account In multi-tenant environment it can be useful to know
   * the exact account this event is happnening in, to ease the debugging.
   */
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

  /**
   * Exposes the implementation for the request function
   * used to send the events to the Splunk API.
   */
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

  /**
   * Flushes pending events into one single request.
   *
   * You won't need to use this function unless you configured
   * this instance to not auto flush the events.
   */
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
