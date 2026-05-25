export interface Affiliate {
  _id?: string;
  type: string;
  idNumber: string;
  fullName: string;
  birthDate: string;
  entryDate: string;
  plan: string;
  price: number;
  eps: string;
  reference: string;
  deposit?: string;
  charge?: string;
  profession?: string;
  arl?: number;
  compensationFund?: string;
  pension?: string;
  createdAt?: string;
  updatedAt?: string;
}
