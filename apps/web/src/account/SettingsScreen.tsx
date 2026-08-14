import { useEffect, useState } from 'react'
import type { HouseSettings } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, ScreenHeading, StatusBanner } from '../shared/ui/components'
import '../business/business.css'

export function SettingsScreen() {
  const [settings, setSettings] = useState<HouseSettings | null>(null)
  const [houseName, setHouseName] = useState('')
  const [gst, setGst] = useState('')
  const [banner, setBanner] = useState<{ tone: 'positive' | 'warning'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dryoApi
      .getSettings()
      .then((s: HouseSettings) => { setSettings(s); setHouseName(s.houseName); setGst(s.gstNumber) })
      .catch((err) => setBanner({ tone: 'warning', text: err instanceof ApiError && err.status === 0 ? 'Start the Dryo API to manage settings.' : 'Could not load settings.' }))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!settings) return
    setBusy(true)
    setBanner(null)
    try {
      // Spread the loaded settings so the pricing rates (edited on Pricing → Rates) are preserved.
      const s = await dryoApi.updateSettings({ ...settings, houseName: houseName.trim(), gstNumber: gst.trim() })
      setSettings(s)
      setHouseName(s.houseName)
      setGst(s.gstNumber)
      setBanner({ tone: 'positive', text: 'Saved.' })
      setTimeout(() => setBanner(null), 2000)
    } catch (err) {
      setBanner({ tone: 'warning', text: err instanceof ApiError && err.status === 0 ? 'Cannot reach the Dryo API — is the Go server running?' : 'Could not save settings.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ScreenHeading eyebrow="Business" title="Settings" description="Your curing house profile. Curing & purchase rates live on Pricing → Rates." />
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}
      {loading ? (
        <div className="empty-state"><p>Loading settings…</p></div>
      ) : (
        <div className="card biz-form">
          <label className="field" style={{ gap: 6 }}><small>House name</small><input className="biz-input" value={houseName} onChange={(e) => setHouseName(e.target.value)} /></label>
          <label className="field" style={{ gap: 6 }}><small>GST number</small><input className="biz-input" value={gst} onChange={(e) => setGst(e.target.value)} /></label>
          <Button onClick={save} disabled={busy || houseName.trim().length < 2}>{busy ? 'Saving…' : 'Save settings'}</Button>
        </div>
      )}
    </>
  )
}
