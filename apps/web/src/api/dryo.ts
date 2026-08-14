import type {
  Batch,
  Chamber,
  ChamberDetailData,
  ChamberExpense,
  Farmer,
  FarmerDetail,
  FarmerTransaction,
  FarmerTransactionType,
  GradePrice,
  HouseSettings,
  IntakeReceipt,
  InventoryLot,
  Invitation,
  Member,
  ReportSummary,
  Role,
  Sale,
  ServiceAddon,
} from '../shared/contracts'
import { api } from './client'

// The backend /me + members share the User shape.
export type ApiUser = Member

export const dryoApi = {
  me: () => api.get<ApiUser>('/me'),

  listBatches: () => api.get<Batch[]>('/batches'),
  createBatch: (input: Partial<Batch>) => api.post<Batch>('/batches', input),
  updateBatch: (id: string, patch: Partial<Batch>) => api.patch<Batch>(`/batches/${id}`, patch),
  loadBatch: (id: string, chamberId: string) => api.post<Batch>(`/batches/${id}/load`, { chamberId }),
  advanceBatch: (id: string) => api.post<Batch>(`/batches/${id}/advance`),

  listChambers: () => api.get<Chamber[]>('/chambers'),
  createChamber: (input: Partial<Chamber>) => api.post<Chamber>('/chambers', input),
  toggleChamber: (id: string) => api.post<Chamber>(`/chambers/${id}/toggle`),
  chamberDetail: (id: string) => api.get<ChamberDetailData>(`/chambers/${id}/detail`),
  addChamberExpense: (id: string, input: { amount: number; category?: string; note?: string }) =>
    api.post<ChamberExpense>(`/chambers/${id}/expenses`, input),

  listIntake: () => api.get<IntakeReceipt[]>('/intake'),
  createIntake: (input: Partial<IntakeReceipt>) => api.post<IntakeReceipt>('/intake', input),
  loadIntake: (id: string, chamberId: string) => api.post<Batch>(`/intake/${id}/load`, { chamberId }),

  listInventory: () => api.get<InventoryLot[]>('/inventory'),
  updateInventory: (grade: string, input: { costPerKg: number; location?: string }) =>
    api.patch<InventoryLot>(`/inventory/${grade}`, input),

  listMembers: () => api.get<Member[]>('/members'),
  updateMember: (uid: string, patch: { role?: Role; status?: string }) => api.patch<Member>(`/members/${uid}`, patch),

  listInvitations: () => api.get<Invitation[]>('/invitations'),
  createInvitation: (input: { email?: string; phone?: string; role: Role }) =>
    api.post<Invitation>('/invitations', input),
  revokeInvitation: (id: string) => api.del<{ status: string }>(`/invitations/${id}`),

  // Phase 1 — business management
  listFarmers: () => api.get<Farmer[]>('/farmers'),
  getFarmer: (id: string) => api.get<FarmerDetail>(`/farmers/${id}`),
  createFarmer: (input: { name: string; village?: string; phone?: string; note?: string }) =>
    api.post<Farmer>('/farmers', input),
  updateFarmer: (id: string, input: { name?: string; village?: string; phone?: string; note?: string }) =>
    api.patch<Farmer>(`/farmers/${id}`, input),
  addFarmerTransaction: (id: string, input: { type: FarmerTransactionType; amount: number; note?: string; batchId?: string }) =>
    api.post<FarmerTransaction>(`/farmers/${id}/transactions`, input),

  listSales: () => api.get<Sale[]>('/sales'),
  createSale: (input: Partial<Sale>) => api.post<Sale>('/sales', input),

  listPricing: () => api.get<GradePrice[]>('/pricing'),
  upsertPrice: (grade: string, input: { sellRatePerKg: number; costRatePerKg?: number; yieldRatio?: number }) =>
    api.put<GradePrice>(`/pricing/${grade}`, input),

  listAddons: () => api.get<ServiceAddon[]>('/addons'),
  createAddon: (input: { name: string; rate: number; perKg: boolean }) => api.post<ServiceAddon>('/addons', input),
  updateAddon: (id: string, input: { name: string; rate: number; perKg: boolean; active: boolean }) =>
    api.patch<ServiceAddon>(`/addons/${id}`, input),
  deleteAddon: (id: string) => api.del<{ status: string }>(`/addons/${id}`),

  getSettings: () => api.get<HouseSettings>('/settings'),
  updateSettings: (input: HouseSettings) => api.patch<HouseSettings>('/settings', input),

  reportSummary: (range?: { from: string; to: string }) =>
    api.get<ReportSummary>(range ? `/reports/summary?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : '/reports/summary'),
}
