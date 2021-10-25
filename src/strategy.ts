export type EventData = Record<string, string | number | boolean>

export type SplunkEvent = {
  host: string
  sourcetype: string
  time?: number
  event: EventData | string
}

export interface Strategy {
  addEvent(event: SplunkEvent): void
  flushEvents(): void
}
