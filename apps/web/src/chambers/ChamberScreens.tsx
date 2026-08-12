import { CalendarClock, Flame, PlayCircle, Power, ThermometerSun, Timer, TriangleAlert, Wind } from 'lucide-react'
import type { Chamber } from '../shared/contracts'
import { CHAMBER_TYPE_LABEL } from '../shared/contracts'
import { chamberTone, clockTime } from '../shared/format'
import { useDryo } from '../app/store'
import { Button, Gauge, ListRow, Pill, ScreenHeading, StatusBanner } from '../shared/ui/components'

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

  return (
    <>
      <ScreenHeading eyebrow="Drying floor" title="Chambers" description="Kilns and dryers with live temperature and load." />
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
    </>
  )
}

export function ChamberDetail({ chamber }: { chamber: Chamber }) {
  const toggleChamber = useDryo((state) => state.toggleChamber)
  const batches = useDryo((state) => state.batches)
  const batch = batches.find((item) => item.id === chamber.batchId)
  const overTemp = chamber.targetTempC > 0 && chamber.tempC > chamber.targetTempC + 5

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

      <div className="sticky-action">
        <Button variant={chamber.status === 'IDLE' ? 'full' : 'danger'} onClick={() => toggleChamber(chamber.id)}>
          <Power size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
          {chamber.status === 'FAULT' ? 'Clear fault' : chamber.status === 'IDLE' ? 'Start heating' : 'Stop chamber'}
        </Button>
      </div>
    </div>
  )
}
