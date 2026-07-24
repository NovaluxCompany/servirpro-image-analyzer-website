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
  bloque: string;
  expectedAmount: number;
  accumulatedAmount: number;
  isComplete: boolean;
  siigoInvoiceStatus: string;
  siigoInvoiceValue: number | null;
  isNewTransaction: boolean;
  createdAt: string;
  updatedAt: string;
}
