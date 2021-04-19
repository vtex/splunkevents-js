import SplunkEvents from '../splunk-events'

jest.mock('../request', () => ({
  fetchRequest: jest.fn().mockReturnValue(Promise.resolve({})),
}))

const SECOND = 1000

function flushPromises() {
  return new Promise((res) => process.nextTick(res))
}

describe('SplunkEvents', () => {
  let splunkEvents: SplunkEvents

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.restoreAllMocks()
    splunkEvents = new SplunkEvents()
  })

  afterEach(() => {
    jest.runAllTimers()
  })

  it('should initialize events', () => {
    expect(splunkEvents).toBeDefined()
    expect(
      // @ts-expect-error: events is private but we want to
      // assert on it anyway without making it public
      splunkEvents.events
    ).toStrictEqual([])
    splunkEvents.config({
      endpoint: 'endpoint',
      token: '',
    })
    expect(
      // @ts-expect-error: same as above
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

  describe('Debounce strategy', () => {
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

      await flushPromises()

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

    it('should update debounce time', async () => {
      splunkEvents.config({
        endpoint: '/splunk',
        token: 'splunk-token-123',
        debounceTime: 1 * SECOND,
      })

      const requestSpy = jest
        .spyOn(SplunkEvents.prototype, 'request')
        .mockImplementation(() => Promise.resolve(null))

      splunkEvents.logEvent('debug', 'info', 'checkout', 'add-to-cart', {
        itemId: '320',
      })

      expect(requestSpy).toHaveBeenCalledTimes(0)

      jest.advanceTimersByTime(1 * SECOND)
      await flushPromises()

      expect(requestSpy).toHaveBeenCalledTimes(1)

      splunkEvents.config({ debounceTime: 2 * SECOND })
      splunkEvents.logEvent('debug', 'info', 'checkout', 'update-item', {
        index: 0,
        quantity: 10,
      })

      jest.advanceTimersByTime(1 * SECOND)
      await flushPromises()

      expect(requestSpy).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(1 * SECOND)
      await flushPromises()

      expect(requestSpy).toHaveBeenCalledTimes(2)
    })

    it('should use configured debounce time when a request fails', async () => {
      const requestMock = jest.fn(() => Promise.resolve({} as Response))

      splunkEvents.config({
        endpoint: '/splunk',
        token: 'splunk-token-123',
        debounceTime: 2 * SECOND,
        autoRetryFlush: true,
        request: requestMock,
      })

      requestMock.mockReturnValueOnce(Promise.reject('request failed'))

      splunkEvents.logEvent('debug', 'info', 'request', 'defaultRequestImpl', {
        doesDefaultRequestWork: true,
      })

      jest.runOnlyPendingTimers()
      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(1)

      // Skip half of the debounce time
      jest.advanceTimersByTime(1 * SECOND)

      expect(requestMock).toHaveBeenCalledTimes(1)

      // Skip the remaining of the debounce time
      jest.advanceTimersByTime(1 * SECOND)

      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(2)
    })
  })

  it('should use request function passed in config', async () => {
    const request = jest.fn().mockReturnValue(Promise.resolve({}))

    splunkEvents.config({
      endpoint: '/splunk',
      token: 'splunk-token-123',
      request,
    })

    splunkEvents.logEvent('debug', 'info', 'request', 'defaultRequestImpl', {
      doesMyRequestSucceed: true,
    })

    jest.runAllTimers()
    await flushPromises()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('doesMyRequestSucceed=true'),
      })
    )
  })

  it('should default to fetchRequest in case request is not configured', async () => {
    const requestMock = jest.requireMock('../request').fetchRequest as jest.Mock

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

  it('should be able to receive config in constructor', () => {
    const mySplunkLogger = new SplunkEvents({
      endpoint: '/splunk',
      token: 'my-splunk-token-123',
    })

    const requestSpy = jest
      .spyOn(SplunkEvents.prototype, 'request')
      .mockImplementation(() => Promise.resolve(null))

    mySplunkLogger.logEvent('debug', 'info', 'checkout', 'finish-purchase', {
      orderFormId: '1234abc',
    })

    jest.runAllTimers()

    expect(requestSpy).toHaveBeenCalledTimes(1)
    expect(requestSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('orderFormId=\\"1234abc\\"'),
      })
    )
  })

  describe('Exponential backoff', () => {
    it('should correctly backoff exponentially', async () => {
      const requestMock = jest
        .fn()
        .mockReturnValue(Promise.reject('request failed'))

      splunkEvents.config({
        endpoint: '/splunk',
        token: 'splunk-token-123',
        useExponentialBackoff: true,
        request: requestMock,
      })

      splunkEvents.logEvent(
        'debug',
        'info',
        'request',
        'defaultRequestImpl',
        {}
      )

      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(1 * SECOND)
      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(2)

      jest.advanceTimersByTime(2 * SECOND)
      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(3)

      jest.advanceTimersByTime(4 * SECOND)
      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(4)
    })

    it('should accumulate events during retries', async () => {
      const requestMock = jest.fn().mockReturnValue(Promise.resolve())

      splunkEvents.config({
        endpoint: '/splunk',
        token: 'splunk-token-123',
        useExponentialBackoff: true,
        request: requestMock,
      })

      requestMock.mockReturnValueOnce(Promise.reject('request failed'))

      splunkEvents.logEvent('debug', 'info', 'request', 'requestMockImpl', {
        requestNum: 1,
      })

      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(1)

      splunkEvents.logEvent('debug', 'info', 'request', 'requestMockImpl', {
        requestNum: 2,
      })

      jest.advanceTimersByTime(1 * SECOND)
      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(2)
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.stringContaining('requestNum=1'),
        })
      )
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.stringContaining('requestNum=2'),
        })
      )
    })

    it('should discard previous events after successfull request', async () => {
      const requestMock = jest.fn().mockReturnValue(Promise.resolve())

      splunkEvents.config({
        endpoint: '/splunk',
        token: 'splunk-token-123',
        useExponentialBackoff: true,
        request: requestMock,
      })

      splunkEvents.logEvent('debug', 'info', 'request', 'requestMockImpl', {
        requestNum: 1,
      })

      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(1)
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.stringContaining('requestNum=1'),
        })
      )

      splunkEvents.logEvent('debug', 'info', 'request', 'requestMockImpl', {
        requestNum: 2,
      })

      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(2)
      expect(requestMock).not.toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.stringContaining('requestNum=1'),
        })
      )
      expect(requestMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.stringContaining('requestNum=2'),
        })
      )
    })

    it('should not drop pending events when requests succeed', async () => {
      let resolve = () => {}

      const requestMock = jest
        .fn()
        .mockReturnValue(Promise.resolve())
        .mockImplementationOnce(
          () =>
            new Promise<void>((res) => {
              resolve = res
            })
        )

      splunkEvents.config({
        endpoint: '/splunk',
        token: 'splunk-token-123',
        useExponentialBackoff: true,
        request: requestMock,
      })

      splunkEvents.logEvent('debug', 'info', 'request', 'requestMockImpl', {
        requestNum: 1,
      })

      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(1)
      expect(
        // @ts-expect-error: asserting on private property
        splunkEvents.isBackoffInProgress
      ).toBe(true)

      splunkEvents.logEvent(
        'debug',
        'info',
        'request',
        'requestInFlightTest',
        {}
      )

      resolve()

      await flushPromises()

      expect(requestMock).toHaveBeenCalledTimes(2)
      expect(requestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.stringContaining('requestInFlightTest'),
        })
      )
    })
  })
})
