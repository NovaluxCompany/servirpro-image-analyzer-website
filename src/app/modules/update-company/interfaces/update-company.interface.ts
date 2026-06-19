export interface ValidationError {
  tipo: string;
  detalle: string;
}

export interface PreviewRow {
  numero_documento: string;
  empresa: string;
}

export interface ValidationResponse {
  valido: boolean;
  total_filas: number;
  preview: PreviewRow[];
  errores?: ValidationError[];
}

export interface ExecutionRow {
  numero_documento: string;
  estado: string;
  motivo?: string;
  empresa: string;
}

export interface ExecutionResponse {
  exitosos: number;
  no_encontrados: number;
  inactivos_omitidos: number;
  ordinarios_omitidos: number;
  fallidos: number;
  detalle: ExecutionRow[];
}

export interface HistoryRow {
  id: number;
  documentNumber: string;
  fullName: string;
  newCompany: string;
  status: boolean;
  errorMessage: string | null;
  createdAt: string;
  operator: string;
  fileName: string;
}

export interface HistoryResponse {
  data: HistoryRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateCompanyContext {
  canUpdate: boolean;
  currentDay: number;
  minDay: number;
  maxDay: number;
  serverDate: string;
}
