import { create } from 'zustand'
import {
  batches as seedBatches,
  chambers as seedChambers,
  intakeReceipts as seedIntake,
  inventoryLots as seedInventory,
} from '../mocks/data'
import { STAGE_ORDER, type Batch, type BatchStage, type Chamber, type ChamberType, type DryoNotification, type Grade, type IntakeReceipt } from '../shared/contracts'
import { dryoApi } from '../api/dryo'

export type NewIntakeInput = {
  farmerName: string
  village: string
  weightKg: number
  moisturePct: number
  ratePerKg: number
  farmerId?: string
}

export type NewChamberInput = {
  name: string
  type: ChamberType
  capacityKg: number
  targetTempC: number
  cycleHours: number
}

export type NewBatchInput = {
  lotCode: string
  farmerName: string
  village: string
  greenWeightKg: number
  currentMoisture: number
  ratePerKg: number
  note?: string
  farmerId?: string
  ownership?: 'OWN' | 'JOBWORK'
  curingRatePerKg?: number
  grade?: Grade
  chamberId?: string
  gradingEnabled?: boolean
}

type DryoState = {
  batches: Batch[]
  chambers: Chamber[]
  intake: IntakeReceipt[]
  inventory: typeof seedInventory
  notifications: DryoNotification[]
  loaded: boolean
  online: boolean
  loadAll: () => Promise<void>
  createBatch: (input: NewBatchInput) => void
  updateBatch: (id: string, patch: Partial<Batch>) => void
  loadBatchIntoChamber: (batchId: string, chamberId: string) => void
  advanceBatch: (id: string) => void
  createIntake: (input: NewIntakeInput) => void
  loadIntake: (id: string, chamberId: string) => void
  toggleChamber: (id: string) => void
  createChamber: (input: NewChamberInput) => void
}

function nextStage(stage: BatchStage): BatchStage {
  const i = STAGE_ORDER.indexOf(stage)
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)]
}

export const useDryo = create<DryoState>((set) => ({
  batches: seedBatches,
  chambers: seedChambers,
  intake: seedIntake,
  inventory: seedInventory,
  notifications: [],
  loaded: false,
  online: false,

  // Pull live data from the Go API. Falls back to seed data if the API is down,
  // so the UI is always usable.
  loadAll: async () => {
    try {
      const [batches, chambers, intake, inventory] = await Promise.all([
        dryoApi.listBatches(),
        dryoApi.listChambers(),
        dryoApi.listIntake(),
        dryoApi.listInventory(),
      ])
      set({ batches, chambers, intake, inventory, loaded: true, online: true })
    } catch {
      set({ loaded: true, online: false })
    }
  },

  createBatch: (input) => {
    const optimistic: Batch = {
      id: `bt-new-${Date.now()}`,
      lotCode: input.lotCode,
      farmerName: input.farmerName,
      village: input.village,
      greenWeightKg: input.greenWeightKg,
      chamberId: input.chamberId,
      stage: input.chamberId ? 'DRYING' : 'INTAKE',
      startedAt: new Date().toISOString(),
      targetMoisture: 10,
      currentMoisture: input.currentMoisture,
      ratePerKg: input.ratePerKg,
      note: input.note,
      ownership: input.ownership ?? 'OWN',
      farmerId: input.farmerId ?? null,
      grade: input.grade,
      gradingEnabled: input.gradingEnabled,
    }
    set((state) => ({
      batches: [optimistic, ...state.batches],
      // If loaded into a chamber, occupy it optimistically.
      chambers: input.chamberId
        ? state.chambers.map((c) => (c.id === input.chamberId ? { ...c, status: 'DRYING', batchId: optimistic.id } : c))
        : state.chambers,
    }))
    void dryoApi
      .createBatch(input)
      .then((created) => set((state) => ({ batches: state.batches.map((b) => (b.id === optimistic.id ? created : b)) })))
      .catch(() => undefined)
  },

  updateBatch: (id, patch) => {
    set((state) => ({ batches: state.batches.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
    void dryoApi
      .updateBatch(id, patch)
      .then((updated) => set((state) => ({ batches: state.batches.map((b) => (b.id === id ? updated : b)) })))
      .catch(() => undefined)
  },

  loadBatchIntoChamber: (batchId, chamberId) => {
    set((state) => ({
      batches: state.batches.map((b) => (b.id === batchId ? { ...b, chamberId, stage: 'DRYING' } : b)),
      chambers: state.chambers.map((c) => (c.id === chamberId ? { ...c, status: 'DRYING', batchId } : c)),
    }))
    void dryoApi.loadBatch(batchId, chamberId).catch(() => undefined)
  },

  advanceBatch: (id) => {
    set((state) => ({
      batches: state.batches.map((batch) => {
        if (batch.id !== id) return batch
        const stage = nextStage(batch.stage)
        const driedWeightKg =
          stage === 'GRADING' && batch.driedWeightKg == null
            ? Math.round(batch.greenWeightKg * 0.2)
            : batch.driedWeightKg
        const chamberId = stage === 'GRADING' ? undefined : batch.chamberId
        return { ...batch, stage, driedWeightKg, chamberId }
      }),
      chambers: state.chambers.map((chamber) =>
        chamber.batchId === id ? { ...chamber, status: 'IDLE', batchId: undefined, loadKg: 0 } : chamber,
      ),
    }))
    void dryoApi.advanceBatch(id).catch(() => undefined)
  },

  createIntake: (input) => {
    const optimistic: IntakeReceipt = {
      id: `in-new-${Date.now()}`,
      farmerName: input.farmerName,
      village: input.village,
      weightKg: input.weightKg,
      moisturePct: input.moisturePct,
      ratePerKg: input.ratePerKg,
      receivedAt: new Date().toISOString(),
      status: 'PENDING',
      farmerId: input.farmerId ?? null,
    }
    set((state) => ({ intake: [optimistic, ...state.intake] }))
    void dryoApi
      .createIntake(input)
      .then((created) => set((state) => ({ intake: state.intake.map((r) => (r.id === optimistic.id ? created : r)) })))
      .catch(() => undefined)
  },

  // Loading an intake creates a DRYING batch from it and occupies the chamber.
  loadIntake: (id, chamberId) => {
    set((state) => ({
      intake: state.intake.map((receipt) => (receipt.id === id ? { ...receipt, status: 'LOADED' } : receipt)),
      chambers: state.chambers.map((chamber) =>
        chamber.id === chamberId ? { ...chamber, status: 'DRYING', batchId: id } : chamber,
      ),
    }))
    void dryoApi
      .loadIntake(id, chamberId)
      .then((batch) =>
        set((state) => ({
          batches: [batch, ...state.batches.filter((b) => b.id !== batch.id)],
          chambers: state.chambers.map((c) => (c.id === chamberId ? { ...c, batchId: batch.id } : c)),
        })),
      )
      .catch(() => undefined)
  },

  toggleChamber: (id) => {
    set((state) => ({
      chambers: state.chambers.map((chamber): Chamber => {
        if (chamber.id !== id) return chamber
        if (chamber.status === 'FAULT') return { ...chamber, status: 'IDLE', tempC: 31 }
        if (chamber.status === 'IDLE') return { ...chamber, status: 'HEATING' }
        return { ...chamber, status: 'IDLE' }
      }),
    }))
    void dryoApi.toggleChamber(id).catch(() => undefined)
  },

  createChamber: (input) => {
    const optimistic: Chamber = {
      id: `ch-new-${Date.now()}`,
      name: input.name,
      type: input.type,
      status: 'IDLE',
      tempC: 0,
      targetTempC: input.targetTempC,
      humidity: 0,
      loadKg: 0,
      capacityKg: input.capacityKg,
      elapsedHours: 0,
      cycleHours: input.cycleHours,
    }
    set((state) => ({ chambers: [...state.chambers, optimistic] }))
    void dryoApi
      .createChamber(input)
      .then((created) => set((state) => ({ chambers: state.chambers.map((c) => (c.id === optimistic.id ? created : c)) })))
      .catch(() => undefined)
  },
}))
