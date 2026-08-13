import { useState, type FormEvent } from 'react'
import { PackageCheck, Plus } from 'lucide-react'
import type { Farmer } from '../shared/contracts'
import { useDryo, type NewIntakeInput } from '../app/store'
import { clockTime } from '../shared/format'
import { Button, Pill, ScreenHeading, SectionHeader, StatusBanner, Weight } from '../shared/ui/components'
import { FarmerPicker } from '../shared/ui/FarmerPicker'
import { BottomSheet } from '../shared/ui/BottomSheet'
import './intake.css'
import '../business/business.css'

function NewIntake({ onCreate }: { onCreate: (input: NewIntakeInput) => void }) {
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [weightKg, setWeight] = useState('')
  const [moisturePct, setMoisture] = useState('72')
  const [ratePerKg, setRate] = useState('')

  const valid = !!farmer && Number(weightKg) > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!farmer) return
    onCreate({ farmerName: farmer.name, village: farmer.village, farmerId: farmer.id, weightKg: Number(weightKg), moisturePct: Number(moisturePct) || 72, ratePerKg: Number(ratePerKg) || 0 })
  }

  return (
    <form className="biz-form" onSubmit={submit}>
      <FarmerPicker value={farmer} onChange={setFarmer} />
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Weight kg" value={weightKg} onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Moisture %" value={moisturePct} onChange={(e) => setMoisture(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      </div>
      <input className="biz-input" placeholder="Rate ₹/kg green" value={ratePerKg} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      <Button type="submit" disabled={!valid}>Add weigh-in</Button>
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
      <ScreenHeading eyebrow="Green cardamom" title="Intake" description="Own-purchase weigh-in from farmers, ready to load into a chamber. For job-work lots, use New batch on the Batches screen." />

      <StatusBanner tone={pending.length ? 'warning' : 'positive'}>
        {pending.length
          ? `${pending.length} receipt${pending.length > 1 ? 's' : ''} awaiting a chamber · ${totalPending} kg green.`
          : 'All weighed-in stock has been loaded.'}
      </StatusBanner>

      <SectionHeader
        title="Awaiting chamber"
        action={<button className="chip" type="button" onClick={() => setAdding((v) => !v)}><Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New</button>}
      />
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New weigh-in">
        <NewIntake onCreate={(input) => { createIntake(input); setAdding(false) }} />
      </BottomSheet>
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
