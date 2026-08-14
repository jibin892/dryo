import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Droplets, Pencil, Plus } from 'lucide-react'
import type { Batch, Farmer, Grade, GradePrice } from '../shared/contracts'
import { GRADE_LABEL, STAGE_LABEL, STAGE_ORDER } from '../shared/contracts'
import { clockTime, stageTone } from '../shared/format'
import { dryoApi } from '../api/dryo'
import { useDryo, type NewBatchInput } from '../app/store'
import { Button, Gauge, ListRow, Pill, ScreenHeading, SectionHeader, StatusBanner, Weight } from '../shared/ui/components'
import { BottomSheet } from '../shared/ui/BottomSheet'
import { FarmerPicker } from '../shared/ui/FarmerPicker'
import { GradePicker } from '../shared/ui/GradePicker'
import '../business/business.css'

const FILTERS = ['Active', 'Intake', 'Ready', 'All'] as const
type Filter = (typeof FILTERS)[number]

function matchesFilter(batch: Batch, filter: Filter): boolean {
  if (filter === 'All') return true
  if (filter === 'Intake') return batch.stage === 'INTAKE'
  if (filter === 'Ready') return batch.stage === 'READY' || batch.stage === 'GRADING'
  return batch.stage === 'INTAKE' || batch.stage === 'DRYING' || batch.stage === 'CURING'
}

export function BatchesScreen({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const batches = useDryo((state) => state.batches)
  const createBatch = useDryo((state) => state.createBatch)
  const [filter, setFilter] = useState<Filter>('Active')
  const [adding, setAdding] = useState(false)
  const visible = useMemo(() => batches.filter((batch) => matchesFilter(batch, filter)), [batches, filter])

  const awaiting = useMemo(() => batches.filter((b) => b.stage === 'INTAKE'), [batches])
  const awaitingKg = awaiting.reduce((sum, b) => sum + b.greenWeightKg, 0)

  return (
    <>
      <ScreenHeading eyebrow="Traceable lots" title="Batches" description="Every lot from green weigh-in to dispatch. Add a lot, then load it into a chamber to start drying." />

      {awaiting.length > 0 && (
        <StatusBanner tone="warning">
          {awaiting.length} lot{awaiting.length > 1 ? 's' : ''} awaiting a chamber · {awaitingKg.toLocaleString('en-IN')} kg green. Open one to load it.
        </StatusBanner>
      )}

      <div className="section-header">
        <h2>New lot</h2>
        <button className="chip" type="button" onClick={() => setAdding((v) => !v)}>
          <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New lot
        </button>
      </div>
      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New lot">
        <NewBatch
          suggestedLot={`VDM-${1046 + batches.filter((b) => b.lotCode.startsWith('VDM-')).length}`}
          onCreate={(input) => { createBatch(input); setAdding(false) }}
        />
      </BottomSheet>

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
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [lotCode, setLotCode] = useState(suggestedLot)
  const [ownership, setOwnership] = useState<'OWN' | 'JOBWORK'>('OWN')
  const [greenWeightKg, setGreen] = useState('')
  const [currentMoisture, setMoisture] = useState('72')
  const [rate, setRate] = useState('')
  const [prices, setPrices] = useState<GradePrice[]>([])
  const [grade, setGrade] = useState<Grade | ''>('')
  const [note, setNote] = useState('')
  const [chamberSel, setChamberSel] = useState('')
  const [gradingOn, setGradingOn] = useState(false)
  const [gradingPerKg, setGradingPerKg] = useState(true)
  const [gradingRate, setGradingRate] = useState('')
  const chambers = useDryo((s) => s.chambers)
  const idleChambers = chambers.filter((c) => c.status === 'IDLE')

  useEffect(() => {
    dryoApi.listPricing().then(setPrices).catch(() => setPrices([]))
    // Pre-fill the grading add-on from its central price, if one is set.
    dryoApi.listAddons().then((addons) => {
      const g = addons.find((a) => a.id === 'addon-grading' || a.name.toLowerCase() === 'grading')
      if (g) {
        setGradingPerKg(g.perKg)
        if (g.rate > 0) setGradingRate(String(g.rate))
      }
    }).catch(() => undefined)
  }, [])

  const greenKg = Number(greenWeightKg) || 0
  const gradingCharge = gradingOn ? (gradingPerKg ? Math.round((Number(gradingRate) || 0) * greenKg) : Number(gradingRate) || 0) : 0

  // Picking a grade auto-fills the green rate: dried cost × yield ≈ what the
  // green is worth per kg (own-purchase only; job-work uses a curing charge).
  function onGradePick(p: GradePrice | null) {
    setGrade(p ? (p.grade as Grade) : '')
    if (p && ownership === 'OWN') setRate(String(Math.round(p.costRatePerKg * p.yieldRatio)))
  }

  const gradePrice = prices.find((p) => p.grade === grade)
  const estDried = gradePrice && Number(greenWeightKg) > 0 ? Math.round(Number(greenWeightKg) * gradePrice.yieldRatio) : null
  const valid = lotCode.trim().length > 0 && !!farmer && Number(greenWeightKg) > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!farmer) return
    const value = Number(rate) || 0
    onCreate({
      lotCode: lotCode.trim(),
      farmerName: farmer.name,
      village: farmer.village,
      farmerId: farmer.id,
      greenWeightKg: Number(greenWeightKg),
      currentMoisture: Number(currentMoisture) || 72,
      ratePerKg: ownership === 'OWN' ? value : 0,
      curingRatePerKg: ownership === 'JOBWORK' ? value : 0,
      ownership,
      grade: grade || undefined,
      note: note.trim() || undefined,
      chamberId: chamberSel || undefined,
      gradingCharge,
    })
  }

  return (
    <form className="biz-form" onSubmit={submit}>
      <input className="biz-input" placeholder="Lot code" value={lotCode} onChange={(e) => setLotCode(e.target.value)} />

      <FarmerPicker value={farmer} onChange={setFarmer} />

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

      <GradePicker value={grade} prices={prices} greenKg={Number(greenWeightKg) || 0} onChange={onGradePick} />
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
      {ownership === 'OWN' && gradePrice && (
        <p className="detail-sub" style={{ padding: '0 4px' }}>
          Suggested green rate ₹{Math.round(gradePrice.costRatePerKg * gradePrice.yieldRatio).toLocaleString('en-IN')}/kg = cost ₹{gradePrice.costRatePerKg}/kg × {Math.round(gradePrice.yieldRatio * 100)}% yield. Edit if you paid differently.
        </p>
      )}
      {ownership === 'OWN' && Number(greenWeightKg) > 0 && Number(rate) > 0 && (
        <p className="detail-sub" style={{ padding: '0 4px' }}>
          Total payable to farmer: <strong>₹{(Number(greenWeightKg) * Number(rate)).toLocaleString('en-IN')}</strong> ({greenWeightKg} kg × ₹{rate})
        </p>
      )}

      <select className="biz-select" value={chamberSel} onChange={(e) => setChamberSel(e.target.value)}>
        <option value="">Load into chamber later…</option>
        {idleChambers.length === 0 && <option value="" disabled>No idle chamber free right now</option>}
        {idleChambers.map((c) => (
          <option key={c.id} value={c.id}>{c.name} · {c.capacityKg} kg capacity{greenKg > c.capacityKg ? ' — over capacity' : ''}</option>
        ))}
      </select>

      <div className="chip-row" style={{ padding: '2px 0' }}>
        <button type="button" className={`chip ${gradingOn ? 'is-active' : ''}`} onClick={() => setGradingOn((v) => !v)}>
          {gradingOn ? '✓ ' : '＋ '}Grading add-on
        </button>
      </div>
      {gradingOn && (
        <>
          <div className="chip-row" style={{ padding: '2px 0' }}>
            <button type="button" className={`chip ${gradingPerKg ? 'is-active' : ''}`} onClick={() => setGradingPerKg(true)}>Per kg</button>
            <button type="button" className={`chip ${!gradingPerKg ? 'is-active' : ''}`} onClick={() => setGradingPerKg(false)}>Flat charge</button>
          </div>
          <input className="biz-input" placeholder={gradingPerKg ? 'Grading ₹ / kg' : 'Grading flat ₹'} value={gradingRate} onChange={(e) => setGradingRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
          {greenKg > 0 && Number(gradingRate) > 0 && (
            <p className="detail-sub" style={{ padding: '0 4px' }}>
              Grading charge: <strong>₹{gradingCharge.toLocaleString('en-IN')}</strong>{gradingPerKg ? ` (${greenKg} kg × ₹${gradingRate})` : ''}
            </p>
          )}
        </>
      )}

      <input className="biz-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

      <Button type="submit" disabled={!valid}>Create batch</Button>
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
  const [gradingCharge, setGradingCharge] = useState(batch.gradingCharge ? String(batch.gradingCharge) : '')
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
      gradingCharge: gradingCharge === '' ? 0 : Number(gradingCharge),
      note,
    })
  }

  return (
    <form className="biz-form" onSubmit={submit}>
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
      <input className="biz-input" placeholder="Grading charge ₹ (add-on, separate from drying)" value={gradingCharge} onChange={(e) => setGradingCharge(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
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
  const loadBatchIntoChamber = useDryo((state) => state.loadBatchIntoChamber)
  const chambers = useDryo((state) => state.chambers)
  const [editing, setEditing] = useState(false)
  const [loadChamberSel, setLoadChamberSel] = useState('')
  const idleChambers = chambers.filter((c) => c.status === 'IDLE')
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

      <BottomSheet open={editing} onClose={() => setEditing(false)} title="Edit batch">
        <BatchEditForm
          batch={batch}
          onSave={(patch) => { updateBatch(batch.id, patch); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      </BottomSheet>

      {batch.note && <StatusBanner tone={batch.stage === 'DRYING' ? 'warning' : 'neutral'}>{batch.note}</StatusBanner>}

      <div className="card">
        <div className="field-grid">
          <div className="field"><small>Green weight</small><strong><Weight kg={batch.greenWeightKg} size="sm" /></strong></div>
          <div className="field"><small>Dried weight</small><strong>{batch.driedWeightKg ? <Weight kg={batch.driedWeightKg} size="sm" /> : '—'}</strong></div>
          <div className="field"><small>Yield</small><strong>{yieldPct ? `${yieldPct}%` : '—'}</strong></div>
          <div className="field"><small>Rate</small><strong>₹{batch.ratePerKg.toLocaleString('en-IN')}/kg</strong></div>
          <div className="field"><small>Grade</small><strong>{batch.grade ? GRADE_LABEL[batch.grade] : 'Pending'}</strong></div>
          <div className="field"><small>Chamber</small><strong>{chamber ? chamber.name : '—'}</strong></div>
          <div className="field"><small>Grading add-on</small><strong>{batch.gradingCharge ? `₹${batch.gradingCharge.toLocaleString('en-IN')}` : '—'}</strong></div>
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
          {batch.stage === 'INTAKE' ? (
            idleChambers.length > 0 ? (
              <>
                <select className="biz-select" value={loadChamberSel} onChange={(e) => setLoadChamberSel(e.target.value)} style={{ marginBottom: 10 }}>
                  <option value="">Choose a chamber…</option>
                  {idleChambers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button disabled={!loadChamberSel} onClick={() => loadBatchIntoChamber(batch.id, loadChamberSel)}>Load into chamber</Button>
              </>
            ) : (
              <StatusBanner tone="warning">No idle chamber available — free one first.</StatusBanner>
            )
          ) : (
            <>
              <Button onClick={() => advanceBatch(batch.id)}>{action}</Button>
              {batch.stage === 'CURING' && (
                <Button variant="light" onClick={skipGrading} style={{ marginTop: 10 }}>Skip grading → Ready</Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
