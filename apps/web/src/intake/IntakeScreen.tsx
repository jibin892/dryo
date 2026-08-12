import { useEffect, useState, type FormEvent } from 'react'
import { PackageCheck, Plus } from 'lucide-react'
import type { Farmer } from '../shared/contracts'
import { useDryo, type NewIntakeInput } from '../app/store'
import { dryoApi } from '../api/dryo'
import { clockTime } from '../shared/format'
import { Button, Pill, ScreenHeading, SectionHeader, StatusBanner, Weight } from '../shared/ui/components'
import './intake.css'
import '../business/business.css'

function NewIntake({ onCreate }: { onCreate: (input: NewIntakeInput) => void }) {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [farmerSel, setFarmerSel] = useState('')
  const [newFarmer, setNewFarmer] = useState({ name: '', village: '', phone: '' })
  const [weightKg, setWeight] = useState('')
  const [moisturePct, setMoisture] = useState('72')
  const [ratePerKg, setRate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dryoApi.listFarmers().then(setFarmers).catch(() => setFarmers([]))
  }, [])

  const selected = farmers.find((f) => f.id === farmerSel)
  const chosenName = farmerSel === 'NEW' ? newFarmer.name : selected?.name ?? ''
  const valid = chosenName.trim().length > 1 && Number(weightKg) > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      let farmerName = ''
      let village = ''
      if (farmerSel === 'NEW') {
        const created = await dryoApi.createFarmer(newFarmer).catch(() => null)
        farmerName = created?.name ?? newFarmer.name
        village = created?.village ?? newFarmer.village
      } else if (selected) {
        farmerName = selected.name
        village = selected.village
      }
      onCreate({ farmerName, village, weightKg: Number(weightKg), moisturePct: Number(moisturePct) || 72, ratePerKg: Number(ratePerKg) || 0 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card biz-form" onSubmit={submit}>
      <select className="biz-select" value={farmerSel} onChange={(e) => setFarmerSel(e.target.value)}>
        <option value="">Select farmer…</option>
        {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}{f.village ? ` · ${f.village}` : ''}</option>)}
        <option value="NEW">＋ Add new farmer</option>
      </select>
      {farmerSel === 'NEW' && (
        <>
          <input className="biz-input" placeholder="New farmer name" value={newFarmer.name} onChange={(e) => setNewFarmer((n) => ({ ...n, name: e.target.value }))} />
          <div style={{ display: 'flex', gap: 12 }}>
            <input className="biz-input" placeholder="Village" value={newFarmer.village} onChange={(e) => setNewFarmer((n) => ({ ...n, village: e.target.value }))} />
            <input className="biz-input" placeholder="Phone" value={newFarmer.phone} onChange={(e) => setNewFarmer((n) => ({ ...n, phone: e.target.value }))} inputMode="tel" />
          </div>
        </>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Weight kg" value={weightKg} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Moisture %" value={moisturePct} onChange={(e) => setMoisture(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      </div>
      <input className="biz-input" placeholder="Rate ₹/kg green" value={ratePerKg} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      <Button type="submit" disabled={!valid || busy}>{busy ? 'Saving…' : 'Add weigh-in'}</Button>
    </form>
  )
}

export function IntakeScreen() {
  const intake = useDryo((state) => state.intake)
  const chambers = useDryo((state) => state.chambers)
  const loadIntake = useDryo((state) => state.loadIntake)
  const createIntake = useDryo((state) => state.createIntake)
  const [chosen, setChosen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const idle = chambers.filter((chamber) => chamber.status === 'IDLE')
  const pending = intake.filter((receipt) => receipt.status === 'PENDING')
  const loaded = intake.filter((receipt) => receipt.status === 'LOADED')
  const totalPending = pending.reduce((sum, receipt) => sum + receipt.weightKg, 0)

  return (
    <>
      <ScreenHeading eyebrow="Green cardamom" title="Intake" description="Weigh-in from farmers and estates, ready to load into a chamber." />

      <StatusBanner tone={pending.length ? 'warning' : 'positive'}>
        {pending.length
          ? `${pending.length} receipt${pending.length > 1 ? 's' : ''} awaiting a chamber · ${totalPending} kg green.`
          : 'All weighed-in stock has been loaded.'}
      </StatusBanner>

      <SectionHeader
        title="Awaiting chamber"
        action={<button className="chip" type="button" onClick={() => setAdding((v) => !v)}><Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New</button>}
      />
      {adding && <NewIntake onCreate={(input) => { createIntake(input); setAdding(false) }} />}
      <div className="list-group">
        {pending.map((receipt) => (
          <div key={receipt.id} className="intake-card">
            <div className="intake-card-head">
              <div>
                <p className="intake-card-title">{receipt.farmerName}</p>
                <p className="intake-card-sub">{receipt.village} · {clockTime(receipt.receivedAt)}</p>
              </div>
              <Pill tone="warning">Pending</Pill>
            </div>
            <div className="field-grid" style={{ marginTop: 12 }}>
              <div className="field"><small>Weight</small><strong><Weight kg={receipt.weightKg} size="sm" /></strong></div>
              <div className="field"><small>Moisture</small><strong>{receipt.moisturePct}%</strong></div>
              <div className="field"><small>Rate</small><strong>₹{receipt.ratePerKg.toLocaleString('en-IN')}/kg</strong></div>
              <div className="field"><small>Value</small><strong>₹{(receipt.weightKg * receipt.ratePerKg).toLocaleString('en-IN')}</strong></div>
            </div>
            <div className="chip-row" style={{ padding: '12px 0 0' }}>
              {idle.length === 0 && <span className="intake-card-sub">No idle chamber available</span>}
              {idle.map((chamber) => (
                <button
                  key={chamber.id}
                  className={`chip ${chosen === `${receipt.id}:${chamber.id}` ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => setChosen(`${receipt.id}:${chamber.id}`)}
                >
                  {chamber.name}
                </button>
              ))}
            </div>
            {idle.length > 0 && (
              <Button
                className="intake-load-button"
                disabled={!chosen?.startsWith(`${receipt.id}:`)}
                onClick={() => {
                  const chamberId = chosen?.split(':')[1]
                  if (chamberId) {
                    loadIntake(receipt.id, chamberId)
                    setChosen(null)
                  }
                }}
              >
                <PackageCheck size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
                Load into chamber
              </Button>
            )}
          </div>
        ))}
        {pending.length === 0 && <div className="empty-state"><p>Nothing waiting. New weigh-ins will appear here.</p></div>}
      </div>

      <SectionHeader title="Loaded today" />
      <div className="list-group">
        {loaded.map((receipt) => (
          <div key={receipt.id} className="list-row">
            <span className="list-row-lead"><PackageCheck aria-hidden="true" size={20} /></span>
            <span className="list-row-copy">
              <span className="list-row-title">{receipt.farmerName}</span>
              <span className="list-row-subtitle">{receipt.weightKg} kg · {receipt.moisturePct}% moisture</span>
            </span>
            <Pill tone="positive">Loaded</Pill>
          </div>
        ))}
        {loaded.length === 0 && <div className="empty-state"><p>No lots loaded yet today.</p></div>}
      </div>
    </>
  )
}
