export interface DeactivateAffiliateFilters {
  page?: number;
  limit?: number;
  name?: string;
  document?: string;
  reference?: string;
  advisor?: string;
  company?: string;
  grouper?: string;
}


export interface ActiveAffiliateRow {
  id: number;
  fullName: string;
  idNumber: string;
  reference: string;
  planName: string;
  createdAt: string;
  entryDate: string | null;
  advisor: string;
  company: string;
  grouper: string;
  profession: string;
}

export interface DeactivationContext {
  canDeactivateByDate: boolean;
  currentDay: number;
  minDay: number;
  pageSize: number;
  serverDate: string;
}

export interface ActiveDeactivationResponse {
  data: ActiveAffiliateRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  context: DeactivationContext;
}

export interface DeactivateAffiliatesResponse {
  success: boolean;
  affected: number;
  succeeded: number;
  failed: { affiliateId: number; name: string; reason: string }[];
  message: string;
}

export interface InactivationAffiliateRow {
  affiliateId: number;
  name: string;
  document: string;
  reference: string;
  plan: string;
  planValue?: number;
  totalTransactions?: number;
  entryDate: string | null;
  advisor: string;
  company: string;
  grouper: string;
  expectedAmount?: number;
  paidAmount?: number;
  amountGeneratedAI?: number;
  difference?: number;
  lastPayment?: string | null;
  amountsMatch?: boolean;
  pension?: string;
}

export interface AffiliateTransactionRow {
  transactionId: string;
  reference: string;
  createdAt: string;
  totalValue: number;
  amountPaid: number;
  discountedValue: number | null;
  amountsMatch: boolean | null;
  isApproved: boolean | null;
  status: string;
  observation: string | null;
  errorReason: string | null;
  advisorName: string | null;
}
