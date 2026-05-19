export type DocumentType = 'CC' | 'CE' | 'TI' | 'PA' | 'NIT' | 'PPT';

export interface AffiliateMember {
  id?: string;
  // Datos personales
  documentType: DocumentType;
  documentNumber: string;
  fullName: string;
  birthDate?: string;
  documentExpDate?: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality?: string;
  reference?: string;
  //Fecha whatsapp
  whatsappEntryDate?: string;
  companyEntryDate?: string;
  profession?: string;
  // Datos de afiliación
  planId?: string;
  planName?: string;
  companyId?: string;
  companyName?: string;
  grouperId?: string;
  grouperName?: string;
  advisorId?: string;
  advisorName?: string;
  epsId?: string;
  epsName?: string;
  pensionId?: string;
  pensionName?: string;
  compensationBoxId?: string;
  compensationBoxName?: string;
  isActive?: boolean;
  entryDate?: string;
  // Datos ADRES
  eps?: string;
  arl?: number;
  pension?: string;
  compensationFund?: string;
  deposit?: string;
  charge?: string;
  price?: number;
  // Campos del sistema
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  //
  document?: File;
}

export interface CreateAffiliateMemberDto {
  documentType: string;
  documentNumber: string;
  fullName: string;
  birthDate?: string;
  documentExpDate?: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality?: string;
  reference: string;        // required
  profession?: string;
  whatsappEntryDate?: string;
  companyEntryDate?: string;
  planId: number | null;
  companyId?: number | null;
  grouperId: number | null;
  advisorId: number | null;
  epsId?: number | null;
  pensionId?: number | null;
  compensationBoxId?: number | null;
  isActive?: boolean;
  entryDate?: string;
  arl?: number;
  compensationFund?: string;
}

export interface UpdateAffiliateMemberDto extends Partial<CreateAffiliateMemberDto> {}
