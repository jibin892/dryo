import { useEffect, useState, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import './phone-orientation.css'

const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 600px) and (pointer: coarse)'

export function PhonePortraitOnly({ children }: { children: ReactNode }) {
  const [landscapePhone, setLandscapePhone] = useState(() => window.matchMedia?.(PHONE_LANDSCAPE_QUERY).matches ?? false)

  useEffect(() => {
    const query = window.matchMedia?.(PHONE_LANDSCAPE_QUERY)
    if (!query) return
    const update = () => setLandscapePhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  if (landscapePhone) {
    return (
      <main className="phone-orientation-screen" role="dialog" aria-modal="true" aria-labelledby="phone-orientation-title">
        <span><RotateCcw aria-hidden="true" size={34} strokeWidth={1.5} /></span>
        <p className="eyebrow">Portrait mode</p>
        <h1 id="phone-orientation-title">Rotate your device.</h1>
        <p>Dryo is designed for portrait use on phones out on the drying floor. Tablets can continue in portrait or landscape.</p>
      </main>
    )
  }

  return children
}
