import { useEffect, useState } from 'react'

export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** The small-viewport layout (the 390px mobile screens). Matches the CSS breakpoint. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
