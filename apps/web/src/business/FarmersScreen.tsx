import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, IndianRupee, Pencil, Plus, UserRound } from 'lucide-react'
import type { Farmer, FarmerDetail, FarmerTransactionType } from '../shared/contracts'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { Button, ListRow, Pill, ScreenHeading, SectionHeader, StatusBanner } from '../shared/ui/components'
import { BottomSheet } from '../shared/ui/BottomSheet'
import { relativeTime } from '../shared/format'
import './business.css'

export function money(n: number): string {
  const abs = Math.abs(Math.round(n))
  return `₹${abs.toLocaleString('en-IN')}`
}

const TX_LABEL: Record<FarmerTransactionType, string> = {
  PURCHASE: 'Green purchased',
  JOBWORK_CHARGE: 'Curing charge',
  ADVANCE: 'Advance paid',
  PAYMENT: 'Payment made',
  ADJUSTMENT: 'Adjustment',
}

function BalancePill({ balance }: { balance: number }) {
  if (Math.round(balance) === 0) return <Pill tone="neutral">Settled</Pill>
  return balance > 0
    ? <Pill tone="warning">Pay {money(balance)}</Pill>
    : <Pill tone="positive">Owes {money(balance)}</Pill>
}

export function FarmersScreen() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [selected, setSelected] = useState<FarmerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function refresh() {
    try {
      setFarmers(await dryoApi.listFarmers())
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? 'Start the Dryo API to manage farmers.' : 'Could not load farmers.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void refresh() }, [])

  async function openFarmer(id: string) {
    try {
      setSelected(await dryoApi.getFarmer(id))
    } catch { /* ignore */ }
  }

  if (selected) {
    return <FarmerDetailView detail={selected} onBack={() => { setSelected(null); void refresh() }} onChanged={() => openFarmer(selected.id)} />
  }

  return (
    <>
      <ScreenHeading eyebrow="Suppliers & ledger" title="Farmers" description="Who you buy from and cure for — with running balances." />
      {error && <StatusBanner tone="warning">{error}</StatusBanner>}

      <div className="section-header"><h2>Farmers{farmers.length ? ` · ${farmers.length}` : ''}</h2>
        <button className="chip" type="button" onClick={() => setAdding((v) => !v)}><Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New</button>
      </div>
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New farmer">
        <AddFarmer onDone={() => { setAdding(false); void refresh() }} />
      </BottomSheet>

      <div className="list-group">
        {loading && <div className="empty-state"><p>Loading farmers…</p></div>}
        {!loading && farmers.map((f) => (
          <ListRow
            key={f.id}
            lead={<UserRound size={18} />}
            title={f.name}
            subtitle={`${f.village || '—'}${f.phone ? ` · ${f.phone}` : ''}`}
            value={<BalancePill balance={f.balance} />}
            onClick={() => openFarmer(f.id)}
          />
        ))}
        {!loading && farmers.length === 0 && <div className="empty-state"><p>No farmers yet. Add your first supplier.</p></div>}
      </div>
    </>
  )
}

function AddFarmer({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [village, setVillage] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await dryoApi.createFarmer({ name, village, phone })
      onDone()
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card biz-form" onSubmit={submit}>
      <input className="biz-input" placeholder="Farmer name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="biz-input" placeholder="Village" value={village} onChange={(e) => setVillage(e.target.value)} />
      <input className="biz-input" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      <Button type="submit" disabled={name.trim().length < 2 || busy}>{busy ? 'Saving…' : 'Add farmer'}</Button>
    </form>
  )
}

const TX_TYPES: FarmerTransactionType[] = ['PAYMENT', 'ADVANCE', 'PURCHASE', 'JOBWORK_CHARGE']

function FarmerDetailView({ detail, onBack, onChanged }: { detail: FarmerDetail; onBack: () => void; onChanged: () => void }) {
  const [type, setType] = useState<FarmerTransactionType>('PAYMENT')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [profile, setProfile] = useState({ name: detail.name, village: detail.village, phone: detail.phone, note: detail.note })

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    await dryoApi.updateFarmer(detail.id, profile).catch(() => undefined)
    setEditing(false)
    onChanged()
  }

  async function record(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!value) return
    setBusy(true)
    try {
      await dryoApi.addFarmerTransaction(detail.id, { type, amount: value, note })
      setAmount(''); setNote('')
      setRecording(false)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="detail-scroll">
      <div className="mobile-back-row">
        <button type="button" className="chip" onClick={onBack}><ArrowLeft size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Farmers</button>
      </div>
      <div className="detail-head">
        <div>
          <p className="eyebrow">Supplier</p>
          <h2>{detail.name}</h2>
          <p className="detail-sub">{detail.village || '—'}{detail.phone ? ` · ${detail.phone}` : ''}</p>
        </div>
        <button type="button" className="chip" onClick={() => setEditing((v) => !v)}><Pencil size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Edit</button>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <BalancePill balance={detail.balance} />
        <button type="button" className="chip" onClick={() => setRecording(true)}><Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Record</button>
      </div>

      <BottomSheet open={editing} onClose={() => setEditing(false)} title="Edit farmer">
        <form className="biz-form" onSubmit={saveProfile}>
          <input className="biz-input" placeholder="Name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
          <input className="biz-input" placeholder="Village" value={profile.village} onChange={(e) => setProfile((p) => ({ ...p, village: e.target.value }))} />
          <input className="biz-input" placeholder="Phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} inputMode="tel" />
          <input className="biz-input" placeholder="Note" value={profile.note} onChange={(e) => setProfile((p) => ({ ...p, note: e.target.value }))} />
          <Button type="submit">Save profile</Button>
        </form>
      </BottomSheet>

      <BottomSheet open={recording} onClose={() => setRecording(false)} title="Record transaction">
        <form className="biz-form" onSubmit={record}>
          <div className="chip-row" style={{ padding: '2px 0' }}>
            {TX_TYPES.map((t) => (
              <button key={t} type="button" className={`chip ${type === t ? 'is-active' : ''}`} onClick={() => setType(t)}>{TX_LABEL[t]}</button>
            ))}
          </div>
          <div className="biz-amount">
            <IndianRupee size={18} />
            <input className="biz-input" style={{ border: 0, padding: '0 8px' }} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" autoFocus />
          </div>
          <input className="biz-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" disabled={!Number(amount) || busy}>{busy ? 'Saving…' : `Record ${TX_LABEL[type].toLowerCase()}`}</Button>
        </form>
      </BottomSheet>

      <SectionHeader title="Ledger" />
      <div className="list-group">
        {detail.transactions.map((t) => (
          <div key={t.id} className="list-row">
            <span className="list-row-copy">
              <span className="list-row-title">{TX_LABEL[t.type]}</span>
              <span className="list-row-subtitle">{t.note || relativeTime(t.createdAt, Date.now())}</span>
            </span>
            <span className={`list-row-value ${t.amount >= 0 ? 'biz-credit' : 'biz-debit'}`}>{t.amount >= 0 ? '+' : '−'}{money(t.amount)}</span>
          </div>
        ))}
        {detail.transactions.length === 0 && <div className="empty-state"><p>No transactions yet.</p></div>}
      </div>
    </div>
  )
}
