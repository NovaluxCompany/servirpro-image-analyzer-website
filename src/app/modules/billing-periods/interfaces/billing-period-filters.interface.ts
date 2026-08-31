export interface BillingPeriodFilters {
  dateFrom: string;
  dateTo: string;
  status?: string;
  affiliateName?: string;
  documentNumber?: string;
  planId?: number;
}
