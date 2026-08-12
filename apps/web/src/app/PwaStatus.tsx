import { useEffect, useState } from 'react'
import { Download, WifiOff, X } from 'lucide-react'
import './pwa-status.css'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('beforeinstallprompt', onInstall)
    }
  }, [])

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  if (!online) {
    return (
      <div className="connectivity-banner" role="status">
        <WifiOff aria-hidden="true" size={17} />
        <span><strong>Offline</strong> · Readings are cached and will sync when the estate network returns.</span>
      </div>
    )
  }

  if (installPrompt && !dismissed) {
    return (
      <div className="install-banner" role="status">
        <Download aria-hidden="true" size={18} />
        <span>Install Dryo for one-tap access on the drying floor.</span>
        <button type="button" onClick={install}>Install</button>
        <button type="button" aria-label="Dismiss install prompt" onClick={() => setDismissed(true)}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
    )
  }

  return null
}
