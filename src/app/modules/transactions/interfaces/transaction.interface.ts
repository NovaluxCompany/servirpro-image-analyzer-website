import { Affiliate } from './affiliate.interface';
import { Receipt } from './receipt.interface';

export interface Transaction {
  _id: string;
  id?: number;
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
  isActive?: boolean;
  createdByUser?: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}
