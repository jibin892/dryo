import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Droplets, Pencil, Plus } from 'lucide-react'
import type { Batch, Farmer, Grade, GradePrice } from '../shared/contracts'
import { GRADE_LABEL, STAGE_LABEL, STAGE_ORDER } from '../shared/contracts'
import { clockTime, stageTone } from '../shared/format'
import { dryoApi } from '../api/dryo'
import { useDryo, type NewBatchInput } from '../app/store'
import { Button, Gauge, ListRow, Pill, ScreenHeading, SectionHeader, StatusBanner, Weight } from '../shared/ui/components'
import '../business/business.css'

const FILTERS = ['Active', 'Ready', 'All'] as const
type Filter = (typeof FILTERS)[number]

function matchesFilter(batch: Batch, filter: Filter): boolean {
  if (filter === 'All') return true
  if (filter === 'Ready') return batch.stage === 'READY' || batch.stage === 'GRADING'
  return batch.stage === 'INTAKE' || batch.stage === 'DRYING' || batch.stage === 'CURING'
}

export function BatchesScreen({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const batches = useDryo((state) => state.batches)
  const createBatch = useDryo((state) => state.createBatch)
  const [filter, setFilter] = useState<Filter>('Active')
  const [adding, setAdding] = useState(false)
  const visible = useMemo(() => batches.filter((batch) => matchesFilter(batch, filter)), [batches, filter])

  return (
    <>
      <ScreenHeading eyebrow="Traceable lots" title="Batches" description="Every lot from farmer intake to dispatch, one tap deep." />

      <div className="section-header">
        <h2>New lot</h2>
        <button className="chip" type="button" onClick={() => setAdding((v) => !v)}>
          <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New batch
        </button>
      </div>
      {adding && (
        <NewBatch
          suggestedLot={`VDM-${1046 + batches.filter((b) => b.lotCode.startsWith('VDM-')).length}`}
          onCreate={(input) => { createBatch(input); setAdding(false) }}
        />
      )}

      <div className="chip-row" role="tablist" aria-label="Filter batches">
        {FILTERS.map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={filter === option}
            className={`chip ${filter === option ? 'is-active' : ''}`}
            type="button"
            onClick={() => setFilter(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="list-group">
        {visible.map((batch) => (
          <ListRow
            key={batch.id}
            lead={<Droplets aria-hidden="true" size={20} />}
            title={`${batch.lotCode} · ${batch.farmerName}`}
            subtitle={`${batch.village} · ${batch.greenWeightKg} kg green${batch.grade ? ` · ${batch.grade}` : ''}`}
            value={<Pill tone={stageTone(batch.stage)}>{STAGE_LABEL[batch.stage]}</Pill>}
            selected={batch.id === selectedId}
            onClick={() => onSelect(batch.id)}
          />
        ))}
        {visible.length === 0 && <div className="empty-state"><p>No lots in this view.</p></div>}
      </div>
    </>
  )
}

function NewBatch({ suggestedLot, onCreate }: { suggestedLot: string; onCreate: (input: NewBatchInput) => void }) {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [farmerSel, setFarmerSel] = useState('') // farmer id · '' none · 'NEW' add-new
  const [newFarmer, setNewFarmer] = useState({ name: '', village: '', phone: '' })
  const [lotCode, setLotCode] = useState(suggestedLot)
  const [ownership, setOwnership] = useState<'OWN' | 'JOBWORK'>('OWN')
  const [greenWeightKg, setGreen] = useState('')
  const [currentMoisture, setMoisture] = useState('72')
  const [rate, setRate] = useState('')
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [grade, setGrade] = useState<Grade | ''>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dryoApi.listFarmers().then(setFarmers).catch(() => setFarmers([]))
    dryoApi.listPricing().then(setPrices).catch(() => setPrices([]))
  }, [])

  const gradePrice = prices.find((p) => p.grade === grade)
  const estDried = gradePrice && Number(greenWeightKg) > 0 ? Math.round(Number(greenWeightKg) * gradePrice.yieldRatio) : null
  const selectedFarmer = farmers.find((f) => f.id === farmerSel)
  const chosenName = farmerSel === 'NEW' ? newFarmer.name : selectedFarmer?.name ?? ''
  const valid = lotCode.trim().length > 0 && chosenName.trim().length > 1 && Number(greenWeightKg) > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      let farmerId: string | undefined
      let farmerName = ''
      let village = ''
      if (farmerSel === 'NEW') {
        const created = await dryoApi.createFarmer(newFarmer).catch(() => null)
        farmerId = created?.id
        farmerName = created?.name ?? newFarmer.name
        village = created?.village ?? newFarmer.village
      } else if (selectedFarmer) {
        farmerId = selectedFarmer.id
        farmerName = selectedFarmer.name
        village = selectedFarmer.village
      }
      const value = Number(rate) || 0
      onCreate({
        lotCode: lotCode.trim(),
        farmerName,
        village,
        greenWeightKg: Number(greenWeightKg),
        currentMoisture: Number(currentMoisture) || 72,
        ratePerKg: ownership === 'OWN' ? value : 0,
        curingRatePerKg: ownership === 'JOBWORK' ? value : 0,
        farmerId,
        ownership,
        grade: grade || undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card biz-form" onSubmit={submit}>
      <input className="biz-input" placeholder="Lot code" value={lotCode} onChange={(e) => setLotCode(e.target.value)} />

      <select className="biz-select" value={farmerSel} onChange={(e) => setFarmerSel(e.target.value)}>
        <option value="">Select farmer…</option>
        {farmers.map((f) => (
          <option key={f.id} value={f.id}>{f.name}{f.village ? ` · ${f.village}` : ''}</option>
        ))}
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

      <div className="chip-row" style={{ padding: '2px 0' }}>
        {(['OWN', 'JOBWORK'] as const).map((o) => (
          <button key={o} type="button" className={`chip ${ownership === o ? 'is-active' : ''}`} onClick={() => setOwnership(o)}>
            {o === 'OWN' ? 'Own purchase' : 'Job-work'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Green kg" value={greenWeightKg} onChange={(e) => setGreen(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Moisture %" value={currentMoisture} onChange={(e) => setMoisture(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      </div>

      <select className="biz-select" value={grade} onChange={(e) => setGrade(e.target.value as Grade | '')}>
        <option value="">Expected grade (optional)…</option>
        {prices.map((p) => (
          <option key={p.grade} value={p.grade}>{GRADE_LABEL[p.grade] ?? p.grade} · sell ₹{p.sellRatePerKg}/kg</option>
        ))}
      </select>
      {estDried != null && gradePrice && (
        <p className="detail-sub" style={{ padding: '0 4px' }}>
          Est. dried ≈ <strong>{estDried} kg</strong> ({Math.round(gradePrice.yieldRatio * 100)}% yield) · sell ₹{gradePrice.sellRatePerKg}/kg · cost ₹{gradePrice.costRatePerKg}/kg
        </p>
      )}

      <input
        className="biz-input"
        placeholder={ownership === 'OWN' ? 'Rate ₹/kg green (paid to farmer)' : 'Curing charge ₹/kg'}
        value={rate}
        onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
        inputMode="decimal"
      />
      <Button type="submit" disabled={!valid || busy}>{busy ? 'Creating…' : 'Create batch'}</Button>
    </form>
  )
}

const GRADES = Object.keys(GRADE_LABEL) as Grade[]

function BatchEditForm({ batch, onSave, onCancel }: { batch: Batch; onSave: (patch: Partial<Batch>) => void; onCancel: () => void }) {
  const [lotCode, setLotCode] = useState(batch.lotCode)
  const [farmerName, setFarmerName] = useState(batch.farmerName)
  const [village, setVillage] = useState(batch.village)
  const [greenWeightKg, setGreen] = useState(String(batch.greenWeightKg))
  const [driedWeightKg, setDried] = useState(batch.driedWeightKg != null ? String(batch.driedWeightKg) : '')
  const [currentMoisture, setMoisture] = useState(String(batch.currentMoisture))
  const [ratePerKg, setRate] = useState(String(batch.ratePerKg))
  const [grade, setGrade] = useState<Grade | ''>(batch.grade ?? '')
  const [note, setNote] = useState(batch.note ?? '')

  const dried = Number(driedWeightKg)
  const yieldPct = dried > 0 && Number(greenWeightKg) > 0 ? Math.round((dried / Number(greenWeightKg)) * 100) : null

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      lotCode: lotCode.trim(),
      farmerName: farmerName.trim(),
      village: village.trim(),
      greenWeightKg: Number(greenWeightKg) || 0,
      driedWeightKg: driedWeightKg === '' ? 0 : Number(driedWeightKg),
      currentMoisture: Number(currentMoisture) || 0,
      ratePerKg: Number(ratePerKg) || 0,
      grade: grade === '' ? undefined : grade,
      note,
    })
  }

  return (
    <form className="card biz-form" onSubmit={submit}>
      <p className="team-form-title">Edit batch</p>
      <input className="biz-input" placeholder="Lot code" value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
      <input className="biz-input" placeholder="Farmer name" value={farmerName} onChange={(e) => setFarmerName(e.target.value)} />
      <input className="biz-input" placeholder="Village" value={village} onChange={(e) => setVillage(e.target.value)} />
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Green kg" value={greenWeightKg} onChange={(e) => setGreen(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Dried kg (actual)" value={driedWeightKg} onChange={(e) => setDried(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      </div>
      {yieldPct != null && <p className="detail-sub" style={{ padding: '0 4px' }}>Actual yield: {yieldPct}%</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Moisture %" value={currentMoisture} onChange={(e) => setMoisture(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Rate ₹/kg" value={ratePerKg} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      </div>
      <select className="biz-select" value={grade} onChange={(e) => setGrade(e.target.value as Grade | '')}>
        <option value="">Not graded (optional)</option>
        {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
      </select>
      <input className="biz-input" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ display: 'flex', gap: 12 }}>
        <Button type="submit">Save batch</Button>
        <Button type="button" variant="light" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

const NEXT_ACTION: Partial<Record<Batch['stage'], string>> = {
  INTAKE: 'Load into chamber',
  DRYING: 'Move to curing',
  CURING: 'Unload for grading',
  GRADING: 'Confirm grade & bag',
  READY: 'Mark dispatched',
}

export function BatchDetail({ batch }: { batch: Batch }) {
  const advanceBatch = useDryo((state) => state.advanceBatch)
  const updateBatch = useDryo((state) => state.updateBatch)
  const chambers = useDryo((state) => state.chambers)
  const [editing, setEditing] = useState(false)
  const chamber = chambers.find((item) => item.id === batch.chamberId)
  const currentIndex = STAGE_ORDER.indexOf(batch.stage)
  const yieldPct = batch.driedWeightKg ? Math.round((batch.driedWeightKg / batch.greenWeightKg) * 100) : null
  const action = NEXT_ACTION[batch.stage]

  // Grading is optional (farmer's choice) — from CURING you can skip straight to READY.
  function skipGrading() {
    advanceBatch(batch.id) // CURING → GRADING (frees chamber, sets dried weight)
    advanceBatch(batch.id) // GRADING → READY (ungraded)
  }

  return (
    <div className="detail-scroll">
      <div className="detail-head">
        <div>
          <p className="eyebrow">Lot {batch.lotCode}</p>
          <h2>{batch.farmerName}</h2>
          <p className="detail-sub">{batch.village}{batch.ownership === 'JOBWORK' ? ' · Job-work' : ''}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <Pill tone={stageTone(batch.stage)}>{STAGE_LABEL[batch.stage]}</Pill>
          <button type="button" className="chip" onClick={() => setEditing((v) => !v)}>
            <Pencil size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Edit
          </button>
        </div>
      </div>

      {editing && (
        <BatchEditForm
          batch={batch}
          onSave={(patch) => { updateBatch(batch.id, patch); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!editing && batch.note && <StatusBanner tone={batch.stage === 'DRYING' ? 'warning' : 'neutral'}>{batch.note}</StatusBanner>}

      <div className="card">
        <div className="field-grid">
          <div className="field"><small>Green weight</small><strong><Weight kg={batch.greenWeightKg} size="sm" /></strong></div>
          <div className="field"><small>Dried weight</small><strong>{batch.driedWeightKg ? <Weight kg={batch.driedWeightKg} size="sm" /> : '—'}</strong></div>
          <div className="field"><small>Yield</small><strong>{yieldPct ? `${yieldPct}%` : '—'}</strong></div>
          <div className="field"><small>Rate</small><strong>₹{batch.ratePerKg.toLocaleString('en-IN')}/kg</strong></div>
          <div className="field"><small>Grade</small><strong>{batch.grade ? GRADE_LABEL[batch.grade] : 'Pending'}</strong></div>
          <div className="field"><small>Chamber</small><strong>{chamber ? chamber.name : '—'}</strong></div>
        </div>
      </div>

      <div className="card">
        <Gauge
          label="Moisture"
          value={batch.currentMoisture}
          max={80}
          display={`${batch.currentMoisture}% → ${batch.targetMoisture}%`}
          tone={batch.currentMoisture <= batch.targetMoisture + 2 ? 'positive' : 'warning'}
        />
      </div>

      <SectionHeader title="Lifecycle" />
      <div className="timeline">
        {STAGE_ORDER.map((stage, index) => (
          <div key={stage} className={`timeline-step ${index < currentIndex ? 'is-done' : ''} ${index === currentIndex ? 'is-current' : ''}`}>
            <div className="timeline-step-copy">
              <span className="timeline-step-title">{STAGE_LABEL[stage]}</span>
              <span className="timeline-step-meta">
                {index === 0 ? clockTime(batch.startedAt) : index < currentIndex ? 'Completed' : index === currentIndex ? 'In progress' : 'Pending'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {action && (
        <div className="sticky-action">
          <Button onClick={() => advanceBatch(batch.id)}>{action}</Button>
          {batch.stage === 'CURING' && (
            <Button variant="light" onClick={skipGrading} style={{ marginTop: 10 }}>Skip grading → Ready</Button>
          )}
        </div>
      )}
    </div>
  )
}
