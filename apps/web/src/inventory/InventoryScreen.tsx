import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Coins, Plus, Trash2, TrendingUp, Warehouse } from 'lucide-react'
import type { GradePrice, InventoryLot } from '../shared/contracts'
import { gradeLabel } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { useDryo } from '../app/store'
import { Button, ScreenHeading, StatCard, StatusBanner } from '../shared/ui/components'
import { BottomSheet } from '../shared/ui/BottomSheet'
import { money } from '../business/FarmersScreen'
import '../business/business.css'

export function InventoryScreen({ canEdit = false }: { canEdit?: boolean }) {
  const storeInventory = useDryo((state) => state.inventory)
  const [inventory, setInventory] = useState<InventoryLot[]>(storeInventory)
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [draft, setDraft] = useState<Record<string, { cost: string; location: string }>>({})
  const [banner, setBanner] = useState<{ tone: 'positive' | 'warning'; text: string } | null>(null)
  const [adding, setAdding] = useState(false)

  async function refresh() {
    try {
      const [inv, pr] = await Promise.all([dryoApi.listInventory(), dryoApi.listPricing()])
      setInventory(inv)
      setPrices(pr)
      setDraft(Object.fromEntries(inv.map((l) => [l.grade, { cost: String(l.costPerKg), location: l.location }])))
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) setBanner({ tone: 'warning', text: 'Offline — showing cached stock. Start the API to edit.' })
    }
  }
  useEffect(() => { void refresh() }, [])

  const sellRate = (grade: string) => prices.find((p) => p.grade === grade)?.sellRatePerKg ?? 0

  const totals = useMemo(() => {
    const kg = inventory.reduce((s, l) => s + l.bulkKg, 0)
    const cost = inventory.reduce((s, l) => s + l.bulkKg * l.costPerKg, 0)
    const retail = inventory.reduce((s, l) => s + l.bulkKg * sellRate(l.grade), 0)
    return { kg, cost, retail, margin: retail - cost }
  }, [inventory, prices])

  async function deleteLot(grade: string) {
    if (!confirm(`Remove the ${grade} stock line?`)) return
    try {
      await dryoApi.deleteInventory(grade)
      setBanner({ tone: 'positive', text: `Removed ${grade}.` })
      setTimeout(() => setBanner(null), 2000)
      await refresh()
    } catch (err) {
      setBanner({ tone: 'warning', text: err instanceof ApiError ? err.message : 'Could not remove stock line.' })
    }
  }

  async function saveRow(grade: string) {
    const d = draft[grade]
    if (!d) return
    try {
      await dryoApi.updateInventory(grade, { costPerKg: Number(d.cost) || 0, location: d.location })
      setBanner({ tone: 'positive', text: `Updated ${grade}.` })
      setTimeout(() => setBanner(null), 2000)
      await refresh()
    } catch {
      setBanner({ tone: 'warning', text: 'Could not update.' })
    }
  }

  return (
    <>
      <ScreenHeading eyebrow="Stock on hand" title="Stock" description="What's physically in your store right now, by grade — with cost basis and value. Sales draw down from here." />
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}

      <div className="stat-grid">
        <StatCard label="In store" value={Math.round(totals.kg)} unit="kg" icon={Warehouse} accent />
        <StatCard label="Value at cost" value={money(totals.cost)} icon={Coins} />
        <StatCard label="At retail" value={money(totals.retail)} icon={Coins} />
        <StatCard label="Potential margin" value={money(totals.margin)} icon={TrendingUp} />
      </div>

      <div className="section-header">
        <h2>By grade</h2>
        {canEdit && <button className="chip" type="button" onClick={() => setAdding(true)}><Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Add stock</button>}
      </div>
      <BottomSheet open={adding && canEdit} onClose={() => setAdding(false)} title="Add / correct stock">
        <AddStockForm onDone={() => { setAdding(false); void refresh() }} />
      </BottomSheet>
      <div className="list-group">
        {inventory.map((lot) => {
          const marginKg = sellRate(lot.grade) - lot.costPerKg
          return (
            <div key={lot.grade} className="inv-row">
              <div className="inv-row-head">
                <div>
                  <p className="list-row-title">{gradeLabel(lot.grade)}</p>
                  <p className="list-row-subtitle">{lot.bulkKg} kg · {lot.bags} bags · {lot.avgMoisture}% moisture</p>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`metric metric-sm ${marginKg >= 0 ? 'biz-credit' : 'biz-debit'}`}>{marginKg >= 0 ? '+' : '−'}{money(marginKg)}/kg</span>
                  {canEdit && <button type="button" className="chip" onClick={() => deleteLot(lot.grade)} aria-label={`Delete ${lot.grade}`}><Trash2 size={14} style={{ verticalAlign: '-2px' }} /></button>}
                </span>
              </div>
              {canEdit ? (
                <div className="inv-edit">
                  <label>Cost ₹/kg
                    <input className="price-row-input" inputMode="decimal" value={draft[lot.grade]?.cost ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [lot.grade]: { ...d[lot.grade], cost: e.target.value.replace(/[^\d.]/g, '') } }))}
                      onBlur={() => saveRow(lot.grade)} />
                  </label>
                  <label>Location
                    <input className="biz-input" style={{ minHeight: 42 }} value={draft[lot.grade]?.location ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [lot.grade]: { ...d[lot.grade], location: e.target.value } }))}
                      onBlur={() => saveRow(lot.grade)} />
                  </label>
                </div>
              ) : (
                <p className="list-row-subtitle">Cost {money(lot.costPerKg)}/kg · Sell {money(sellRate(lot.grade))}/kg · {lot.location}</p>
              )}
            </div>
          )
        })}
        {inventory.length === 0 && <div className="empty-state"><p>No graded stock yet.</p></div>}
      </div>
    </>
  )
}

function AddStockForm({ onDone }: { onDone: () => void }) {
  const [grade, setGrade] = useState('')
  const [bulkKg, setBulk] = useState('')
  const [bags, setBags] = useState('')
  const [location, setLocation] = useState('')
  const [cost, setCost] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (grade.trim().length < 2) return
    setBusy(true)
    try {
      await dryoApi.upsertInventory({
        grade: grade.trim().toUpperCase(),
        bulkKg: Number(bulkKg) || 0,
        bags: Number(bags) || 0,
        location: location.trim(),
        costPerKg: Number(cost) || 0,
        avgMoisture: 10,
      })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="biz-form" onSubmit={submit}>
      <input className="biz-input" placeholder="Grade code (e.g. AGEB or UNGRADED)" value={grade} onChange={(e) => setGrade(e.target.value)} autoFocus />
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Stock kg (sets total)" value={bulkKg} onChange={(e) => setBulk(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Bags" value={bags} onChange={(e) => setBags(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Cost ₹/kg" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <p className="detail-sub" style={{ padding: '0 4px' }}>Sets the total stock for this grade (manual add / correction).</p>
      <Button type="submit" disabled={grade.trim().length < 2 || busy}>{busy ? 'Saving…' : 'Save stock'}</Button>
    </form>
  )
}
