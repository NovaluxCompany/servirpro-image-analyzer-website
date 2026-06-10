import { ActiveDeactivationResponse } from "./deactivate-affiliates.interface";

export interface RawDeactivateAffiliateRow {
  id: number;
  fullName?: string;
  documentNumber?: string;
  reference?: string;
  planName?: string;
  createdAt?: string;
  entryDate?: string | null;
  advisorName?: string;
  companyName?: string;
  grouperName?: string;
  profession?: string;
}

export interface RawActiveDeactivationResponse extends Omit<ActiveDeactivationResponse, 'data'> {
  data: RawDeactivateAffiliateRow[];
}

export interface RawInactivationAffiliateRow {
  id?: number;
  affiliate_id?: number;
  affiliateId?: number;
  full_name?: string;
  fullName?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  document?: string;
  document_number?: string;
  reference?: string;
  plan?: string;
  plan_value?: number | string;
  planValue?: number | string;
  total_transactions?: number | string;
  totalTransactions?: number | string;
  entry_date?: string | null;
  entryDate?: string | null;
  advisor?: string;
  company?: string;
  grouper?: string;
  pension?: string;
  expected_amount?: number | string;
  expectedAmount?: number | string;
  paid_amount?: number | string;
  paidAmount?: number | string;
  amount_generated_ai?: number | string;
  amountGeneratedAI?: number | string;
  difference?: number | string;
  last_payment?: string | null;
  lastPayment?: string | null;
  amountsMatch?: boolean | string | number | null;
  amount_match?: boolean | string | number | null;
  amounts_match?: boolean | string | number | null;
}

export interface RawAffiliateTransactionRow {
  _id?: string;
  id?: number;
  transaction_id?: number;
  transactionId?: number;
  reference?: string;
  created_at?: string;
  createdAt?: string;
  total_value?: number | string;
  totalValue?: number | string;
  amount_paid?: number | string;
  amountPaid?: number | string;
  amountGeneratedAI?: number | string;
  discounted_value?: number | string | null;
  discountedValue?: number | string | null;
  amounts_match?: boolean | string | number | null;
  amountsMatch?: boolean | string | number | null;
  amount_match?: boolean | string | number | null;
  is_approved?: boolean | string | number | null;
  isApproved?: boolean | string | number | null;
  status?: string;
  observation?: string | null;
  n8n_last_error?: string | null;
  n8nLastError?: string | null;
  created_by_user?: { name?: string; id?: number } | null;
  createdByUser?: { name?: string; id?: number } | null;
  createdBy?: { name?: string; id?: number } | null;
  advisor?: string | null;
  advisorName?: string | null;
}
