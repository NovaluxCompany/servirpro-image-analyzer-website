export interface DisaffiliationReason {
  id: number;
  code: string;
  label: string;
}

export interface DisaffiliationFilters {
  page?: number;
  name?: string;
  document?: string;
  company?: string;
  plan?: string;
  affiliateType?: string;
  reason?: string;
}

export interface PendingDisaffiliationRow {
  requestId: number;
  affiliationId: number;
  company: string;
  documentNumber: string;
  fullName: string;
  plan: string;
  affiliateType: 'INDEPENDIENTE' | 'DEPENDIENTE';
  reasonLabel: string;
  observation: string | null;
  requestedAt: string;
  requestedByName: string | null;
  fidelizadorName: string | null;
}

export interface PendingDisaffiliationsResponse {
  data: PendingDisaffiliationRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DisaffiliationHistoryRow {
  requestId: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  company: string;
  reasonLabel: string;
  observation: string | null;
  requestedAt: string;
  requestedByName: string | null;
  fidelizadorName: string | null;
  confirmedAt: string | null;
  confirmedByName: string | null;
}

export interface ConfirmDisaffiliationsResponse {
  success: boolean;
  affected: number;
  succeeded: number;
  failed: { requestId: number; name: string; reason: string }[];
  message: string;
}
