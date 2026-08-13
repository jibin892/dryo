import { useEffect, useMemo, useState } from 'react'
import { Coins, TrendingUp, Warehouse } from 'lucide-react'
import type { GradePrice, InventoryLot } from '../shared/contracts'
import { gradeLabel } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { useDryo } from '../app/store'
import { ScreenHeading, SectionHeader, StatCard, StatusBanner } from '../shared/ui/components'
import { money } from '../business/FarmersScreen'
import '../business/business.css'

export function InventoryScreen({ canEdit = false }: { canEdit?: boolean }) {
  const storeInventory = useDryo((state) => state.inventory)
  const [inventory, setInventory] = useState<InventoryLot[]>(storeInventory)
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [draft, setDraft] = useState<Record<string, { cost: string; location: string }>>({})
  const [banner, setBanner] = useState<{ tone: 'positive' | 'warning'; text: string } | null>(null)

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
      <ScreenHeading eyebrow="Graded stock" title="Inventory" description="Cured stock with cost basis and margin at today's prices." />
      {banner && <StatusBanner tone={banner.tone}>{banner.text}</StatusBanner>}

      <div className="stat-grid">
        <StatCard label="In store" value={Math.round(totals.kg)} unit="kg" icon={Warehouse} accent />
        <StatCard label="Value at cost" value={money(totals.cost)} icon={Coins} />
        <StatCard label="At retail" value={money(totals.retail)} icon={Coins} />
        <StatCard label="Potential margin" value={money(totals.margin)} icon={TrendingUp} />
      </div>

      <SectionHeader title="By grade" />
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
                <span className={`metric metric-sm ${marginKg >= 0 ? 'biz-credit' : 'biz-debit'}`}>{marginKg >= 0 ? '+' : '−'}{money(marginKg)}/kg</span>
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
