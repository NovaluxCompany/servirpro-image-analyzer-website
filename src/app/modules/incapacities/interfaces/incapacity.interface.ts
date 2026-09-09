/**
 * Códigos conocidos — solo para tipar comparaciones en el código
 * (`incapacity.servirproStatus.code === 'PAGADO'`). La fuente de verdad es
 * el catálogo en BD (incapacity_servirpro_statuses / ...third_party_statuses),
 * que se consulta con IncapacitiesService.getCatalogs(); estas listas no
 * necesitan ampliarse para que un estado nuevo funcione, son solo para
 * autocompletado en los sitios que ya conocen un código específico.
 */
export type ServirproStatusCode = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'PAGADO';
export type ThirdPartyStatusCode =
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'TUTELA'
  | 'ENVIADO_A_CYA';

export type PaymentType = 'INTERNO' | 'EXTERNO';
export type IncapacityType = 'NUEVA' | 'PRORROGA';

export type IncapacityDocumentType =
  | 'CERT_BANCARIO'
  | 'INCAPACIDAD'
  | 'HISTORIA_CLINICA'
  | 'AUTORIZACION_PAGO_TERCERO'
  | 'RIPS'
  | 'AUTORIZACION_BANCARIA'
  | 'RUAF'
  | 'CERTIFICADO_NACIDO_VIVO'
  | 'REGISTRO_CIVIL'
  | 'SOAT'
  | 'LICENCIA_CONDUCCION'
  | 'FURIPS';

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
    birthDate?: string | null;
  };
  company?: { id: number; name: string } | null;
  eps?: { id: number; name: string } | null;
  grouper?: { id: number; name: string } | null;
}

export interface Incapacity {
  id: number;
  affiliationId: number;
  affiliation?: IncapacityAffiliation;
  /** Nueva radicación o continuación de una ya existente (ver parentIncapacityId). */
  type: IncapacityType;
  parentIncapacityId: number | null;
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
  /** Solo se usa cuando entityType = ARL: no hay catálogo de proveedores ARL. */
  issuingEntityName: string | null;
  /** Objeto del catálogo (id/code/label), no un string plano — ver incapacity_servirpro_statuses. */
  servirproStatus: CatalogItem;
  servirproObservation: string | null;
  /** Obligatorio cuando servirproStatus.code = PAGADO. */
  paymentType: PaymentType | null;
  thirdPartyStatus: CatalogItem;
  thirdPartyObservation: string | null;
  routedTo: string | null;
  registeredInPila: boolean;
  emailSent: boolean;
  cancelled: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdByUser?: { id: number; email?: string; name?: string } | null;
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

/**
 * Origen, entidad que responde y matriz de documentos, en una sola
 * respuesta. `documentRequirements` va por código de origen (no por id):
 * es como el formulario ya identifica el origen seleccionado.
 */
export interface IncapacityCatalogs {
  origins: CatalogItem[];
  entityTypes: CatalogItem[];
  servirproStatuses: CatalogItem[];
  thirdPartyStatuses: CatalogItem[];
  documentRequirements: Record<string, { documentType: IncapacityDocumentType; required: boolean }[]>;
}

export interface IncapacityFilters {
  affiliationId?: number;
  documentNumber?: string;
  type?: IncapacityType;
  /** Code del catálogo (no id) — se filtra por texto, ver query-incapacities.dto.ts. */
  servirproStatus?: ServirproStatusCode | string;
  thirdPartyStatus?: ThirdPartyStatusCode | string;
  routedTo?: IncapacityRoute;
  registeredInPila?: boolean;
  cancelled?: boolean;
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
  user?: { id: number; email?: string; name?: string } | null;
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
  /** NUEVA por default si se omite. */
  type?: IncapacityType;
  /** Obligatorio cuando type = PRORROGA. */
  parentIncapacityId?: number;
  startDate: string;
  endDate: string;
  /** Si no se envía, el backend lo calcula como (endDate - startDate + 1). */
  days?: number;
  /** FK a cie10_diagnoses. Antes viajaba el código como texto libre. */
  diagnosisId?: number;
  originId?: number;
  entityTypeId?: number;
  /** Solo tiene sentido cuando entityTypeId es ARL (sin catálogo de proveedores ARL). */
  issuingEntityName?: string;
  servirproObservation?: string;
}

export interface UpdateServirproStatusDto {
  /** Id de una fila de incapacity_servirpro_statuses (ver getCatalogs().servirproStatuses). */
  statusId: number;
  observation?: string;
  /** Obligatorio cuando el estado resuelto por statusId es PAGADO. */
  paymentType?: PaymentType;
}

export interface CancelIncapacityDto {
  reason: string;
}

export interface UpdateThirdPartyStatusDto {
  /** Id de una fila de incapacity_third_party_statuses (ver getCatalogs().thirdPartyStatuses). */
  statusId: number;
  observation?: string;
}

export interface SignedDocumentUrl {
  url: string;
  expiresInSeconds: number;
}
