export type Role = 'OWNER' | 'MANAGER' | 'OPERATOR'

export type AccountStatus = 'ACTIVE' | 'PENDING' | 'DISABLED'

export type Session = {
  staffId: string
  displayName: string
  phone: string
  email?: string
  role: Role
  houseName: string
  status: AccountStatus
}

export function canManageMembers(role: Role): boolean {
  return role === 'OWNER' || role === 'MANAGER'
}

export type Member = {
  uid: string
  displayName: string
  phone: string
  email: string
  role: Role
  houseName: string
  status: AccountStatus
  invitedBy: string
  createdAt: string
}

export type Invitation = {
  id: string
  email: string
  phone: string
  role: Role
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED'
  invitedBy: string
  createdAt: string
  acceptedAt: string | null
}

export type BatchStage = 'INTAKE' | 'DRYING' | 'CURING' | 'GRADING' | 'READY' | 'DISPATCHED'

export const STAGE_ORDER: BatchStage[] = ['INTAKE', 'DRYING', 'CURING', 'GRADING', 'READY', 'DISPATCHED']

export const STAGE_LABEL: Record<BatchStage, string> = {
  INTAKE: 'Intake',
  DRYING: 'Drying',
  CURING: 'Curing',
  GRADING: 'Grading',
  READY: 'Ready',
  DISPATCHED: 'Dispatched',
}

export type Grade = 'AGEB' | 'AGB' | 'AGS' | 'AGES' | 'REJECT'

export const GRADE_LABEL: Record<Grade, string> = {
  AGEB: 'AGEB · Bold Green',
  AGB: 'AGB · Bold',
  AGS: 'AGS · Shipment',
  AGES: 'AGES · Extra Small',
  REJECT: 'Reject / Light',
}

// Stock/sale grade can also be the generic bucket for own stock sold ungraded.
export const UNGRADED = 'UNGRADED'
export type StockGrade = Grade | typeof UNGRADED
export const gradeLabel = (g: string): string =>
  GRADE_LABEL[g as Grade] ?? (g === UNGRADED ? 'Ungraded / mixed' : g)

export type Batch = {
  id: string
  lotCode: string
  farmerName: string
  village: string
  greenWeightKg: number
  driedWeightKg?: number
  chamberId?: string
  stage: BatchStage
  startedAt: string
  targetMoisture: number
  currentMoisture: number
  grade?: Grade
  ratePerKg: number
  note?: string
  ownership?: 'OWN' | 'JOBWORK'
  farmerId?: string | null
  curingRatePerKg?: number
  gradingCharge?: number
}

export type ChamberStatus = 'IDLE' | 'HEATING' | 'DRYING' | 'CURING' | 'COOLING' | 'FAULT'

export type ChamberType = 'FLUE_KILN' | 'ELECTRIC' | 'SOLAR_BIOMASS'

export const CHAMBER_TYPE_LABEL: Record<ChamberType, string> = {
  FLUE_KILN: 'Flue-pipe kiln',
  ELECTRIC: 'Electric dryer',
  SOLAR_BIOMASS: 'Solar–biomass',
}

export type Chamber = {
  id: string
  name: string
  type: ChamberType
  status: ChamberStatus
  tempC: number
  targetTempC: number
  humidity: number
  loadKg: number
  capacityKg: number
  batchId?: string
  elapsedHours: number
  cycleHours: number
  startedAt?: string | null
}

export type IntakeReceipt = {
  id: string
  farmerName: string
  village: string
  weightKg: number
  moisturePct: number
  ratePerKg: number
  receivedAt: string
  status: 'PENDING' | 'LOADED'
  farmerId?: string | null
}

export type InventoryLot = {
  grade: StockGrade
  bulkKg: number
  bags: number
  location: string
  avgMoisture: number
  costPerKg: number
}

export type DryoNotification = {
  id: string
  title: string
  body: string
  at: string
  tone: 'neutral' | 'positive' | 'warning' | 'critical'
}

// ── Phase 1: business management ──

export type Farmer = {
  id: string
  name: string
  village: string
  phone: string
  note: string
  createdAt: string
  balance: number // + = house owes the farmer
}

export type FarmerTransactionType = 'PURCHASE' | 'JOBWORK_CHARGE' | 'ADVANCE' | 'PAYMENT' | 'ADJUSTMENT'

export type FarmerTransaction = {
  id: string
  farmerId: string
  type: FarmerTransactionType
  amount: number
  note: string
  batchId: string | null
  createdAt: string
}

export type FarmerDetail = Farmer & { transactions: FarmerTransaction[] }

export type SaleChannel = 'DIRECT' | 'AUCTION'

export type Sale = {
  id: string
  buyerName: string
  channel: SaleChannel
  grade: StockGrade
  quantityKg: number
  ratePerKg: number
  amount: number
  commission: number
  batchId: string | null
  invoiceNo: string
  note: string
  soldAt: string
}

export type GradePrice = {
  grade: Grade
  sellRatePerKg: number
  costRatePerKg: number
  yieldRatio: number
  updatedAt: string
}

export type HouseSettings = {
  houseName: string
  defaultCuringRatePerKg: number
  gstNumber: string
}

export type ReportSummary = {
  activeBatches: number
  readyKg: number
  storeKg: number
  salesTotal: number
  salesCount: number
  payables: number
  receivables: number
  avgYieldPct: number
  stockValueAtCost: number
}
