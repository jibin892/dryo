import { useEffect, useState } from 'react'

type NavigateOptions = { replace?: boolean }
type DryoHistoryState = { dryoOrigin?: string }

function safeOrigin(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

export function useHistoryRouter(initialPath = '/today') {
  const [path, setPath] = useState(() => (window.location.pathname === '/' ? initialPath : window.location.pathname))

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextPath: string, options: NavigateOptions = {}) {
    if (nextPath !== window.location.pathname) {
      const state: DryoHistoryState = { dryoOrigin: path }
      if (options.replace) window.history.replaceState(state, '', nextPath)
      else window.history.pushState(state, '', nextPath)
    }
    setPath(nextPath)
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  function goBack(fallbackPath: string) {
    const origin = (window.history.state as DryoHistoryState | null)?.dryoOrigin
    if (safeOrigin(origin)) {
      window.history.back()
      return
    }
    navigate(fallbackPath, { replace: true })
  }

  return { path, navigate, goBack }
}
