export interface DeactivateAffiliateRow {
  id: number;
  nombre: string;
  cedula: string;
  referencia: string;
  nombrePlan: string;
  fechaCreacion: string;
  fechaIngreso: string | null;
  asesor: string;
  empresa: string;
  agrupadora: string;
  profesion: string;
}

export interface DeactivationContext {
  canDeactivateByDate: boolean;
  currentDay: number;
  minDay: number;
  pageSize: number;
  serverDate: string;
}

export interface ActiveDeactivationResponse {
  data: DeactivateAffiliateRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  context: DeactivationContext;
}

export interface DeactivateAffiliatesResponse {
  success: boolean;
  affected: number;
  message: string;
}

export interface InactivationAffiliateRow {
  affiliateId: number;
  name: string;
  document: string;
  plan: string;
  expectedAmount: number;
  paidAmount?: number;
  difference?: number;
  lastPayment: string | null;
}

export interface AffiliateTransactionRow {
  transactionId: number;
  date: string;
  amount: number;
  concept: string;
  status: string;
  observation: string | null;
}
