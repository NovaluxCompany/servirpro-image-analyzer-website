import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import {
  DocumentType,
  DocumentUploadFilters,
  DocumentUploadItem,
  DocumentUploadListResponse,
  UploadBatchResponse,
} from '../interfaces/document-upload.interface';

@Injectable({ providedIn: 'root' })
export class DocumentUploadsService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private readonly baseUrl = environment.urlBD + '/document-uploads';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getTypes(): Observable<DocumentType[]> {
    return this._http
      .get<DocumentType[]>(`${this.baseUrl}/types`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  list(filters: DocumentUploadFilters = {}): Observable<DocumentUploadListResponse> {
    let params = new HttpParams()
      .set('page', String(filters.page ?? 1))
      .set('pageSize', String(filters.pageSize ?? 20));
    if (filters.status) params = params.set('status', filters.status);
    if (filters.documentTypeId) params = params.set('documentTypeId', String(filters.documentTypeId));
    if (filters.search) params = params.set('search', filters.search);
    if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params = params.set('dateTo', filters.dateTo);

    return this._http
      .get<DocumentUploadListResponse>(this.baseUrl, { headers: this.getHeaders(), params })
      .pipe(catchError(this.handleError));
  }

  getById(id: number): Observable<DocumentUploadItem> {
    return this._http
      .get<DocumentUploadItem>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  upload(documentTypeId: number, files: File[]): Observable<UploadBatchResponse> {
    const formData = new FormData();
    formData.append('documentTypeId', String(documentTypeId));
    files.forEach((file) => formData.append('files', file));

    return this._http
      .post<UploadBatchResponse>(this.baseUrl, formData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  markManualSend(id: number): Observable<DocumentUploadItem> {
    return this._http
      .patch<DocumentUploadItem>(`${this.baseUrl}/${id}/mark-manual-send`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    const backendMessage = Array.isArray(error?.error?.message)
      ? error.error.message.join(', ')
      : error?.error?.message;

    let msg = 'Ha ocurrido un error inesperado';
    if (error.status === 401) msg = 'Sesión expirada. Inicia sesión nuevamente.';
    else if (error.status === 403) msg = backendMessage || 'Tu rol no tiene permiso para realizar esta acción.';
    else if (error.status === 400) msg = backendMessage || 'Datos no válidos';
    else if (error.status >= 500) msg = backendMessage || 'Error del servidor. Intenta nuevamente.';
    else if (backendMessage) msg = backendMessage;

    return throwError(() => new Error(msg));
  }
}
