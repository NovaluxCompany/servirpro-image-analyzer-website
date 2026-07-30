export interface BillingPeriodClient {
  id: number;
  fullName: string;
  documentNumber: string;
}

export interface BillingPeriodAffiliation {
  id: number;
  client?: BillingPeriodClient;
}

export interface BillingPeriod {
  id: number;
  affiliationId: number;
  affiliation?: BillingPeriodAffiliation;
  periodYear: number;
  periodMonth: number;
  block: string;
  expectedAmount: number;
  accumulatedAmount: number;
  isComplete: boolean;
  siigoInvoiceStatus: string;
  siigoInvoiceValue: number | null;
  isNewTransaction: boolean;
  mora: number;
  ganancia: number | null;
  createdAt: string;
  updatedAt: string;
  hasSiigoMatch?: boolean;
}
