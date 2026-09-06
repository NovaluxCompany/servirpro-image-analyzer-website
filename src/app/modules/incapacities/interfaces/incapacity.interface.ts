export type ServirproStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
export type ThirdPartyStatus = 'PENDIENTE' | 'EN_PROCESO' | 'APROBADO' | 'RECHAZADO';

export type IncapacityDocumentType =
  | 'CERT_BANCARIO'
  | 'INCAPACIDAD'
  | 'HISTORIA_CLINICA'
  | 'AUTORIZACION_PAGO_TERCERO'
  | 'RIPS';

export interface IncapacityDocument {
  id: number;
  incapacityId: number;
  documentType: IncapacityDocumentType;
  fileName: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  isSensitive: boolean;
  createdAt: string;
}

export interface IncapacityAffiliation {
  id: number;
  client?: {
    documentType?: string;
    documentNumber?: string;
    fullName?: string;
  };
  grouper?: { id: number; name: string } | null;
}

export interface Incapacity {
  id: number;
  affiliationId: number;
  affiliation?: IncapacityAffiliation;
  startDate: string;
  endDate: string;
  /**
   * Editable. Se autocompleta con (fin - inicio + 1), pero el certificado
   * médico manda: si difiere, se guarda lo que escribió el usuario.
   */
  days: number;
  diagnosis: Cie10Diagnosis | null;
  origin: CatalogItem | null;
  entityType: CatalogItem | null;
  servirproStatus: ServirproStatus;
  servirproObservation: string | null;
  thirdPartyStatus: ThirdPartyStatus;
  thirdPartyObservation: string | null;
  routedTo: string | null;
  registeredInPila: boolean;
  emailSent: boolean;
  documents?: IncapacityDocument[];
  createdAt: string;
}

export type IncapacityRoute = 'GESTION' | 'CYA';

/**
 * Fila de la tabla CIE-10. No es un CatalogItem: son ~14.000 registros, así
 * que nunca se traen completos — solo llegan los que matchean una búsqueda
 * (ver IncapacitiesService.searchDiagnoses).
 */
export interface Cie10Diagnosis {
  id: number;
  code: string;
  description: string;
}

/** Fila de un catálogo parametrizado en base de datos. */
export interface CatalogItem {
  id: number;
  code: string;
  label: string;
}

/** Origen y entidad que responde, en una sola respuesta. */
export interface IncapacityCatalogs {
  origins: CatalogItem[];
  entityTypes: CatalogItem[];
}

export interface IncapacityFilters {
  affiliationId?: number;
  servirproStatus?: ServirproStatus;
  thirdPartyStatus?: ThirdPartyStatus;
  routedTo?: IncapacityRoute;
  registeredInPila?: boolean;
}

/** Mapa agrupadora → destino. Es dato, no código: se ajusta con un UPDATE. */
export interface IncapacityGrouperRoute {
  id: number;
  grouperId: number;
  grouper?: { id: number; name: string };
  route: IncapacityRoute;
  active: boolean;
}

export interface IncapacityLogEntry {
  id: number;
  incapacityId: number;
  scope: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  observation: string | null;
  user?: { id: number; email?: string; fullName?: string } | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginatedIncapacities {
  items: Incapacity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateIncapacityDto {
  affiliationId: number;
  startDate: string;
  endDate: string;
  /** Si no se envía, el backend lo calcula como (endDate - startDate + 1). */
  days?: number;
  /** FK a cie10_diagnoses. Antes viajaba el código como texto libre. */
  diagnosisId?: number;
  originId?: number;
  entityTypeId?: number;
  servirproObservation?: string;
}

export interface UpdateServirproStatusDto {
  status: 'APROBADO' | 'RECHAZADO';
  observation?: string;
}

export interface UpdateThirdPartyStatusDto {
  status: ThirdPartyStatus;
  observation?: string;
}

export interface SignedDocumentUrl {
  url: string;
  expiresInSeconds: number;
}
