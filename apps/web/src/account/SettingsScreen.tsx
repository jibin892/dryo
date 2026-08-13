import { useEffect, useState } from 'react'
import type { HouseSettings } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, ScreenHeading, StatusBanner } from '../shared/ui/components'
import '../business/business.css'

export function SettingsScreen() {
  const [houseName, setHouseName] = useState('')
  const [curing, setCuring] = useState('')
  const [gst, setGst] = useState('')
  const [banner, setBanner] = useState<{ tone: 'positive' | 'warning'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dryoApi
      .getSettings()
      .then((s: HouseSettings) => { setHouseName(s.houseName); setCuring(String(s.defaultCuringRatePerKg)); setGst(s.gstNumber) })
      .catch((err) => setBanner({ tone: 'warning', text: err instanceof ApiError && err.status === 0 ? 'Start the Dryo API to manage settings.' : 'Could not load settings.' }))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setBusy(true)
    setBanner(null)
    try {
      const s = await dryoApi.updateSettings({ houseName: houseName.trim(), defaultCuringRatePerKg: Number(curing) || 0, gstNumber: gst.trim() })
      setHouseName(s.houseName)
      setCuring(String(s.defaultCuringRatePerKg))
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
      <ScreenHeading eyebrow="Business" title="Settings" description="Your curing house profile and defaults." />
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}
      {loading ? (
        <div className="empty-state"><p>Loading settings…</p></div>
      ) : (
        <div className="card biz-form">
          <label className="field" style={{ gap: 6 }}><small>House name</small><input className="biz-input" value={houseName} onChange={(e) => setHouseName(e.target.value)} /></label>
          <label className="field" style={{ gap: 6 }}><small>Default curing rate ₹/kg</small><input className="biz-input" value={curing} onChange={(e) => setCuring(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" /></label>
          <label className="field" style={{ gap: 6 }}><small>GST number</small><input className="biz-input" value={gst} onChange={(e) => setGst(e.target.value)} /></label>
          <Button onClick={save} disabled={busy || houseName.trim().length < 2}>{busy ? 'Saving…' : 'Save settings'}</Button>
        </div>
      )}
    </>
  )
}
