export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  affiliate?: string;
  idNumber?: string;
  reference?: string;
  uploadedBy?: string;
  status?: string;
  affiliateType?: 'DEPENDIENTE' | 'INDEPENDIENTE';
  // 'any' = cualquier novedad.
  deactivationReason?: 'any' | 'unauthorized_account' | 'receipt_year_mismatch';
}
