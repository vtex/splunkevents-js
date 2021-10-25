import type { SplunkEvent, Strategy } from './strategy'
import type { DebouncedFn } from './debounce'
import debounce from './debounce'

const DEFAULT_DEBOUNCE_TIME = 2_000

export class DebounceStrategy implements Strategy {
  private pendingEvents: SplunkEvent[] = []
  private events: SplunkEvent[] = []

  private isSendingEvents = false
  private flushPending = false

  private autoRetryFlush: boolean
  private sendEvents: (events: SplunkEvent[]) => Promise<void>

  public flushEvents: DebouncedFn

  constructor({
    debounceTime = DEFAULT_DEBOUNCE_TIME,
    autoRetryFlush,
    sendEvents,
  }: {
    debounceTime?: number
    autoRetryFlush: boolean
    sendEvents: (events: SplunkEvent[]) => Promise<void>
  }) {
    this.flushEvents = debounce(this.flushImpl, debounceTime)
    this.autoRetryFlush = autoRetryFlush
    this.sendEvents = sendEvents
  }

  public abort() {
    this.flushEvents.clear()
  }

  public addEvent(event: SplunkEvent) {
    this.events.push(event)
  }

  private flushImpl = () => {
    if (this.isSendingEvents) {
      this.flushPending = true

      return
    }

    this.pendingEvents = Array.from(this.events)
    this.events = []
    this.isSendingEvents = true

    this.sendEvents(this.pendingEvents)
      .then(() => {
        this.pendingEvents = []
        this.isSendingEvents = false

        if (!this.flushPending) {
          return
        }

        this.flushPending = false

        return this.flushImpl()
      })
      .catch(() => {
        this.events = this.events.concat(this.pendingEvents)
        this.pendingEvents = []
        this.isSendingEvents = false

        if (this.autoRetryFlush) {
          this.flushEvents()
        }
      })
  }
}
