import debounce from './debounce'
import { FetchContext, fetchRequest } from './request'

export { FetchContext }

export interface Config {
  /**
   * Whether or not to automatically flush batched events
   * after calling {@link SplunkEvent#logEvent}.
   *
   * Turned on by default. This option will also be turned
   * on when using `useExponentialBackoff`, regardless of the
   * value passed the the configuration.
   */
  autoFlush?: boolean
  /**
   * Whether or not to automatically retry failed flushes.
   */
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
  /**
   * Custom headers to be added in the request
   */
  headers?: HeadersInit
  /**
   * Configures the {@link SplunkEvent#flush} method to use an
   * exponential backoff algorithm instead of a fixed debounce time.
   *
   * Turned off by default.
   */
  useExponentialBackoff?: boolean
  /**
   * Maximum time, in milliseconds, to use for the exponential backoff
   * algorithm.
   *
   * The default limit is 60_000 milliseconds.
   */
  exponentialBackoffLimit?: number
  /**
   * Maximum number of retries of failed requests before dropping the events.
   */
  maxNumberOfRetries?: number
}

type EventData = Record<string, string | number | boolean>

interface SplunkEvent {
  host: string
  sourcetype: string
  time?: number
  event: EventData | string
}

const DEFAULT_EXPONENTIAL_BACKOFF_LIMIT = 60_000
const DEFAULT_DEBOUNCE_TIME = 2_000

export default class SplunkEvents {
  private _requestImpl: (
    fetchContext: FetchContext
  ) => Promise<Response | null> = fetchRequest

  private autoFlush = true
  private autoRetryFlush = true
  private debounceTime = DEFAULT_DEBOUNCE_TIME
  private debouncedFlush: () => Promise<void>
  private debug = false
  private endpoint?: string
  private events: SplunkEvent[] = []
  private headers?: HeadersInit
  private host = '-'
  private injectAdditionalInfo = false
  private injectTimestamp = false
  private isSendingEvents = false
  private path = '/services/collector/event'
  private pendingEvents: SplunkEvent[] = []
  private shouldParseEventData = true
  private source = 'log'
  private token?: string
  private flushPending = false
  private useExponentialBackoff = false
  private exponentialBackoffLimit = DEFAULT_EXPONENTIAL_BACKOFF_LIMIT
  private isBackoffInProgress = false
  private maxNumberOfRetries = Infinity

  constructor(config?: Config) {
    this.debouncedFlush = debounce(this._debouncedFlush, this.debounceTime)

    if (config) {
      this.config(config)
    }
  }

  /**
   * Configure (or reconfigure) this Splunk Event instance.
   */
  public config(config: Partial<Config>) {
    this.endpoint = config?.endpoint // required
    this.token = config?.token // required
    this.injectAdditionalInfo =
      config?.injectAditionalInfo ??
      config?.injectAdditionalInfo ??
      this.injectAdditionalInfo
    this.useExponentialBackoff =
      config?.useExponentialBackoff ?? this.useExponentialBackoff
    this.exponentialBackoffLimit =
      config?.exponentialBackoffLimit ?? this.exponentialBackoffLimit
    this.autoFlush = this.useExponentialBackoff
      ? // should always be true when using exponential backoff strategy
        true
      : config?.autoFlush ?? this.autoFlush
    this.autoRetryFlush = config?.autoRetryFlush ?? this.autoRetryFlush
    this.source = config?.source ?? this.source
    this.path = config?.path ?? this.path
    this.host = config?.host ?? this.host
    this.debug = config?.debug ?? this.debug

    const prevDebounceTime = this.debounceTime

    this.debounceTime = config?.debounceTime ?? this.debounceTime
    this.debouncedFlush =
      this.debounceTime !== prevDebounceTime
        ? debounce(this._debouncedFlush, this.debounceTime)
        : this.debouncedFlush

    this._requestImpl = config?.request ?? this._requestImpl
    this.injectTimestamp = config?.injectTimestamp ?? this.injectTimestamp
    this.shouldParseEventData =
      config?.shouldParseEventData ?? this.shouldParseEventData
    this.maxNumberOfRetries =
      config?.maxNumberOfRetries ?? this.maxNumberOfRetries
    this.headers = {
      Authorization: `Splunk ${this.token}`,
      'Content-Type': 'application/json',
      ...(config?.headers ?? {}),
    }
  }

  public backoffFlush = () => {
    this.isBackoffInProgress = true

    const backoffMultiplier = 2

    const executeFlush = (depth = 0) => {
      return this.flush()
        .then(() => {
          this.isBackoffInProgress = false
        })
        .catch(() => {
          const waitTime = backoffMultiplier ** depth * 1_000

          if (waitTime > this.exponentialBackoffLimit) {
            this.events = []
            this.isBackoffInProgress = false

            return
          }

          return new Promise((resolve, reject) => {
            setTimeout(() => {
              executeFlush(depth + 1).then(resolve, reject)
            }, Math.min(waitTime, this.exponentialBackoffLimit))
          })
        })
    }

    return executeFlush()
  }

  /**
   * Internal flush that contains the logic for debouncing or
   * backing off exponentially.
   */
  private flushEvents = () => {
    if (this.useExponentialBackoff) {
      if (this.isBackoffInProgress) {
        return
      }

      this.backoffFlush()
    } else {
      this.debouncedFlush?.()
    }
  }

  /**
   * Logs an event to Splunk.
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
   * that happened in the Cart page of Checkout for example.
   * @argument eventData Any custom event data you may find useful to log
   * together that can provide more information.
   * @argument account In multi-tenant environment it can be useful to know
   * the exact account this event is happening in.
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
      sourcetype: this.source,
      host: this.host,
      ...(this.injectTimestamp && { time: +new Date() }),
      event,
    }

    this.events.push(data)

    if (this.autoFlush) {
      this.flushEvents()
    }
  }

  /**
   * Exposes the implementation for the request function
   * used to send the events to the Splunk API.
   */
  public request(fetchContext: FetchContext) {
    return this._requestImpl(fetchContext)
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

          // eslint-disable-next-line no-fallthrough
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
  public flush = (): Promise<void> => {
    if (this.isSendingEvents) {
      this.flushPending = true

      return Promise.resolve()
    }

    this.validateConfig()

    this.pendingEvents = Array.from(this.events)
    this.events = []
    this.isSendingEvents = true

    if (this.debug) {
      console.log(`sending ${this.pendingEvents.length} events to splunk`)
    }

    if (this.pendingEvents.length === 0) {
      return Promise.resolve()
    }

    const splunkBatchedFormattedEvents = this.formatEventsForSplunkBatch(
      this.pendingEvents
    )

    return this.request({
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

        if (!this.flushPending) {
          return
        }

        this.flushPending = false

        return this.flush()
      })
      .catch((e) => {
        this.events = this.events.concat(this.pendingEvents)
        this.pendingEvents = []
        this.isSendingEvents = false

        if (this.useExponentialBackoff) {
          throw e
        }

        if (this.autoRetryFlush) {
          if (this.debug) {
            console.warn(
              `Error sending events to splunk. Retrying in ${
                (this.debounceTime ?? 0) / 1000
              } seconds.`,
              e
            )
          }

          this.flushEvents()
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
