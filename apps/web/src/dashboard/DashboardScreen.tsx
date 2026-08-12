import { useEffect, useState } from 'react'
import { Boxes, Coins, Droplets, Flame, PackageCheck, Receipt, ThermometerSun, TrendingUp, TriangleAlert, Wallet } from 'lucide-react'
import type { ReportSummary, Role } from '../shared/contracts'
import { STAGE_LABEL } from '../shared/contracts'
import { chamberTone, stageTone } from '../shared/format'
import { useDryo } from '../app/store'
import { dryoApi } from '../api/dryo'
import { money } from '../business/FarmersScreen'
import { Gauge, ListRow, Pill, ScreenHeading, SectionHeader, StatCard, StatusBanner } from '../shared/ui/components'

function BusinessOverview() {
  const [r, setR] = useState<ReportSummary | null>(null)
  useEffect(() => {
    dryoApi.reportSummary().then(setR).catch(() => setR(null))
  }, [])
  if (!r) return null
  return (
    <>
      <SectionHeader title="Business" />
      <div className="stat-grid">
        <StatCard label="Sales" value={money(r.salesTotal)} icon={Receipt} accent />
        <StatCard label="To pay farmers" value={money(r.payables)} icon={Wallet} />
        <StatCard label="Stock at cost" value={money(r.stockValueAtCost)} icon={Coins} />
        <StatCard label="Avg yield" value={Math.round(r.avgYieldPct)} unit="%" icon={TrendingUp} />
      </div>
    </>
  )
}

export function DashboardScreen({
  role,
  firstName,
  onOpenBatch,
  onOpenChamber,
}: {
  role: Role
  firstName: string
  onOpenBatch: (id: string) => void
  onOpenChamber: (id: string) => void
}) {
  const batches = useDryo((state) => state.batches)
  const chambers = useDryo((state) => state.chambers)
  const inventory = useDryo((state) => state.inventory)

  const activeBatches = batches.filter((batch) => batch.stage === 'DRYING' || batch.stage === 'CURING')
  const inChamber = chambers.filter((chamber) => chamber.status !== 'IDLE').length
  const faults = chambers.filter((chamber) => chamber.status === 'FAULT')
  const readyKg = batches.filter((batch) => batch.stage === 'READY').reduce((sum, batch) => sum + (batch.driedWeightKg ?? 0), 0)
  const storeKg = inventory.reduce((sum, lot) => sum + lot.bulkKg, 0)
  const today = new Date().toISOString().slice(0, 10)
  const greenTodayKg = batches
    .filter((batch) => batch.startedAt.slice(0, 10) === today)
    .reduce((sum, batch) => sum + batch.greenWeightKg, 0)

  return (
    <>
      <ScreenHeading
        eyebrow={role !== 'OPERATOR' ? 'Curing house overview' : 'Drying floor'}
        title={`Good morning, ${firstName}.`}
        description={
          role !== 'OPERATOR'
            ? 'Live view of chambers, batches in cure, and graded stock ready to move.'
            : 'Chambers running now and lots approaching their target moisture.'
        }
      />

      {faults.length > 0 && (
        <StatusBanner tone="critical">
          <TriangleAlert aria-hidden="true" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          {faults[0].name} tripped its over-temperature cut-off. Inspect before reloading.
        </StatusBanner>
      )}

      <div className="stat-grid">
        <StatCard label="In chamber" value={inChamber} unit={`/ ${chambers.length}`} icon={Flame} accent />
        <StatCard label="Green in today" value={greenTodayKg} unit="kg" icon={PackageCheck} />
        <StatCard label="Ready to grade" value={readyKg} unit="kg" icon={Boxes} />
        <StatCard label="In store" value={storeKg} unit="kg" icon={ThermometerSun} />
      </div>

      {role !== 'OPERATOR' && <BusinessOverview />}

      <SectionHeader title="Chambers running" />
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        {chambers
          .filter((chamber) => chamber.status !== 'IDLE')
          .map((chamber) => (
            <Gauge
              key={chamber.id}
              label={`${chamber.name} · ${chamber.tempC}°C`}
              value={chamber.tempC}
              max={80}
              display={`${chamber.tempC}°C`}
              tone={chamberTone(chamber.status)}
            />
          ))}
      </div>

      <SectionHeader title="In cure now" />
      <div className="list-group">
        {activeBatches.map((batch) => (
          <ListRow
            key={batch.id}
            lead={<Droplets aria-hidden="true" size={20} />}
            title={`${batch.lotCode} · ${batch.farmerName}`}
            subtitle={`${batch.greenWeightKg} kg green · ${batch.currentMoisture}% moisture`}
            value={<Pill tone={stageTone(batch.stage)}>{STAGE_LABEL[batch.stage]}</Pill>}
            onClick={() => onOpenBatch(batch.id)}
          />
        ))}
        {activeBatches.length === 0 && (
          <div className="empty-state"><p>No batches drying right now. Load a chamber from Intake.</p></div>
        )}
      </div>

      <SectionHeader title="Needs attention" />
      <div className="list-group">
        {chambers
          .filter((chamber) => chamber.status === 'FAULT')
          .map((chamber) => (
            <ListRow
              key={chamber.id}
              lead={<TriangleAlert aria-hidden="true" size={20} />}
              title={chamber.name}
              subtitle={`${chamber.tempC}°C against ${chamber.targetTempC}°C target`}
              value={<Pill tone="critical">Fault</Pill>}
              onClick={() => onOpenChamber(chamber.id)}
            />
          ))}
        {batches
          .filter((batch) => batch.stage === 'GRADING')
          .map((batch) => (
            <ListRow
              key={batch.id}
              lead={<Boxes aria-hidden="true" size={20} />}
              title={`${batch.lotCode} awaiting grading`}
              subtitle={`${batch.driedWeightKg ?? 0} kg dried · ${batch.currentMoisture}% moisture`}
              value={<Pill tone="warning">Grade</Pill>}
              onClick={() => onOpenBatch(batch.id)}
            />
          ))}
      </div>
    </>
  )
}
