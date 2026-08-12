import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Tag } from 'lucide-react'
import type { Grade, GradePrice } from '../shared/contracts'
import { GRADE_LABEL } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, ScreenHeading, StatusBanner } from '../shared/ui/components'
import './business.css'

const gradeLabel = (g: string) => GRADE_LABEL[g as Grade] ?? g

type Draft = { sell: string; cost: string; yieldPct: string }
const toDraft = (p: GradePrice): Draft => ({
  sell: String(p.sellRatePerKg),
  cost: String(p.costRatePerKg),
  yieldPct: String(Math.round(p.yieldRatio * 100)),
})

export function PricingScreen({ canEdit }: { canEdit: boolean }) {
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const [banner, setBanner] = useState<{ tone: 'positive' | 'warning'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [nw, setNw] = useState({ code: '', sell: '', cost: '', yieldPct: '20' })

  async function refresh() {
    try {
      const p = await dryoApi.listPricing()
      setPrices(p)
      setDraft(Object.fromEntries(p.map((x) => [x.grade, toDraft(x)])))
    } catch (err) {
      setBanner({ tone: 'warning', text: err instanceof ApiError && err.status === 0 ? 'Start the Dryo API to manage pricing.' : 'Could not load pricing.' })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])

  const dirty = useMemo(
    () => prices.filter((p) => {
      const d = draft[p.grade]
      if (!d) return false
      return Number(d.sell) !== p.sellRatePerKg || Number(d.cost) !== p.costRatePerKg || Number(d.yieldPct) !== Math.round(p.yieldRatio * 100)
    }),
    [prices, draft],
  )

  function set(grade: string, key: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [grade]: { ...d[grade], [key]: value.replace(/[^\d.]/g, '') } }))
  }

  async function saveAll() {
    setSaving(true)
    setBanner(null)
    try {
      await Promise.all(dirty.map((p) => {
        const d = draft[p.grade]
        return dryoApi.upsertPrice(p.grade, { sellRatePerKg: Number(d.sell) || 0, costRatePerKg: Number(d.cost) || 0, yieldRatio: (Number(d.yieldPct) || 20) / 100 })
      }))
      await refresh()
      setBanner({ tone: 'positive', text: `Saved ${dirty.length} grade${dirty.length > 1 ? 's' : ''}.` })
      setTimeout(() => setBanner(null), 2500)
    } catch (err) {
      const text = err instanceof ApiError
        ? (err.status === 0 ? 'Cannot reach the Dryo API — is the Go server running?' : `Save failed: ${err.message}`)
        : 'Could not save prices.'
      setBanner({ tone: 'warning', text })
    } finally {
      setSaving(false)
    }
  }

  async function addGrade(e: FormEvent) {
    e.preventDefault()
    const code = nw.code.trim().toUpperCase()
    if (code.length < 2) return
    try {
      await dryoApi.upsertPrice(code, { sellRatePerKg: Number(nw.sell) || 0, costRatePerKg: Number(nw.cost) || 0, yieldRatio: (Number(nw.yieldPct) || 20) / 100 })
      setNw({ code: '', sell: '', cost: '', yieldPct: '20' })
      setAdding(false)
      await refresh()
      setBanner({ tone: 'positive', text: `Added ${code}.` })
      setTimeout(() => setBanner(null), 2000)
    } catch (err) {
      setBanner({ tone: 'warning', text: err instanceof ApiError && err.status === 0 ? 'Cannot reach the Dryo API — is the Go server running?' : 'Could not add grade.' })
    }
  }

  return (
    <>
      <ScreenHeading eyebrow="Grades & pricing" title="Pricing" description="Each grade holds its sell price, cost, and green→dried yield — used everywhere automatically." />
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}
      {!canEdit && <StatusBanner>Only owners and managers can change grades.</StatusBanner>}

      <div className="section-header">
        <h2>Grades</h2>
        {canEdit && (
          <button className="chip" type="button" onClick={() => setAdding((v) => !v)}>
            <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New grade
          </button>
        )}
      </div>

      {adding && canEdit && (
        <form className="card biz-form" onSubmit={addGrade}>
          <input className="biz-input" placeholder="Grade code (e.g. AGB-1 or SPECIAL)" value={nw.code} onChange={(e) => setNw((n) => ({ ...n, code: e.target.value }))} />
          <div className="price-fields">
            <label>Sell ₹/kg<input className="price-row-input" inputMode="decimal" value={nw.sell} onChange={(e) => setNw((n) => ({ ...n, sell: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
            <label>Cost ₹/kg<input className="price-row-input" inputMode="decimal" value={nw.cost} onChange={(e) => setNw((n) => ({ ...n, cost: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
            <label>Yield %<input className="price-row-input" inputMode="decimal" value={nw.yieldPct} onChange={(e) => setNw((n) => ({ ...n, yieldPct: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
          </div>
          <Button type="submit" disabled={nw.code.trim().length < 2}>Add grade</Button>
        </form>
      )}

      {loading && <div className="empty-state"><p>Loading grades…</p></div>}
      {prices.map((p) => {
        const d = draft[p.grade]
        if (!d) return null
        return (
          <div key={p.grade} className="card">
            <div className="inv-row-head" style={{ marginBottom: 4 }}>
              <p className="list-row-title"><Tag size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{gradeLabel(p.grade)}</p>
              <span className="detail-sub">margin ₹{Math.round((Number(d.sell) || 0) - (Number(d.cost) || 0)).toLocaleString('en-IN')}/kg</span>
            </div>
            <div className="price-fields">
              <label>Sell ₹/kg<input className="price-row-input" disabled={!canEdit} inputMode="decimal" value={d.sell} onChange={(e) => set(p.grade, 'sell', e.target.value)} /></label>
              <label>Cost ₹/kg<input className="price-row-input" disabled={!canEdit} inputMode="decimal" value={d.cost} onChange={(e) => set(p.grade, 'cost', e.target.value)} /></label>
              <label>Yield %<input className="price-row-input" disabled={!canEdit} inputMode="decimal" value={d.yieldPct} onChange={(e) => set(p.grade, 'yieldPct', e.target.value)} /></label>
            </div>
          </div>
        )
      })}

      {canEdit && (
        <div className="sticky-action">
          <Button onClick={saveAll} disabled={dirty.length === 0 || saving}>
            {saving ? 'Saving…' : dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? 's' : ''}` : 'Saved'}
          </Button>
        </div>
      )}
    </>
  )
}
