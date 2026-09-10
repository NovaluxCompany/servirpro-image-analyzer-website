import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import {
  CancelIncapacityDto,
  Cie10Diagnosis,
  CreateIncapacityDto,
  GrouperOption,
  Incapacity,
  IncapacityDocument,
  IncapacityFilters,
  IncapacityCatalogs,
  IncapacityGrouperRoute,
  IncapacityLogEntry,
  IncapacityRoute,
  PaginatedIncapacities,
  SignedDocumentUrl,
  UpdateServirproStatusDto,
  UpdateThirdPartyStatusDto,
} from '../interfaces/incapacity.interface';

/**
 * La CIE-10 es un catálogo clínico transversal, no algo del módulo: vive
 * fuera de /incapacities. Está aparte para que cambiar la ruta (o moverla
 * bajo el módulo si el backend la expone ahí) sea una sola línea.
 */
const DIAGNOSIS_SEARCH_URL = () => `${environment.urlBD}/cie10`;
const DIAGNOSIS_SEARCH_LIMIT = 20;

@Injectable({ providedIn: 'root' })
export class IncapacitiesService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private readonly baseUrl = environment.urlBD + '/incapacities';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getIncapacities(
    filters: IncapacityFilters = {},
    page: number = 1,
    limit: number = 20,
  ): Observable<PaginatedIncapacities> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

    if (filters.affiliationId) params = params.set('affiliationId', filters.affiliationId.toString());
    if (filters.documentNumber) params = params.set('documentNumber', filters.documentNumber);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.servirproStatus) params = params.set('servirproStatus', filters.servirproStatus);
    if (filters.thirdPartyStatus) params = params.set('thirdPartyStatus', filters.thirdPartyStatus);
    if (filters.routedTo) params = params.set('routedTo', filters.routedTo);
    if (filters.registeredInPila !== undefined) {
      params = params.set('registeredInPila', String(filters.registeredInPila));
    }
    if (filters.cancelled !== undefined) {
      params = params.set('cancelled', String(filters.cancelled));
    }

    return this._http
      .get<PaginatedIncapacities>(this.baseUrl, { headers: this.getHeaders(), params })
      .pipe(catchError(this.handleError));
  }

  getIncapacity(id: number): Observable<Incapacity> {
    return this._http
      .get<Incapacity>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Registra la incapacidad y sus soportes en una sola petición.
   * `documentTypes` viaja en el mismo orden que `files`.
   */
  createIncapacity(
    dto: CreateIncapacityDto,
    files: File[] = [],
    documentTypes: string[] = [],
  ): Observable<Incapacity> {
    const formData = new FormData();
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, String(value));
      }
    });
    files.forEach((file) => formData.append('files', file));
    documentTypes.forEach((type) => formData.append('documentTypes', type));

    return this._http
      .post<Incapacity>(this.baseUrl, formData, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getLog(incapacityId: number): Observable<IncapacityLogEntry[]> {
    return this._http
      .get<IncapacityLogEntry[]>(`${this.baseUrl}/${incapacityId}/log`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /** Origen y entidad que responde. Los dos vienen juntos: el modal necesita ambos. */
  getCatalogs(): Observable<IncapacityCatalogs> {
    return this._http
      .get<IncapacityCatalogs>(`${this.baseUrl}/catalogs`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Busca en la CIE-10. A diferencia de getCatalogs(), la lista NUNCA se trae
   * completa: son ~14.000 códigos, así que se consulta por texto y el backend
   * devuelve solo los primeros `limit` que matcheen por código o descripción.
   *
   * Un error acá devuelve lista vacía en vez de propagar: que el catálogo no
   * responda no debe romper el formulario, el diagnóstico es opcional.
   */
  searchDiagnoses(query: string, limit = DIAGNOSIS_SEARCH_LIMIT): Observable<Cie10Diagnosis[]> {
    const params = new HttpParams().set('q', query).set('limit', String(limit));

    return this._http
      .get<Cie10Diagnosis[]>(DIAGNOSIS_SEARCH_URL(), { headers: this.getHeaders(), params })
      .pipe(catchError(() => of([])));
  }

  getGrouperRoutes(): Observable<IncapacityGrouperRoute[]> {
    return this._http
      .get<IncapacityGrouperRoute[]>(`${this.baseUrl}/routes/mapping`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Agrupadoras para el filtro del listado. Sale del catálogo general y no
   * de `/routes/mapping` a propósito: ahí solo están las que ya tienen una
   * gestión configurada, y el filtro debe poder mostrar también las que no
   * (hoy, ORDINARIAS).
   */
  getGroupers(): Observable<GrouperOption[]> {
    return this._http
      .get<GrouperOption[]>(`${environment.urlBD}/groupers/dropdown`, { headers: this.getHeaders() })
      .pipe(catchError(() => of([])));
  }

  /**
   * Aprueba o rechaza del lado de Servirpro. Al aprobar, el backend enruta
   * según la agrupadora y, si es Gestión, dispara el correo.
   */
  updateServirproStatus(id: number, dto: UpdateServirproStatusDto): Observable<Incapacity> {
    return this._http
      .patch<Incapacity>(`${this.baseUrl}/${id}/servirpro-status`, dto, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  updateThirdPartyStatus(id: number, dto: UpdateThirdPartyStatusDto): Observable<Incapacity> {
    return this._http
      .patch<Incapacity>(`${this.baseUrl}/${id}/third-party-status`, dto, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  route(id: number, route?: IncapacityRoute): Observable<Incapacity> {
    return this._http
      .post<Incapacity>(`${this.baseUrl}/${id}/route`, route ? { route } : {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  markPila(id: number, registeredInPila: boolean): Observable<Incapacity> {
    return this._http
      .patch<Incapacity>(`${this.baseUrl}/${id}/pila`, { registeredInPila }, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  resendEmail(id: number): Observable<{ success: boolean; message: string }> {
    return this._http
      .post<{ success: boolean; message: string }>(`${this.baseUrl}/${id}/resend-email`, {}, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  /** Envía el correo a Gestión y, solo si se entrega, aprueba y enruta. Si falla, no cambia nada. */
  sendEmailAndApprove(id: number): Observable<Incapacity> {
    return this._http
      .post<Incapacity>(`${this.baseUrl}/${id}/send-email-approve`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * `documentTypes` viaja en el mismo orden que `files`: el backend rechaza
   * la carga si las dos listas no coinciden en cantidad.
   */
  uploadDocuments(
    incapacityId: number,
    files: File[],
    documentTypes: string[],
  ): Observable<IncapacityDocument[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    documentTypes.forEach((type) => formData.append('documentTypes', type));

    return this._http
      .post<IncapacityDocument[]>(`${this.baseUrl}/${incapacityId}/documents`, formData, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  /**
   * URL firmada temporal (5 minutos). Es el único camino de acceso a un
   * soporte: si el documento es historia clínica y el usuario no tiene el
   * permiso, responde 403 y el intento queda auditado en el backend.
   */
  getDocumentUrl(incapacityId: number, documentId: number): Observable<SignedDocumentUrl> {
    return this._http
      .get<SignedDocumentUrl>(`${this.baseUrl}/${incapacityId}/documents/${documentId}/url`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  deleteDocument(incapacityId: number, documentId: number): Observable<void> {
    return this._http
      .delete<void>(`${this.baseUrl}/${incapacityId}/documents/${documentId}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  /** Anular: reversible-con-rastro, requiere el permiso 'cancel'. */
  cancel(id: number, dto: CancelIncapacityDto): Observable<Incapacity> {
    return this._http
      .patch<Incapacity>(`${this.baseUrl}/${id}/cancel`, dto, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /** Borrado físico. El backend ya lo restringe a Administrador; acá solo se muestra el botón si el permiso está. */
  remove(id: number): Observable<void> {
    return this._http
      .delete<void>(`${this.baseUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Reporte Excel. Se pide con responseType 'blob': el navegador arma la
   * descarga, no hay nada que parsear como JSON.
   */
  exportToExcel(filters: IncapacityFilters = {}): Observable<Blob> {
    let params = new HttpParams();
    if (filters.documentNumber) params = params.set('documentNumber', filters.documentNumber);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.servirproStatus) params = params.set('servirproStatus', filters.servirproStatus);
    if (filters.thirdPartyStatus) params = params.set('thirdPartyStatus', filters.thirdPartyStatus);
    if (filters.routedTo) params = params.set('routedTo', filters.routedTo);
    if (filters.registeredInPila !== undefined) {
      params = params.set('registeredInPila', String(filters.registeredInPila));
    }
    if (filters.cancelled !== undefined) params = params.set('cancelled', String(filters.cancelled));

    return this._http
      .get(`${this.baseUrl}/export/excel`, { headers: this.getHeaders(), params, responseType: 'blob' })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    const message =
      error.error?.message ?? 'No se pudo completar la operación. Intenta de nuevo.';
    return throwError(() => new Error(Array.isArray(message) ? message.join(' ') : message));
  }
}
