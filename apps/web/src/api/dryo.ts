import type {
  Batch,
  Chamber,
  ChamberDetailData,
  ChamberExpense,
  DryoNotification,
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
  loadBatch: (id: string, chamberId: string, kg?: number) => api.post<Batch>(`/batches/${id}/load`, { chamberId, kg }),
  advanceBatch: (id: string) => api.post<Batch>(`/batches/${id}/advance`),
  setBatchPaid: (id: string, paid: boolean) => api.post<Batch>(`/batches/${id}/payment`, { paid }),
  deleteBatch: (id: string) => api.del<{ status: string }>(`/batches/${id}`),

  listChambers: () => api.get<Chamber[]>('/chambers'),
  createChamber: (input: Partial<Chamber>) => api.post<Chamber>('/chambers', input),
  updateChamber: (id: string, input: Partial<Chamber>) => api.patch<Chamber>(`/chambers/${id}`, input),
  deleteChamber: (id: string) => api.del<{ status: string }>(`/chambers/${id}`),
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
  upsertInventory: (input: { grade: string; bulkKg?: number; bags?: number; location?: string; costPerKg?: number; avgMoisture?: number }) =>
    api.post<InventoryLot>('/inventory', input),
  deleteInventory: (grade: string) => api.del<{ status: string }>(`/inventory/${grade}`),

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
  deleteFarmer: (id: string) => api.del<{ status: string }>(`/farmers/${id}`),
  updateFarmer: (id: string, input: { name?: string; village?: string; phone?: string; note?: string }) =>
    api.patch<Farmer>(`/farmers/${id}`, input),
  addFarmerTransaction: (id: string, input: { type: FarmerTransactionType; amount: number; note?: string; batchId?: string }) =>
    api.post<FarmerTransaction>(`/farmers/${id}/transactions`, input),

  listSales: () => api.get<Sale[]>('/sales'),
  createSale: (input: Partial<Sale>) => api.post<Sale>('/sales', input),
  deleteSale: (id: string) => api.del<{ status: string }>(`/sales/${id}`),

  listPricing: () => api.get<GradePrice[]>('/pricing'),
  upsertPrice: (grade: string, input: { sellRatePerKg: number; costRatePerKg?: number; yieldRatio?: number }) =>
    api.put<GradePrice>(`/pricing/${grade}`, input),
  deletePrice: (grade: string) => api.del<{ status: string }>(`/pricing/${grade}`),

  listAddons: () => api.get<ServiceAddon[]>('/addons'),
  createAddon: (input: { name: string; rate: number; perKg: boolean }) => api.post<ServiceAddon>('/addons', input),
  updateAddon: (id: string, input: { name: string; rate: number; perKg: boolean; active: boolean }) =>
    api.patch<ServiceAddon>(`/addons/${id}`, input),
  deleteAddon: (id: string) => api.del<{ status: string }>(`/addons/${id}`),

  getSettings: () => api.get<HouseSettings>('/settings'),
  updateSettings: (input: HouseSettings) => api.patch<HouseSettings>('/settings', input),

  listNotifications: () => api.get<DryoNotification[]>('/notifications'),
  markNotificationsRead: () => api.post<{ status: string }>('/notifications/read'),

  reportSummary: (range?: { from: string; to: string }) =>
    api.get<ReportSummary>(range ? `/reports/summary?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : '/reports/summary'),
}
