import SplunkEvents from '../splunk-events'
import { fetchRequest } from '../request'

const SECOND = 1000

jest.mock('../request', () => ({
  fetchRequest: jest.fn(() => Promise.resolve({} as Response)),
}))

describe('SplunkEvents', () => {
  let splunkEvents: SplunkEvents

  beforeEach(() => {
    jest.useFakeTimers()
    splunkEvents = new SplunkEvents()
  })

  afterEach(() => {
    jest.runAllTimers()
    jest.restoreAllMocks()
  })

  it('should initialize events', () => {
    expect(splunkEvents).toBeDefined()
    expect(
      // @ts-ignore
      splunkEvents.events
    ).toStrictEqual([])
    splunkEvents.config({
      endpoint: 'endpoint',
      token: '',
    })
    expect(
      // @ts-ignore
      splunkEvents.events
    ).toStrictEqual([])
  })

  it('should return additional info', () => {
    expect(splunkEvents.getAdditionalInfo()).toMatchObject({
      additional_info: expect.stringMatching(''),
    })
  })

  it('should be configured correctly using deprecated injectAditionalInfo param', () => {
    splunkEvents.config({
      endpoint: '/splunk',
      token: 'splunk-token-123',
      injectAditionalInfo: true,
      autoFlush: true,
      debounceTime: 2 * SECOND,
    })

    const requestSpy = jest
      .spyOn(splunkEvents, 'request')
      .mockImplementation(() => Promise.resolve(null))

    splunkEvents.logEvent('Debug', 'Info', 'checkout', 'checkout-cart', {
      myEventData: 'hello',
    })

    jest.runAllTimers()

    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('additional_info='),
      })
    )
  })

  it('should be able to validate null and undefined events', () => {
    splunkEvents.config({ endpoint: '/splunk', token: 'splunk-token-123' })

    expect(() =>
      splunkEvents.logEvent('debug', 'error', 'checkout', 'checkout-cart', null)
    ).toThrowError('Event must not be null')
    expect(() =>
      splunkEvents.logEvent(
        'debug',
        'error',
        'checkout',
        'checkout-cart',
        undefined
      )
    ).toThrowError('Event must not be undefined')
  })

  it('should only make one request if called in timeout range', async () => {
    splunkEvents.config({
      endpoint: '/splunk',
      token: 'splunk-token-123',
      autoFlush: true,
      debounceTime: 10 * SECOND,
    })

    const requestSpy = jest
      .spyOn(SplunkEvents.prototype, 'request')
      .mockImplementation(() => Promise.resolve(null))

    splunkEvents.logEvent('debug', 'info', 'checkout', 'checkout-cart', {
      description: 'User accessed cart page',
    })

    // advance to half the time of the timeout delay
    jest.advanceTimersByTime(5 * SECOND)

    splunkEvents.logEvent('debug', 'info', 'checkout', 'checkout-profile', {
      description: 'User accessed profile step',
    })

    // wait for timeout to end
    jest.runAllTimers()

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(requestSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('workflowInstance=\\"checkout-cart\\"'),
      })
    )
    expect(requestSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.stringContaining(
          'workflowInstance=\\"checkout-profile\\"'
        ),
      })
    )

    // flush pending promises
    await new Promise(resolve => resolve())

    // this should be enqueued for 10 seconds from now
    splunkEvents.logEvent('debug', 'info', 'checkout', 'checkout-payment', {
      description: 'User accessed payment step',
    })

    jest.advanceTimersByTime(5 * SECOND)

    expect(requestSpy).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(5 * SECOND)

    expect(requestSpy).toHaveBeenCalledTimes(2)
    expect(requestSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.stringContaining(
          'workflowInstance=\\"checkout-payment\\"'
        ),
      })
    )
  })

  it('should use request function passed in config', () => {
    const request = jest.fn(() => Promise.resolve({} as Response))

    splunkEvents.config({
      endpoint: '/splunk',
      token: 'splunk-token-123',
      request,
    })

    splunkEvents.logEvent('debug', 'info', 'request', 'defaultRequestImpl', {
      doesMyRequestSucceed: true,
    })

    jest.runAllTimers()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('doesMyRequestSucceed=true'),
      })
    )
  })

  it('should default to fetchRequest in case request is not configured', () => {
    const requestMock = fetchRequest as jest.Mock

    splunkEvents.config({
      endpoint: '/splunk',
      token: 'splunk-token-123',
    })

    splunkEvents.logEvent('debug', 'info', 'request', 'defaultRequestImpl', {
      doesDefaultRequestWork: true,
    })

    jest.runAllTimers()

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('doesDefaultRequestWork=true'),
      })
    )
  })
})
