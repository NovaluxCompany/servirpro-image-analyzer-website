export interface SiigoInvoicePayload {
  document: { id: number };
  date: string;
  customer: {
    person_type: 'Person' | 'Company';
    id_type: string;
    identification: string;
    name: string[];
  };
  seller: number;
  cost_center?: number;
  currency?: { code: string; exchange_rate: number };
  observations: string;
  items: Array<{
    code: string;
    description: string;
    quantity: number;
    price: number;
    discount: number;
    taxes: Array<{ id: number }>;
  }>;
  payments: Array<{
    id: number;
    value: number;
    due_date: string;
  }>;
}

export interface SiigoInvoicePricingBreakdown {
  planValue: number;
  administration: number;
  reserve: number;
  payroll: number;
  affiliateDiscount: number;
  profit: number;
  lateFee: number;
  total: number;
}

export interface SiigoInvoicePayloadPreview {
  hasMatch: boolean;
  payload: SiigoInvoicePayload | null;
  pricingBreakdown: SiigoInvoicePricingBreakdown | null;
}
