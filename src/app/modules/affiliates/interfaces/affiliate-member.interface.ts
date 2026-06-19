export type DocumentType = 'CC' | 'CE' | 'TI' | 'NIT' | 'PPT';

// ── Nueva Interfaz Relacional para Documentos ──────────────────────
export interface AffiliateDocument {
  id: number;
  affiliationId: number;
  documentUrl: string; // URL pública entregada por Supabase
  fileName: string;    // Nombre único del archivo en el Bucket
  position: number;    // Índice de ordenamiento del archivo
}

export interface AffiliateMember {
  id?: string;
  // Datos personales
  documentType: DocumentType;
  documentNumber: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  birthDate?: string;
  documentExpDate?: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality?: string;
  reference?: string;
  // Fecha whatsapp
  whatsappEntryDate?: string;
  companyEntryDate?: string;
  profession?: string;
  gender?: string;
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
  emailSent?: boolean;
  observation?: string;
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

  // Certificados de seguridad social
  certArl?: boolean;
  certEps?: boolean;
  certPension?: boolean;
  certCcf?: boolean;

  // Modificado: Ahora mapea el array relacional que viene del Backend
  documents?: AffiliateDocument[];

  // Mantenemos la referencia en memoria del archivo físico si la usas en formularios reactivos
  document?: File;
}

export interface CreateAffiliateMemberDto {
  documentType: string;
  documentNumber: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  birthDate?: string;
  documentExpDate?: string;
  phone?: string;
  email?: string;
  address?: string;
  municipality?: string;
  reference: string;        // required
  profession?: string;
  gender?: string;
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
  observation?: string;
  certArl?: boolean;
  certEps?: boolean;
  certPension?: boolean;
  certCcf?: boolean;
}

export interface UpdateAffiliateMemberDto extends Partial<CreateAffiliateMemberDto> {}
