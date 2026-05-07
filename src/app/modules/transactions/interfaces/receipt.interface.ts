export interface Receipt {
  amount?: number;
  veracityPercentage?: number;
  currency?: string;
  vendor?: string;
  reliabilityAlert?: 'confiable' | 'no_confiable';
  date: string;
}
