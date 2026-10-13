export type DocumentUploadStatus = 'QUEUED' | 'SENDING' | 'ERROR' | 'SUCCESS';

export interface DocumentType {
  id: number;
  name: string;
  certField: 'certEps' | 'certArl' | 'certCcf' | 'certPension';
  isActive: boolean;
}

export interface DocumentUploadItem {
  id: number;
  documentTypeId: number;
  documentType?: DocumentType;
  affiliationId: number | null;
  affiliation?: {
    id: number;
    client?: { fullName?: string; documentNumber?: string; documentType?: string };
  } | null;
  cedulaDetected: string | null;
  fileName: string;
  fileUrl: string | null;
  status: DocumentUploadStatus;
  errorMessage: string | null;
  n8nLastError: string | null;
  n8nRetries: number;
  manuallyMarked: boolean;
  manuallyMarkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadListResponse {
  data: DocumentUploadItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentUploadFilters {
  page?: number;
  pageSize?: number;
  status?: DocumentUploadStatus;
  documentTypeId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface UploadItemError {
  fileName: string;
  reason: string;
}

export interface UploadBatchResponse {
  created: DocumentUploadItem[];
  errors: UploadItemError[];
}
