import { Affiliate } from './affiliate.interface';
import { Receipt } from './receipt.interface';

export interface Transaction {
  _id: string;
  reference: string;
  amountPaid: number;
  amountGeneratedAI?: number;
  amountsMatch?: boolean;
  status: 'pending' | 'processed';
  affiliates: Affiliate[];
  images: string[];
  receipts: Receipt[];
  createdAt: string;
  updatedAt: string;
}
