import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Sparkles, Tag, Trash2 } from 'lucide-react'
import type { GradePrice, ServiceAddon } from '../shared/contracts'
import { gradeLabel } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, ScreenHeading, StatusBanner } from '../shared/ui/components'
import { BottomSheet } from '../shared/ui/BottomSheet'
import './business.css'

type Tab = 'Grades' | 'Add-ons'
type Banner = { tone: 'positive' | 'warning'; text: string } | null

function apiErrText(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.status === 0 ? 'Cannot reach the Dryo API — is the Go server running?' : `${fallback}: ${err.message}`
  return fallback
}

export function PricingScreen({ canEdit }: { canEdit: boolean }) {
  const [tab, setTab] = useState<Tab>('Grades')
  return (
    <>
      <ScreenHeading eyebrow="Grades & pricing" title="Pricing" description="Grades hold sell price, cost and yield. Add-ons are paid services (like grading) priced per kg or flat." />
      {!canEdit && <StatusBanner>Only owners and managers can change pricing.</StatusBanner>}
      <div className="chip-row" role="tablist" aria-label="Pricing sections">
        {(['Grades', 'Add-ons'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`chip ${tab === t ? 'is-active' : ''}`} type="button" onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Grades' ? <GradesPanel canEdit={canEdit} /> : <AddonsPanel canEdit={canEdit} />}
    </>
  )
}

// ─────────────────────────── Grades ───────────────────────────

type Draft = { sell: string; cost: string; yieldPct: string }
const toDraft = (p: GradePrice): Draft => ({ sell: String(p.sellRatePerKg), cost: String(p.costRatePerKg), yieldPct: String(Math.round(p.yieldRatio * 100)) })

function GradesPanel({ canEdit }: { canEdit: boolean }) {
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const [banner, setBanner] = useState<Banner>(null)
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
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not load pricing') })
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
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not save prices') })
    } finally {
      setSaving(false)
    }
  }

  async function removeGrade(grade: string) {
    if (!confirm(`Delete grade ${grade} from the rate card?`)) return
    try {
      await dryoApi.deletePrice(grade)
      await refresh()
      setBanner({ tone: 'positive', text: `Deleted ${grade}.` })
      setTimeout(() => setBanner(null), 2000)
    } catch (err) {
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not delete grade') })
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
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not add grade') })
    }
  }

  return (
    <>
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}
      <div className="section-header">
        <h2>Grades</h2>
        {canEdit && (
          <button className="chip" type="button" onClick={() => setAdding((v) => !v)}>
            <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New grade
          </button>
        )}
      </div>

      <BottomSheet open={adding && canEdit} onClose={() => setAdding(false)} title="New grade">
        <form className="biz-form" onSubmit={addGrade}>
          <input className="biz-input" placeholder="Grade code (e.g. AGB-1 or SPECIAL)" value={nw.code} onChange={(e) => setNw((n) => ({ ...n, code: e.target.value }))} />
          <div className="price-fields">
            <label>Sell ₹/kg<input className="price-row-input" inputMode="decimal" value={nw.sell} onChange={(e) => setNw((n) => ({ ...n, sell: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
            <label>Cost ₹/kg<input className="price-row-input" inputMode="decimal" value={nw.cost} onChange={(e) => setNw((n) => ({ ...n, cost: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
            <label>Yield %<input className="price-row-input" inputMode="decimal" value={nw.yieldPct} onChange={(e) => setNw((n) => ({ ...n, yieldPct: e.target.value.replace(/[^\d.]/g, '') }))} /></label>
          </div>
          <Button type="submit" disabled={nw.code.trim().length < 2}>Add grade</Button>
        </form>
      </BottomSheet>

      {loading && <div className="empty-state"><p>Loading grades…</p></div>}
      {prices.map((p) => {
        const d = draft[p.grade]
        if (!d) return null
        return (
          <div key={p.grade} className="card">
            <div className="inv-row-head" style={{ marginBottom: 4 }}>
              <p className="list-row-title"><Tag size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{gradeLabel(p.grade)}</p>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="detail-sub">margin ₹{Math.round((Number(d.sell) || 0) - (Number(d.cost) || 0)).toLocaleString('en-IN')}/kg</span>
                {canEdit && <button type="button" className="chip" onClick={() => removeGrade(p.grade)} aria-label={`Delete ${p.grade}`}><Trash2 size={14} style={{ verticalAlign: '-2px' }} /></button>}
              </span>
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

// ─────────────────────────── Add-ons ───────────────────────────

type AddonDraft = { name: string; rate: string; perKg: boolean }
const toAddonDraft = (a: ServiceAddon): AddonDraft => ({ name: a.name, rate: String(a.rate), perKg: a.perKg })

function AddonsPanel({ canEdit }: { canEdit: boolean }) {
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [draft, setDraft] = useState<Record<string, AddonDraft>>({})
  const [banner, setBanner] = useState<Banner>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [nw, setNw] = useState<{ name: string; rate: string; perKg: boolean }>({ name: '', rate: '', perKg: true })

  async function refresh() {
    try {
      const a = await dryoApi.listAddons()
      setAddons(a)
      setDraft(Object.fromEntries(a.map((x) => [x.id, toAddonDraft(x)])))
    } catch (err) {
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not load add-ons') })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])

  const dirty = useMemo(
    () => addons.filter((a) => {
      const d = draft[a.id]
      if (!d) return false
      return d.name !== a.name || Number(d.rate) !== a.rate || d.perKg !== a.perKg
    }),
    [addons, draft],
  )

  function set(id: string, patch: Partial<AddonDraft>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }))
  }

  async function saveAll() {
    setSaving(true)
    setBanner(null)
    try {
      await Promise.all(dirty.map((a) => {
        const d = draft[a.id]
        return dryoApi.updateAddon(a.id, { name: d.name.trim() || a.name, rate: Number(d.rate) || 0, perKg: d.perKg, active: a.active })
      }))
      await refresh()
      setBanner({ tone: 'positive', text: `Saved ${dirty.length} add-on${dirty.length > 1 ? 's' : ''}.` })
      setTimeout(() => setBanner(null), 2500)
    } catch (err) {
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not save add-ons') })
    } finally {
      setSaving(false)
    }
  }

  async function addAddon(e: FormEvent) {
    e.preventDefault()
    const name = nw.name.trim()
    if (name.length < 2) return
    try {
      await dryoApi.createAddon({ name, rate: Number(nw.rate) || 0, perKg: nw.perKg })
      setNw({ name: '', rate: '', perKg: true })
      setAdding(false)
      await refresh()
      setBanner({ tone: 'positive', text: `Added ${name}.` })
      setTimeout(() => setBanner(null), 2000)
    } catch (err) {
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not add add-on') })
    }
  }

  async function remove(a: ServiceAddon) {
    if (!confirm(`Delete the "${a.name}" add-on?`)) return
    try {
      await dryoApi.deleteAddon(a.id)
      await refresh()
    } catch (err) {
      setBanner({ tone: 'warning', text: apiErrText(err, 'Could not delete add-on') })
    }
  }

  return (
    <>
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}
      <div className="section-header">
        <h2>Service add-ons</h2>
        {canEdit && (
          <button className="chip" type="button" onClick={() => setAdding((v) => !v)}>
            <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New add-on
          </button>
        )}
      </div>

      <BottomSheet open={adding && canEdit} onClose={() => setAdding(false)} title="New add-on">
        <form className="biz-form" onSubmit={addAddon}>
          <input className="biz-input" placeholder="Name (e.g. Grading, Sorting, Packing)" value={nw.name} onChange={(e) => setNw((n) => ({ ...n, name: e.target.value }))} />
          <div className="chip-row" style={{ padding: '2px 0' }}>
            <button type="button" className={`chip ${nw.perKg ? 'is-active' : ''}`} onClick={() => setNw((n) => ({ ...n, perKg: true }))}>Per kg</button>
            <button type="button" className={`chip ${!nw.perKg ? 'is-active' : ''}`} onClick={() => setNw((n) => ({ ...n, perKg: false }))}>Flat charge</button>
          </div>
          <input className="biz-input" placeholder={nw.perKg ? 'Rate ₹ / kg' : 'Flat ₹ per batch'} inputMode="decimal" value={nw.rate} onChange={(e) => setNw((n) => ({ ...n, rate: e.target.value.replace(/[^\d.]/g, '') }))} />
          <Button type="submit" disabled={nw.name.trim().length < 2}>Add add-on</Button>
        </form>
      </BottomSheet>

      {loading && <div className="empty-state"><p>Loading add-ons…</p></div>}
      {!loading && addons.length === 0 && <div className="empty-state"><p>No add-ons yet. Create one (e.g. Grading) to bill it on batches.</p></div>}
      {addons.map((a) => {
        const d = draft[a.id]
        if (!d) return null
        return (
          <div key={a.id} className="card">
            <div className="inv-row-head" style={{ marginBottom: 8 }}>
              <p className="list-row-title"><Sparkles size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />{d.name || a.name}</p>
              {canEdit && (
                <button type="button" className="chip" aria-label={`Delete ${a.name}`} onClick={() => remove(a)}>
                  <Trash2 size={14} style={{ verticalAlign: '-2px' }} />
                </button>
              )}
            </div>
            <input className="biz-input" disabled={!canEdit} placeholder="Name" value={d.name} onChange={(e) => set(a.id, { name: e.target.value })} style={{ marginBottom: 10 }} />
            <div className="chip-row" style={{ padding: '0 0 10px' }}>
              <button type="button" className={`chip ${d.perKg ? 'is-active' : ''}`} disabled={!canEdit} onClick={() => set(a.id, { perKg: true })}>Per kg</button>
              <button type="button" className={`chip ${!d.perKg ? 'is-active' : ''}`} disabled={!canEdit} onClick={() => set(a.id, { perKg: false })}>Flat charge</button>
            </div>
            <div className="price-fields">
              <label>{d.perKg ? 'Rate ₹ / kg' : 'Flat ₹ per batch'}
                <input className="price-row-input" disabled={!canEdit} inputMode="decimal" value={d.rate} onChange={(e) => set(a.id, { rate: e.target.value.replace(/[^\d.]/g, '') })} />
              </label>
            </div>
          </div>
        )
      })}

      {canEdit && addons.length > 0 && (
        <div className="sticky-action">
          <Button onClick={saveAll} disabled={dirty.length === 0 || saving}>
            {saving ? 'Saving…' : dirty.length ? `Save ${dirty.length} change${dirty.length > 1 ? 's' : ''}` : 'Saved'}
          </Button>
        </div>
      )}
    </>
  )
}
