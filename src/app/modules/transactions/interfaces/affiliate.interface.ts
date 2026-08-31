export interface Affiliate {
  _id?: string;
  type: string;
  idNumber: string;
  fullName: string;
  birthDate: string;
  entryDate: string;
  plan: string;
  price: number;
  // Snapshot informativo del descuento del afiliado al momento del pago.
  // Puramente visual: no afecta price ni ningún valor enviado a Siigo.
  discount?: number | null;
  eps: string;
  reference: string;
  deposit?: string;
  charge?: string;
  profession?: string;
  arl?: number;
  compensationFund?: string;
  pension?: string;
  advisor?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
