export interface Affiliate {
  affiliationId: number;
  _id?: string;
  type: string;
  idNumber: string;
  fullName: string;
  birthDate: string;
  documentExpDate?: string;
  entryDate: string;
  plan: string;
  price: number;
  eps?: string;
  reference?: string;
  deposit?: string;
  charge?: string;
  arl?: number;
  compensationFund?: string;
  pension?: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality?: string;
  company?: string;
  grouper?: string;
  advisor?: string;
  createdAt?: string;
  updatedAt?: string;
}
