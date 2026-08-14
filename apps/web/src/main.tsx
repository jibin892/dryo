import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { PhonePortraitOnly } from './app/PhonePortraitOnly'
import './shared/styles/global.css'
import './shared/styles/screens.css'

// The bundle executed — tell the index.html boot watchdog to stand down.
declare global {
  interface Window { __dryoBooted?: boolean }
}
window.__dryoBooted = true

// Drop the service worker + all caches, then hard-reload. Recovers from a stale
// cached shell after a deploy without leaving the user on a blank screen.
async function selfHeal() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } finally {
    location.reload()
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    // Auto-heal once per session (a stale build is the common cause); if it
    // recurs, fall through to the manual reload button below.
    if (!sessionStorage.getItem('dryo-boundary-healed')) {
      sessionStorage.setItem('dryo-boundary-healed', '1')
      void selfHeal()
    }
  }
  render() {
    if (this.state.failed) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#173b3d', background: '#fef9ef' }}>
          <div>
            <p style={{ fontSize: 18, marginBottom: 12 }}>Something went wrong loading Dryo.</p>
            <button
              type="button"
              onClick={() => void selfHeal()}
              style={{ minHeight: 48, padding: '0 24px', borderRadius: 999, border: 0, background: '#173b3d', color: '#fff', fontSize: 16 }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <PhonePortraitOnly><App /></PhonePortraitOnly>
    </ErrorBoundary>
  </StrictMode>,
)
