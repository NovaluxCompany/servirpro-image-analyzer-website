export interface BillingPeriodClient {
  id: number;
  fullName: string;
  documentNumber: string;
}

export interface BillingPeriodAffiliation {
  id: number;
  client?: BillingPeriodClient;
}

export interface BillingPeriodCategory {
  id: number;
  name: string;
}

export interface BillingPeriod {
  id: number;
  affiliationId: number;
  affiliation?: BillingPeriodAffiliation;
  periodYear: number;
  periodMonth: number;
  categoryId?: number | null;
  category?: BillingPeriodCategory | null;
  expectedAmount: number;
  accumulatedAmount: number;
  isComplete: boolean;
  siigoInvoiceStatus: string;
  siigoInvoiceValue: number | null;
  isNewTransaction: boolean;
  lateFee: number;
  profit: number | null;
  reserve: number | null;
  sentObservation: string | null;
  createdAt: string;
  updatedAt: string;
  hasSiigoMatch?: boolean;
  planName?: string | null;
  planPrice?: number | null;
  adminValue?: number | null;
  reserveValue?: number | null;
  payrollValue?: number | null;
}
