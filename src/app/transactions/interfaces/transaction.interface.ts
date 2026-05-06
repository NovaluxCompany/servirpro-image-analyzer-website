import { Affiliate } from './affiliate.interface';
import { Receipt } from './receipt.interface';

export interface Transaction {
  _id: string;
  reference: string;
  totalValue: number;
  amountPaid: number;
  discountedValue?: number;
  amountGeneratedAI?: number;
  amountsMatch?: boolean;
  status: 'pending' | 'processed';
  affiliates: Affiliate[];
  images: string[];
  receipts: Receipt[];
  observation?: string;
  createdAt: string;
  updatedAt: string;
}
