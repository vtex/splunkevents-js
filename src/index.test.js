import SplunkEvents from '.'

describe('Tests', () => {
  let splunkEvents

  beforeAll(() => {
    splunkEvents = new SplunkEvents()
  })

  it('Should initialize events', () => {
    expect(splunkEvents).toBeDefined()
    expect(splunkEvents.events).toBeUndefined()
    splunkEvents.config({
      endpoint: 'endpoint',
      token: '',
    })
    expect(splunkEvents.events).toStrictEqual([])
  })

  it('Should return additional info', () => {
    expect(splunkEvents.getAdditionalInfo()).toMatchObject({
      additional_info: expect.stringMatching(''),
    })
  })
})
