export interface PaginatedAffiliatesResponse {
  data: import('./affiliate-member.interface').AffiliateMember[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
