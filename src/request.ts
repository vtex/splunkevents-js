export interface FetchContext extends Omit<RequestInit, 'body'> {
  url: string
  data: BodyInit
  responseType: string
}

export function fetchRequest(context: FetchContext) {
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
  }).then((response) => {
    if (context.responseType === 'json') {
      return response.json()
    }

    return response
  })
}
