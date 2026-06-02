interface RawDeactivateAffiliateRow {
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

interface RawInactivationAffiliateRow {
  affiliate_id?: number;
  affiliateId?: number;
  id?: number;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  document_number?: string;
  full_name?: string;
  fullName?: string;
  document?: string;
  plan?: string;
  expected_amount?: number | string;
  expectedAmount?: number | string;
  paid_amount?: number | string;
  paidAmount?: number | string;
  difference?: number | string;
  last_payment?: string | null;
  lastPayment?: string | null;
  amountsMatch?: boolean | string | number | null;
  amount_match?: boolean | string | number | null;
  amounts_match?: boolean | string | number | null;
}

interface RawAffiliateTransactionRow {
  transaction_id?: number;
  transactionId?: number;
  created_at?: string;
  amount?: number | string;
  reference?: string;
  status?: string;
  observation?: string | null;
}
