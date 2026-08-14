import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Droplets, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Batch, Farmer, Grade, GradePrice, ServiceAddon } from '../shared/contracts'
import { GRADE_LABEL, STAGE_LABEL, STAGE_ORDER } from '../shared/contracts'
import { clockTime, stageTone } from '../shared/format'
import { dryoApi } from '../api/dryo'
import { ApiError } from '../api/client'
import { useDryo, type NewBatchInput } from '../app/store'
import { Button, ListRow, Pill, ScreenHeading, SectionHeader, StatusBanner, Weight } from '../shared/ui/components'
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
            subtitle={`${batch.village} · ${batch.greenWeightKg} kg green${batch.grade ? ` · ${batch.grade}` : ''}${batch.stage === 'INTAKE' && batch.scheduledFor ? ` · 📅 ${new Date(batch.scheduledFor).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}`}
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
  const [scheduleFor, setScheduleFor] = useState('')
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [defaultCuring, setDefaultCuring] = useState(0)
  const [defaultPurchase, setDefaultPurchase] = useState(0)
  const chambers = useDryo((s) => s.chambers)
  const idleChambers = chambers.filter((c) => c.status === 'IDLE')

  useEffect(() => {
    dryoApi.listPricing().then(setPrices).catch(() => setPrices([]))
    dryoApi.listAddons().then((a) => setAddons(a.filter((x) => x.active))).catch(() => setAddons([]))
    // Pre-fill the rate from the house defaults (Pricing → Rates). Ownership
    // starts on OWN, so seed the green purchase rate.
    dryoApi.getSettings().then((s) => {
      setDefaultCuring(s.defaultCuringRatePerKg || 0)
      setDefaultPurchase(s.defaultPurchaseRatePerKg || 0)
      if (s.defaultPurchaseRatePerKg > 0) setRate((r) => r || String(s.defaultPurchaseRatePerKg))
    }).catch(() => undefined)
  }, [])

  const greenKg = Number(greenWeightKg) || 0

  function pickOwnership(o: 'OWN' | 'JOBWORK') {
    setOwnership(o)
    // Pre-fill the rate from the matching house default, if the field is untouched.
    if (!rate) {
      if (o === 'JOBWORK' && defaultCuring > 0) setRate(String(defaultCuring))
      if (o === 'OWN' && defaultPurchase > 0) setRate(String(defaultPurchase))
    }
  }

  function onGradePick(p: GradePrice | null) {
    setGrade(p ? (p.grade as Grade) : '')
  }

  const gradePrice = prices.find((p) => p.grade === grade)
  const estDried = gradePrice && greenKg > 0 ? Math.round(greenKg * gradePrice.yieldRatio) : null
  // Add-ons are billed on the DRIED weight, after drying — this is an estimate.
  const addonCharge = (a: ServiceAddon) => (a.perKg ? Math.round(a.rate * (estDried ?? 0)) : a.rate)
  const addonsEst = selectedAddons.reduce((sum, id) => {
    const a = addons.find((x) => x.id === id)
    return a ? sum + addonCharge(a) : sum
  }, 0)
  const valid = lotCode.trim().length > 0 && !!farmer && greenKg > 0

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
      addonIds: selectedAddons,
      scheduledFor: !chamberSel && scheduleFor ? scheduleFor : undefined,
    })
  }

  return (
    <form className="biz-form" onSubmit={submit}>
      <input className="biz-input" placeholder="Lot code" value={lotCode} onChange={(e) => setLotCode(e.target.value)} />

      <FarmerPicker value={farmer} onChange={setFarmer} />

      <div className="chip-row" style={{ padding: '2px 0' }}>
        {(['OWN', 'JOBWORK'] as const).map((o) => (
          <button key={o} type="button" className={`chip ${ownership === o ? 'is-active' : ''}`} onClick={() => pickOwnership(o)}>
            {o === 'OWN' ? 'Own purchase' : 'Job-work'}
          </button>
        ))}
      </div>
      <p className="detail-sub" style={{ padding: '0 4px' }}>
        {ownership === 'OWN'
          ? 'You buy the green from the farmer and keep the dried stock to sell.'
          : "The farmer's own cardamom — you only cure it and charge per kg (goods go back to the farmer)."}
      </p>

      <div style={{ display: 'flex', gap: 12 }}>
        <label className="biz-field"><span>Green kg</span>
          <input className="biz-input" placeholder="e.g. 560" value={greenWeightKg} onChange={(e) => setGreen(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        </label>
        <label className="biz-field"><span>Moisture %</span>
          <input className="biz-input" placeholder="72" value={currentMoisture} onChange={(e) => setMoisture(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        </label>
      </div>

      <GradePicker value={grade} prices={prices} onChange={onGradePick} />
      {estDried != null && gradePrice && (
        <p className="detail-sub" style={{ padding: '0 4px' }}>
          Est. dried ≈ <strong>{estDried} kg</strong> ({Math.round(gradePrice.yieldRatio * 100)}% yield) · sell ₹{gradePrice.sellRatePerKg}/kg · cost ₹{gradePrice.costRatePerKg}/kg
        </p>
      )}

      <label className="biz-field">
        <span>{ownership === 'OWN' ? 'Rate ₹/kg green (paid to farmer)' : 'Curing charge ₹/kg'}</span>
        <input
          className="biz-input"
          placeholder={ownership === 'OWN' ? 'e.g. 450' : 'e.g. 30'}
          value={rate}
          onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
        />
      </label>
      {ownership === 'OWN' && greenKg > 0 && Number(rate) > 0 && (
        <p className="detail-sub" style={{ padding: '0 4px' }}>
          Total payable to farmer: <strong>₹{Math.round(greenKg * Number(rate)).toLocaleString('en-IN')}</strong> ({greenKg} kg × ₹{rate})
        </p>
      )}
      {ownership === 'JOBWORK' && greenKg > 0 && Number(rate) > 0 && (
        <p className="detail-sub" style={{ padding: '0 4px' }}>
          Curing charge: <strong>₹{Math.round(greenKg * Number(rate)).toLocaleString('en-IN')}</strong> ({greenKg} kg × ₹{rate})
        </p>
      )}

      <select className="biz-select" value={chamberSel} onChange={(e) => setChamberSel(e.target.value)}>
        <option value="">Load into chamber later…</option>
        {idleChambers.length === 0 && <option value="" disabled>No idle chamber free right now</option>}
        {idleChambers.map((c) => {
          const free = Math.round(c.capacityKg - c.loadKg)
          return <option key={c.id} value={c.id}>{c.name} · {free} kg free{greenKg > free ? ' — over capacity' : ''}</option>
        })}
      </select>

      {!chamberSel && (
        <label className="biz-field">
          <span>Schedule drying for (optional — when a chamber frees up)</span>
          <input type="date" className="biz-input" value={scheduleFor} onChange={(e) => setScheduleFor(e.target.value)} />
        </label>
      )}

      {addons.length > 0 ? (
        <>
          <div className="chip-row" style={{ padding: '2px 0', flexWrap: 'wrap' }}>
            {addons.map((a) => {
              const on = selectedAddons.includes(a.id)
              return (
                <button key={a.id} type="button" className={`chip ${on ? 'is-active' : ''}`}
                  onClick={() => setSelectedAddons((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}>
                  {on ? '✓ ' : '＋ '}{a.name}
                </button>
              )
            })}
          </div>
          {selectedAddons.length > 0 && (
            <p className="detail-sub" style={{ padding: '0 4px' }}>
              Add-ons charged after drying on the dried weight{estDried != null ? ` ≈ ₹${addonsEst.toLocaleString('en-IN')} (est. ${estDried} kg dried)` : ''}.
            </p>
          )}
        </>
      ) : (
        <p className="detail-sub" style={{ padding: '0 4px' }}>Add paid services (e.g. Grading) on <strong>Pricing → Add-ons</strong> to apply them here.</p>
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
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [selectedAddons, setSelectedAddons] = useState<string[]>(batch.addonIds ?? [])
  const [note, setNote] = useState(batch.note ?? '')

  useEffect(() => { dryoApi.listAddons().then((a) => setAddons(a.filter((x) => x.active))).catch(() => setAddons([])) }, [])

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
      addonIds: selectedAddons,
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
      {addons.length > 0 && (
        <div className="chip-row" style={{ padding: '2px 0', flexWrap: 'wrap' }}>
          {addons.map((a) => {
            const on = selectedAddons.includes(a.id)
            return (
              <button key={a.id} type="button" className={`chip ${on ? 'is-active' : ''}`}
                onClick={() => setSelectedAddons((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}>
                {on ? '✓ ' : '＋ '}{a.name}
              </button>
            )
          })}
        </div>
      )}
      {batch.gradingCharge ? <p className="detail-sub" style={{ padding: '0 4px' }}>Billed add-ons: ₹{batch.gradingCharge.toLocaleString('en-IN')}</p> : null}
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

export function BatchDetail({ batch, canManage = false, onDeleted }: { batch: Batch; canManage?: boolean; onDeleted?: () => void }) {
  const advanceBatch = useDryo((state) => state.advanceBatch)
  const updateBatch = useDryo((state) => state.updateBatch)
  const setBatchPaid = useDryo((state) => state.setBatchPaid)
  const loadBatchIntoChamber = useDryo((state) => state.loadBatchIntoChamber)
  const chambers = useDryo((state) => state.chambers)
  const [editing, setEditing] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete lot ${batch.lotCode}? This reverses its ledger entries and frees its chamber. Cannot be undone.`)) return
    try {
      await dryoApi.deleteBatch(batch.id)
      onDeleted?.()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Could not delete lot.')
    }
  }
  const [loadChamberSel, setLoadChamberSel] = useState('')
  const [loadKg, setLoadKg] = useState('')
  const [scheduleDate, setScheduleDate] = useState(batch.scheduledFor ?? '')
  const idleChambers = chambers.filter((c) => c.status === 'IDLE')

  // Default the load amount to fill the chosen chamber (or the whole lot if smaller).
  function pickLoadChamber(id: string) {
    setLoadChamberSel(id)
    const c = idleChambers.find((x) => x.id === id)
    if (c) setLoadKg(String(Math.min(Math.round(batch.greenWeightKg), Math.round(c.capacityKg - c.loadKg))))
  }
  const selChamber = idleChambers.find((c) => c.id === loadChamberSel)
  const freeKg = selChamber ? Math.round(selChamber.capacityKg - selChamber.loadKg) : 0
  const loadRemainder = Math.max(0, Math.round(batch.greenWeightKg - (Number(loadKg) || 0)))
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
          {canManage && (
            <button type="button" className="chip" onClick={handleDelete} aria-label="Delete lot">
              <Trash2 size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />Delete
            </button>
          )}
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
      {batch.stage === 'INTAKE' && batch.scheduledFor && (
        <StatusBanner tone="neutral">📅 Scheduled to dry on {new Date(batch.scheduledFor).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.</StatusBanner>
      )}

      <div className="card">
        <div className="field-grid">
          <div className="field"><small>Green weight</small><strong><Weight kg={batch.greenWeightKg} size="sm" /></strong></div>
          <div className="field"><small>Dried weight</small><strong>{batch.driedWeightKg ? <Weight kg={batch.driedWeightKg} size="sm" /> : '—'}</strong></div>
          <div className="field"><small>Yield</small><strong>{yieldPct ? `${yieldPct}%` : '—'}</strong></div>
          <div className="field"><small>Rate</small><strong>₹{batch.ratePerKg.toLocaleString('en-IN')}/kg</strong></div>
          <div className="field"><small>Grade</small><strong>{batch.grade ? GRADE_LABEL[batch.grade] : 'Pending'}</strong></div>
          <div className="field"><small>Chamber</small><strong>{chamber ? chamber.name : '—'}</strong></div>
          <div className="field"><small>Add-ons</small><strong>{batch.gradingCharge ? `₹${batch.gradingCharge.toLocaleString('en-IN')}` : (batch.addonIds && batch.addonIds.length) ? `${batch.addonIds.length} · after drying` : '—'}</strong></div>
        </div>
      </div>

      {batch.farmerId && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="field">
            <small>Payment</small>
            <strong>{batch.paid ? 'Settled' : batch.ownership === 'JOBWORK' ? 'To collect from farmer' : 'To pay farmer'}</strong>
          </div>
          <button type="button" className={`chip ${batch.paid ? 'is-active' : ''}`} onClick={() => setBatchPaid(batch.id, !batch.paid)}>
            {batch.paid ? '✓ Paid' : 'Mark paid'}
          </button>
        </div>
      )}

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
            <>
              {idleChambers.length > 0 ? (
                <>
                  <select className="biz-select" value={loadChamberSel} onChange={(e) => pickLoadChamber(e.target.value)} style={{ marginBottom: 10 }}>
                    <option value="">Choose a chamber…</option>
                    {idleChambers.map((c) => <option key={c.id} value={c.id}>{c.name} · {Math.round(c.capacityKg - c.loadKg)} kg free</option>)}
                  </select>
                  {loadChamberSel && (
                    <>
                      <input className="biz-input" placeholder="kg to load" value={loadKg} onChange={(e) => setLoadKg(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" style={{ marginBottom: 8 }} />
                      <p className="detail-sub" style={{ padding: '0 4px 10px' }}>
                        {loadRemainder > 0
                          ? `${Number(loadKg) || 0} kg loads now · ${loadRemainder} kg stays as a new lot to load elsewhere.`
                          : `Loading the full lot (${Math.round(batch.greenWeightKg)} kg).`}
                        {Number(loadKg) > freeKg ? ' ⚠ over chamber capacity' : ''}
                      </p>
                    </>
                  )}
                  <Button disabled={!loadChamberSel || !(Number(loadKg) > 0)} onClick={() => loadBatchIntoChamber(batch.id, loadChamberSel, Number(loadKg) || undefined)}>Load into chamber</Button>
                </>
              ) : (
                <StatusBanner tone="warning">No idle chamber free — schedule it for a day below.</StatusBanner>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'stretch' }}>
                <input type="date" className="biz-input" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} style={{ flex: 1 }} />
                <Button variant="light" onClick={() => updateBatch(batch.id, { scheduledFor: scheduleDate })}>{batch.scheduledFor ? 'Reschedule' : 'Schedule'}</Button>
              </div>
            </>
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
