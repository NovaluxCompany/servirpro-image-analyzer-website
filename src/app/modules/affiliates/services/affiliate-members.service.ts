import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { AffiliateMember,CreateAffiliateMemberDto,UpdateAffiliateMemberDto,} from '../interfaces/affiliate-member.interface';
import { Plan, Company, Grouper, Advisor, EpsItem, Pension, CompensationBox, } from '../interfaces/catalog.interface';
import { PaginatedAffiliatesResponse } from '../interfaces/paginated-affiliates.interface';

export interface AffiliateFilters {
  page?: number;
  limit?: number;
  name?: string;
  cedula?: string;
  reference?: string;
  advisor?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AffiliateMembersService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private readonly baseUrl = environment.urlBD + '/affiliates';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Listado paginado con filtros ───────────────────────────────────
  getAffiliates(filters: AffiliateFilters = {}): Observable<PaginatedAffiliatesResponse> {
    let params = new HttpParams()
      .set('page', String(filters.page ?? 1))
      .set('limit', String(filters.limit ?? 10));
    if (filters.name) params = params.set('name', filters.name);
    if (filters.cedula) params = params.set('cedula', filters.cedula);
    if (filters.reference) params = params.set('reference', filters.reference);
    if (filters.advisor) params = params.set('advisor', filters.advisor);
    if (filters.isActive !== undefined) params = params.set('isActive', String(filters.isActive));

    return this._http
      .get<PaginatedAffiliatesResponse>(`${this.baseUrl}`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(catchError(this.handleError));
  }

  // ── Referencias disponibles ───────────────────────────────────────
  getReferences(): Observable<string[]> {
    return this._http
      .get<string[]>(`${this.baseUrl}/references`, { headers: this.getHeaders() })
      .pipe(catchError(() => of([])));
  }

  // ── Crear afiliado ────────────────────────────────────────────────
  createAffiliate(dto: CreateAffiliateMemberDto): Observable<AffiliateMember> {
    return this._http
      .post<AffiliateMember>(this.baseUrl, dto, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ── Subir documento a afiliado existente ───────────────────────────────────
  uploadDocument(affiliateId: string | number, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const token = this._tokenService.getToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this._http
      .post<any>(`${this.baseUrl}/${affiliateId}/documents`, formData, { headers })
      .pipe(catchError(this.handleError));
  }

  // ── Eliminar documento de afiliado ────────────────────────────────
  deleteDocument(affiliateId: string | number, documentId: number): Observable<void> {
    return this._http
      .delete<void>(`${this.baseUrl}/${affiliateId}/documents/${documentId}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  // ── Editar afiliado ───────────────────────────────────────────────
  updateAffiliate(
    id: string,
    dto: UpdateAffiliateMemberDto
  ): Observable<AffiliateMember> {
    return this._http
      .patch<AffiliateMember>(`${this.baseUrl}/${id}`, dto, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  // ── Descargar documento como blob ────────────────────────────────
  downloadBlob(id: string, documentId: number): Observable<Blob> {
    // Paso 1: pedir la URL firmada (o pública) al backend
    return this._http
      .get<{ url: string }>(`${this.baseUrl}/${id}/documents/${documentId}/download`, {
        headers: this.getHeaders(),
      })
      .pipe(
        // Paso 2: descargar el archivo real con esa URL
        switchMap(({ url }) => this._http.get(url, { responseType: 'blob' })),
        catchError(this.handleError),
      );
  }

  // ── Activar / Desactivar ──────────────────────────────────────────
  toggleStatus(id: string): Observable<AffiliateMember> {
    return this._http
      .patch<AffiliateMember>(
        `${this.baseUrl}/${id}/toggle`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  // ── Exportar afiliados a Excel ────────────────────────────────────
  exportToExcel(filters: AffiliateFilters = {}): Observable<Blob> {
    let params = new HttpParams();
    if (filters.name) params = params.set('name', filters.name);
    if (filters.cedula) params = params.set('cedula', filters.cedula);
    if (filters.reference) params = params.set('reference', filters.reference);
    if (filters.advisor) params = params.set('advisor', filters.advisor);
    if (filters.isActive !== undefined) {
      params = params.set('isActive', String(filters.isActive));
    }

    return this._http
      .get(`${this.baseUrl}/export/excel`, {
        headers: this.getHeaders(),
        params,
        responseType: 'blob',
      })
      .pipe(catchError(this.handleError));
  }

  // ── Enviar correo vía n8n ──────────────────────────────────────────
  sendEmail(affiliationId: number): Observable<{ success: boolean; message: string }> {
    return this._http
      .post<{ success: boolean; message: string }>(
        `${environment.urlBD}/affiliates/${affiliationId}/send-email`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  // ── Catálogos ─────────────────────────────────────────────────────
  getPlans(): Observable<Plan[]> {
    return this._http
      .get<Plan[]>(`${environment.urlBD}/plans/dropdown`, { headers: this.getHeaders() })
      .pipe(catchError(() => of([])));
  }

  getCompanies(): Observable<Company[]> {
    return this._http
      .get<Company[]>(`${environment.urlBD}/companies/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  getGroupers(): Observable<Grouper[]> {
    return this._http
      .get<Grouper[]>(`${environment.urlBD}/groupers/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  getAdvisors(): Observable<Advisor[]> {
    return this._http
      .get<Advisor[]>(`${environment.urlBD}/advisors/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  getEpsList(): Observable<EpsItem[]> {
    return this._http
      .get<EpsItem[]>(`${environment.urlBD}/eps-providers/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  getPensions(): Observable<Pension[]> {
    return this._http
      .get<Pension[]>(`${environment.urlBD}/pensions/dropdown`, { headers: this.getHeaders() })
      .pipe(catchError(() => of([])));
  }

  getCompensationBoxes(): Observable<CompensationBox[]> {
    return this._http
      .get<CompensationBox[]>(`${environment.urlBD}/compensation_box/dropdown`, { headers: this.getHeaders() })
      .pipe(catchError(() => of([])));
  }

  // ── Manejo de errores ─────────────────────────────────────────────
  private handleError(error: any): Observable<never> {
    let msg = 'Ha ocurrido un error inesperado';
    if (error.status === 401) msg = 'Sesión expirada. Inicia sesión nuevamente.';
    else if (error.status === 409)
      msg = 'Ya existe una afiliación con ese número de documento.';
    else if (error.status === 400) {
      msg = Array.isArray(error.error?.message)
        ? error.error.message.join(', ')
        : error.error?.message || 'Datos no válidos';
    } else if (error.status >= 500)
      msg = 'Error del servidor. Intenta más tarde.';
    return throwError(() => new Error(msg));
  }
}
