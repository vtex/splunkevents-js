export default function debounce(func: () => void, wait = 100) {
  let timeout: NodeJS.Timeout | null = null

  const debounced = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }

    timeout = setTimeout(func, wait)
  }

  debounced.clear = () => {
    if (!timeout) {
      return
    }

    clearTimeout(timeout)
    timeout = null
  }

  return debounced
}
