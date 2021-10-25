export interface DebouncedFn {
  (): void
  clear(): void
}

export default function debounce<T>(
  func: (...args: T[]) => void | Promise<void>,
  wait = 100
): DebouncedFn {
  let timeout: NodeJS.Timeout | null = null
  let cancel: (() => void) | null = null

  const debounced = (...args: T[]) => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }

    return new Promise<void>((res, rej) => {
      cancel = rej

      timeout = setTimeout(() => {
        const maybePromise = func(...args)

        if (maybePromise != null) {
          maybePromise.then(res).catch(rej)
        }
      }, wait)
    })
  }

  debounced.clear = () => {
    if (!timeout) {
      return
    }

    clearTimeout(timeout)
    cancel?.()

    timeout = null
  }

  return debounced
}
