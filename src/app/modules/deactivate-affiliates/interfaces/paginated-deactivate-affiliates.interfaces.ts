export interface PaginatedDeactivationResponse {
  data: import('./deactivate-affiliates.interface').InactivationAffiliateRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
