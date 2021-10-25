import type { Strategy, SplunkEvent } from './strategy'

const DEFAULT_EXPONENTIAL_BACKOFF_LIMIT = 60_000

export class ExponentialBackoffStrategy implements Strategy {
  private isBackoffInProgress = false
  private maxNumberOfRetries = Infinity

  private events: SplunkEvent[] = []
  private pendingEvents: SplunkEvent[] = []
  private exponentialBackoffLimit: number

  private sendEvents: (events: SplunkEvent[]) => Promise<void>

  constructor({
    sendEvents,
    exponentialBackoffLimit = DEFAULT_EXPONENTIAL_BACKOFF_LIMIT,
    maxNumberOfRetries,
  }: {
    sendEvents: (events: SplunkEvent[]) => Promise<void>
    exponentialBackoffLimit?: number
    maxNumberOfRetries?: number
  }) {
    this.sendEvents = sendEvents
    this.exponentialBackoffLimit = exponentialBackoffLimit
    this.maxNumberOfRetries = maxNumberOfRetries ?? this.maxNumberOfRetries
  }

  public addEvent(event: SplunkEvent) {
    this.events.push(event)
  }

  public flushEvents(): Promise<void> {
    if (this.isBackoffInProgress) {
      return Promise.resolve()
    }

    this.isBackoffInProgress = true

    const backoffMultiplier = 2

    const executeFlush = (depth = 0): Promise<void> => {
      this.pendingEvents = this.pendingEvents.concat(this.events)

      this.events = []

      return this.sendEvents(this.pendingEvents)
        .then(() => {
          this.pendingEvents = []
          this.isBackoffInProgress = false

          if (this.events.length > 0) {
            return this.flushEvents()
          }

          return Promise.resolve()
        })
        .catch(() => {
          const waitTime = backoffMultiplier ** depth * 1_000

          if (depth > this.maxNumberOfRetries) {
            this.events = []
            this.isBackoffInProgress = false

            return
          }

          return new Promise((resolve, reject) => {
            setTimeout(() => {
              executeFlush(depth + 1)
                .then(resolve, reject)
                .catch(reject)
            }, Math.min(waitTime, this.exponentialBackoffLimit))
          })
        })
    }

    return executeFlush()
  }
}
