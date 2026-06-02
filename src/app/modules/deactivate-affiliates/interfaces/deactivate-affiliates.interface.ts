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
  amountsMatch?: boolean;
}

export interface AffiliateTransactionRow {
  transactionId: string;
  reference: string;
  createdAt: string;
  totalValue: number;
  amountPaid: number;
  discountedValue: number | null;
  amountsMatch: boolean | null;
  status: string;
  observation: string | null;
}
