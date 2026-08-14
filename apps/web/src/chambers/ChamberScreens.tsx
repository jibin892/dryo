import { useEffect, useState, type FormEvent } from 'react'
import { Boxes, CalendarClock, CheckCircle2, Coins, Droplets, Flame, PlayCircle, Plus, Power, Receipt, ThermometerSun, Timer, TriangleAlert, Wind } from 'lucide-react'
import type { Chamber, ChamberDetailData, ChamberType } from '../shared/contracts'
import { CHAMBER_TYPE_LABEL } from '../shared/contracts'
import { chamberTone, clockTime } from '../shared/format'
import { dryoApi } from '../api/dryo'
import { useDryo, type NewChamberInput } from '../app/store'
import { Button, Gauge, ListRow, Pill, ScreenHeading, SectionHeader, StatCard, StatusBanner } from '../shared/ui/components'
import { BottomSheet } from '../shared/ui/BottomSheet'
import { money } from '../business/FarmersScreen'
import '../business/business.css'

const dayTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const runHours = (loadedAt: string, releasedAt: string | null) => ((releasedAt ? new Date(releasedAt).getTime() : Date.now()) - new Date(loadedAt).getTime()) / 3_600_000
const EXPENSE_CATEGORIES = ['Electricity', 'Firewood', 'Labour', 'Maintenance', 'Other']

const CHAMBER_TYPES: ChamberType[] = ['FLUE_KILN', 'ELECTRIC', 'SOLAR_BIOMASS']

function NewChamber({ onCreate }: { onCreate: (input: NewChamberInput) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ChamberType>('FLUE_KILN')
  const [capacityKg, setCap] = useState('')
  const [targetTempC, setTarget] = useState('55')
  const [cycleHours, setCycle] = useState('24')
  const valid = name.trim().length > 0 && Number(capacityKg) > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    onCreate({ name: name.trim(), type, capacityKg: Number(capacityKg), targetTempC: Number(targetTempC) || 0, cycleHours: Number(cycleHours) || 24 })
  }

  return (
    <form className="biz-form" onSubmit={submit}>
      <input className="biz-input" placeholder="Chamber name (e.g. Kiln C)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <select className="biz-select" value={type} onChange={(e) => setType(e.target.value as ChamberType)}>
        {CHAMBER_TYPES.map((t) => <option key={t} value={t}>{CHAMBER_TYPE_LABEL[t]}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 12 }}>
        <input className="biz-input" placeholder="Capacity kg" value={capacityKg} onChange={(e) => setCap(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
        <input className="biz-input" placeholder="Target °C" value={targetTempC} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      </div>
      <input className="biz-input" placeholder="Cycle hours" value={cycleHours} onChange={(e) => setCycle(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" />
      <Button type="submit" disabled={!valid}>Add chamber</Button>
    </form>
  )
}

const STATUS_LABEL: Record<Chamber['status'], string> = {
  IDLE: 'Idle',
  HEATING: 'Heating',
  DRYING: 'Drying',
  CURING: 'Curing',
  COOLING: 'Cooling',
  FAULT: 'Fault',
}

export function ChambersScreen({ selectedId, onSelect }: { selectedId?: string; onSelect: (id: string) => void }) {
  const chambers = useDryo((state) => state.chambers)
  const createChamber = useDryo((state) => state.createChamber)
  const [adding, setAdding] = useState(false)

  return (
    <>
      <ScreenHeading eyebrow="Drying floor" title="Chambers" description="Kilns and dryers with live temperature and load." />
      <div className="section-header">
        <h2>Chambers{chambers.length ? ` · ${chambers.length}` : ''}</h2>
        <button className="chip" type="button" onClick={() => setAdding(true)}>
          <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />New chamber
        </button>
      </div>
      <div className="list-group">
        {chambers.map((chamber) => (
          <ListRow
            key={chamber.id}
            lead={<Flame aria-hidden="true" size={20} />}
            title={`${chamber.name} · ${chamber.tempC}°C`}
            subtitle={`${CHAMBER_TYPE_LABEL[chamber.type]} · ${chamber.loadKg}/${chamber.capacityKg} kg`}
            value={<Pill tone={chamberTone(chamber.status)}>{STATUS_LABEL[chamber.status]}</Pill>}
            selected={chamber.id === selectedId}
            onClick={() => onSelect(chamber.id)}
          />
        ))}
      </div>

      <BottomSheet open={adding} onClose={() => setAdding(false)} title="New chamber">
        <NewChamber onCreate={(input) => { createChamber(input); setAdding(false) }} />
      </BottomSheet>
    </>
  )
}

function ExpenseForm({ chamberId, onDone }: { chamberId: string; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Electricity')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return
    setBusy(true)
    try {
      await dryoApi.addChamberExpense(chamberId, { amount: Number(amount), category, note: note.trim() })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="biz-form" onSubmit={submit}>
      <div className="chip-row" style={{ padding: '2px 0', flexWrap: 'wrap' }}>
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c} type="button" className={`chip ${category === c ? 'is-active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>
      <input className="biz-input" placeholder="Amount ₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" autoFocus />
      <input className="biz-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" disabled={!(Number(amount) > 0) || busy}>{busy ? 'Saving…' : 'Add expense'}</Button>
    </form>
  )
}

export function ChamberDetail({ chamber }: { chamber: Chamber }) {
  const toggleChamber = useDryo((state) => state.toggleChamber)
  const batches = useDryo((state) => state.batches)
  const batch = batches.find((item) => item.id === chamber.batchId)
  const overTemp = chamber.targetTempC > 0 && chamber.tempC > chamber.targetTempC + 5
  const [detail, setDetail] = useState<ChamberDetailData | null>(null)
  const [addingExp, setAddingExp] = useState(false)

  async function refresh() {
    try {
      setDetail(await dryoApi.chamberDetail(chamber.id))
    } catch {
      // Offline / API down — the live gauges still render from the store.
    }
  }
  useEffect(() => { void refresh() }, [chamber.id])

  const stats = detail?.stats

  return (
    <div className="detail-scroll">
      <div className="detail-head">
        <div>
          <p className="eyebrow">{CHAMBER_TYPE_LABEL[chamber.type]}</p>
          <h2>{chamber.name}</h2>
          <p className="detail-sub">{batch ? `Lot ${batch.lotCode} · ${batch.farmerName}` : 'No batch loaded'}</p>
        </div>
        <Pill tone={chamberTone(chamber.status)}>{STATUS_LABEL[chamber.status]}</Pill>
      </div>

      {chamber.status === 'FAULT' && (
        <StatusBanner tone="critical">
          <TriangleAlert aria-hidden="true" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Over-temperature cut-off engaged. Clear the fault, inspect the flue damper, then restart.
        </StatusBanner>
      )}

      <div className="card" style={{ display: 'grid', gap: 18 }}>
        <Gauge
          label="Temperature"
          value={chamber.tempC}
          max={80}
          display={`${chamber.tempC}°C${chamber.targetTempC ? ` / ${chamber.targetTempC}°C` : ''}`}
          tone={overTemp ? 'critical' : chamber.status === 'IDLE' ? 'neutral' : 'positive'}
        />
        <Gauge label="Humidity" value={chamber.humidity} max={100} display={`${chamber.humidity}%`} tone="neutral" />
        <Gauge
          label="Load"
          value={chamber.loadKg}
          max={chamber.capacityKg}
          display={`${chamber.loadKg} / ${chamber.capacityKg} kg`}
          tone="neutral"
        />
      </div>

      {chamber.startedAt && (() => {
        const start = new Date(chamber.startedAt)
        const end = new Date(start.getTime() + chamber.cycleHours * 3600_000)
        const remainingH = Math.max(0, Math.round((end.getTime() - Date.now()) / 3600_000))
        return (
          <div className="card">
            <div className="field-grid">
              <div className="field"><small><PlayCircle size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Started</small><strong>{clockTime(chamber.startedAt)}</strong></div>
              <div className="field"><small><CalendarClock size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Expected end</small><strong>{clockTime(end.toISOString())}</strong></div>
              <div className="field"><small><Timer size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Elapsed</small><strong>{chamber.elapsedHours}h</strong></div>
              <div className="field"><small><Timer size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Remaining</small><strong>~{remainingH}h</strong></div>
            </div>
          </div>
        )
      })()}

      <div className="card">
        <div className="field-grid">
          <div className="field"><small><ThermometerSun size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Target</small><strong>{chamber.targetTempC ? `${chamber.targetTempC}°C` : '—'}</strong></div>
          <div className="field"><small><Wind size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Humidity</small><strong>{chamber.humidity}%</strong></div>
          <div className="field"><small><ThermometerSun size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Type</small><strong>{CHAMBER_TYPE_LABEL[chamber.type]}</strong></div>
          <div className="field"><small><Timer size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />Cycle</small><strong>{chamber.cycleHours}h</strong></div>
        </div>
      </div>

      {stats && (
        <>
          <SectionHeader title="Lifetime" />
          <div className="stat-grid">
            <StatCard label="Hours run" value={Math.round(stats.totalRunHours)} unit="h" icon={Timer} accent />
            <StatCard label="Batches done" value={stats.batchesCompleted} icon={CheckCircle2} />
            <StatCard label="Green in" value={Math.round(stats.greenProcessedKg)} unit="kg" icon={Boxes} />
            <StatCard label="Dried out" value={Math.round(stats.driedProducedKg)} unit="kg" icon={Droplets} />
          </div>
          <div className="card">
            <div className="field-grid">
              <div className="field"><small>Avg yield</small><strong>{stats.avgYieldPct ? `${Math.round(stats.avgYieldPct)}%` : '—'}</strong></div>
              <div className="field"><small>Current load</small><strong>{Math.round(stats.loadPct)}%</strong></div>
              <div className="field"><small>Batches (all)</small><strong>{stats.batchesTotal}</strong></div>
              <div className="field"><small>Total expenses</small><strong>{money(stats.expenseTotal)}</strong></div>
            </div>
          </div>
        </>
      )}

      <div className="section-header">
        <h2>Expenses</h2>
        <button className="chip" type="button" onClick={() => setAddingExp(true)}>
          <Plus size={15} style={{ verticalAlign: '-2px', marginRight: 4 }} />Add expense
        </button>
      </div>
      <BottomSheet open={addingExp} onClose={() => setAddingExp(false)} title="New chamber expense">
        <ExpenseForm chamberId={chamber.id} onDone={() => { setAddingExp(false); void refresh() }} />
      </BottomSheet>
      <div className="list-group">
        {detail?.expenses.map((e) => (
          <ListRow
            key={e.id}
            lead={<Coins aria-hidden="true" size={18} />}
            title={e.category || 'Expense'}
            subtitle={`${dayTime(e.spentAt)}${e.note ? ` · ${e.note}` : ''}`}
            value={<span className="list-row-value biz-debit">{money(e.amount)}</span>}
          />
        ))}
        {detail && detail.expenses.length === 0 && <div className="empty-state"><p>No expenses logged for this chamber yet.</p></div>}
      </div>

      <SectionHeader title="Run history" />
      <div className="list-group">
        {detail?.runs.map((run) => {
          const hrs = runHours(run.loadedAt, run.releasedAt)
          return (
            <ListRow
              key={run.id}
              lead={<Receipt aria-hidden="true" size={18} />}
              title={`${run.lotCode} · ${run.farmerName}`}
              subtitle={`${dayTime(run.loadedAt)} · ${hrs < 10 ? hrs.toFixed(1) : Math.round(hrs)}h · ${Math.round(run.greenKg)}${run.driedKg != null ? `→${Math.round(run.driedKg)}` : ''} kg`}
              value={<Pill tone={run.releasedAt ? 'positive' : 'warning'}>{run.releasedAt ? 'Done' : 'Running'}</Pill>}
            />
          )
        })}
        {detail && detail.runs.length === 0 && <div className="empty-state"><p>No runs yet. Load a batch into this chamber to start its history.</p></div>}
      </div>

      <div className="sticky-action">
        <Button variant={chamber.status === 'IDLE' ? 'full' : 'danger'} onClick={() => toggleChamber(chamber.id)}>
          <Power size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {chamber.status === 'FAULT' ? 'Clear fault' : chamber.status === 'IDLE' ? 'Start heating' : 'Stop chamber'}
        </Button>
      </div>
    </div>
  )
}
