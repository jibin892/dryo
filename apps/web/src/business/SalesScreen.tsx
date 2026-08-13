import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Gavel, Plus, Receipt, Store } from 'lucide-react'
import type { Grade, GradePrice, InventoryLot, Sale, SaleChannel } from '../shared/contracts'
import { GRADE_LABEL } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, ListRow, ScreenHeading, SectionHeader, StatusBanner } from '../shared/ui/components'
import { BottomSheet } from '../shared/ui/BottomSheet'
import { clockTime } from '../shared/format'
import { money } from './FarmersScreen'
import './business.css'

const GRADES: Grade[] = ['AGEB', 'AGB', 'AGS', 'AGES', 'REJECT']

export function SalesScreen() {
  const [sales, setSales] = useState<Sale[]>([])
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [inventory, setInventory] = useState<InventoryLot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function refresh() {
    try {
      const [s, p, inv] = await Promise.all([dryoApi.listSales(), dryoApi.listPricing(), dryoApi.listInventory()])
      setSales(s)
      setPrices(p)
      setInventory(inv)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? 'Start the Dryo API to record sales.' : 'Could not load sales.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])

  const total = sales.reduce((sum, s) => sum + s.amount, 0)

  return (
    <>
      <ScreenHeading eyebrow="Dispatch & revenue" title="Sales" description="Graded lots sold — direct or through the auction." />
      {error && <StatusBanner tone="warning">{error}</StatusBanner>}

      {sales.length > 0 && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="stat-card-head"><Receipt size={15} />Total sales</span>
          <span className="metric metric-md">{money(total)}</span>
        </div>
      )}

      <div className="section-header"><h2>Record</h2>
        <button className="chip" type="button" onClick={() => setAdding((v) => !v)}><Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New sale</button>
      </div>
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New sale">
        <NewSale prices={prices} inventory={inventory} onDone={() => { setAdding(false); void refresh() }} />
      </BottomSheet>

      <SectionHeader title="History" />
      <div className="list-group">
        {loading && <div className="empty-state"><p>Loading sales…</p></div>}
        {!loading && sales.map((s) => (
          <ListRow
            key={s.id}
            lead={s.channel === 'AUCTION' ? <Gavel size={18} /> : <Store size={18} />}
            title={`${s.buyerName}`}
            subtitle={`${s.quantityKg} kg ${s.grade} @ ${money(s.ratePerKg)} · ${clockTime(s.soldAt)}`}
            value={<span className="list-row-value biz-credit">{money(s.amount)}</span>}
          />
        ))}
        {!loading && sales.length === 0 && <div className="empty-state"><p>No sales recorded yet.</p></div>}
      </div>
    </>
  )
}

function NewSale({ prices, inventory, onDone }: { prices: GradePrice[]; inventory: InventoryLot[]; onDone: () => void }) {
  const [buyerName, setBuyerName] = useState('')
  const [channel, setChannel] = useState<SaleChannel>('DIRECT')
  const [grade, setGrade] = useState<Grade>('AGEB')
  const [quantityKg, setQuantityKg] = useState('')
  const [rate, setRate] = useState('')
  const [busy, setBusy] = useState(false)

  const priceForGrade = useMemo(() => prices.find((p) => p.grade === grade)?.sellRatePerKg ?? 0, [prices, grade])
  useEffect(() => { if (priceForGrade) setRate(String(priceForGrade)) }, [priceForGrade])

  const inStore = useMemo(() => inventory.find((l) => l.grade === grade)?.bulkKg ?? 0, [inventory, grade])
  const oversell = Number(quantityKg) > inStore
  const amount = (Number(quantityKg) || 0) * (Number(rate) || 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await dryoApi.createSale({ buyerName, channel, grade, quantityKg: Number(quantityKg), ratePerKg: Number(rate), amount })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card biz-form" onSubmit={submit}>
      <input className="biz-input" placeholder="Buyer / auction name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
      <div className="chip-row" style={{ padding: '2px 0' }}>
        {(['DIRECT', 'AUCTION'] as SaleChannel[]).map((c) => (
          <button key={c} type="button" className={`chip ${channel === c ? 'is-active' : ''}`} onClick={() => setChannel(c)}>{c === 'DIRECT' ? 'Direct' : 'Auction'}</button>
        ))}
      </div>
      <select className="biz-select" value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
        {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Quantity (kg)" value={quantityKg} onChange={(e) => setQuantityKg(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="₹ / kg" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      </div>
      <p className="detail-sub" style={{ padding: '0 4px', color: oversell ? 'var(--status-warning)' : undefined }}>
        {oversell
          ? `Only ${inStore.toLocaleString('en-IN')} kg of ${grade} in store — selling more will draw it to zero.`
          : `In store: ${inStore.toLocaleString('en-IN')} kg ${grade}`}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="detail-sub">Amount</span>
        <span className="metric metric-md">{money(amount)}</span>
      </div>
      <Button type="submit" disabled={buyerName.trim().length < 2 || !Number(quantityKg) || !Number(rate) || busy}>
        {busy ? 'Saving…' : 'Record sale'}
      </Button>
    </form>
  )
}
