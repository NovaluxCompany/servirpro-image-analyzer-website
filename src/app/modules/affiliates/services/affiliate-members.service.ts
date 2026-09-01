import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, from, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { AffiliateMember,CreateAffiliateMemberDto,UpdateAffiliateMemberDto,} from '../interfaces/affiliate-member.interface';
import { Plan, Company, Grouper, Advisor, EpsItem, Pension, CompensationBox, Branch, Department, CityOption, } from '../interfaces/catalog.interface';
import { PaginatedAffiliatesResponse } from '../interfaces/paginated-affiliates.interface';

export interface AffiliateFilters {
  page?: number;
  limit?: number;
  name?: string;
  cedula?: string;
  reference?: string;
  advisor?: string;
  isActive?: boolean;
  grupo?: string;
  entryDateFrom?: string;
  entryDateTo?: string;
  paymentStatus?: 'paid' | 'unpaid';
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
    if (filters.grupo) params = params.set('grupo', filters.grupo);
    if (filters.entryDateFrom) params = params.set('entryDateFrom', filters.entryDateFrom);
    if (filters.entryDateTo) params = params.set('entryDateTo', filters.entryDateTo);
    if (filters.paymentStatus) params = params.set('paymentStatus', filters.paymentStatus);

    return this._http
      .get<PaginatedAffiliatesResponse>(`${this.baseUrl}`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(catchError(this.handleError));
  }

  // ── Verificar si un número de documento ya tiene una afiliación (activa o no) ──
  // Reutiliza el endpoint existente email-status/:cedula, que ya busca por
  // documento sin filtrar por estado. 404 significa "no existe" (no es un error real).
  checkDocumentExists(documentNumber: string): Observable<{ exists: boolean; isActive: boolean } | null> {
    return this._http
      .get<{ affiliationId: number; isActive: boolean }>(`${this.baseUrl}/email-status/${documentNumber}`, {
        headers: this.getHeaders(),
      })
      .pipe(
        switchMap((res) => of({ exists: true, isActive: res.isActive })),
        catchError(() => of({ exists: false, isActive: false })),
      );
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
  uploadDocuments(affiliateId: string | number, files: File[]): Observable<any> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
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
  // `reason`/`reasonTypeId` solo aplican al deshabilitar (se ignoran al habilitar).
  // reasonTypeId es el id de deactivation_reasons (FK real); queda guardado en
  // affiliations.deactivation_reason_type_id (+ el code en deactivation_reason_type).
  toggleStatus(
    id: string,
    reason?: string,
    reasonTypeId?: number,
  ): Observable<AffiliateMember> {
    return this._http
      .patch<AffiliateMember>(
        `${this.baseUrl}/${id}/toggle`,
        { reason, reasonTypeId },
        { headers: this.getHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  // ── Enviar / sincronizar afiliado con Siigo ─────────────────────────
  syncToSiigo(id: number): Observable<{ siigoSyncStatus: string; siigoId: string | null; siigoSyncError: string | null }> {
    return this._http
      .post<{ siigoSyncStatus: string; siigoId: string | null; siigoSyncError: string | null }>(
        `${this.baseUrl}/${id}/sync-siigo`,
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
    if (filters.grupo) params = params.set('grupo', filters.grupo);
    if (filters.entryDateFrom) params = params.set('entryDateFrom', filters.entryDateFrom);
    if (filters.entryDateTo) params = params.set('entryDateTo', filters.entryDateTo);
    if (filters.paymentStatus) params = params.set('paymentStatus', filters.paymentStatus);

    return this._http
      .get(`${this.baseUrl}/export/excel`, {
        headers: this.getHeaders(),
        params,
        responseType: 'blob',
      })
      .pipe(catchError((error) => this.handleBlobError(error)));
  }

  // Con responseType 'blob', un error 400 con cuerpo JSON (ej. "no hay resultados
  // para esos filtros") llega como Blob en error.error, no como objeto parseado —
  // hay que leerlo como texto y parsearlo antes de poder mostrar el mensaje real.
  private handleBlobError = (error: any): Observable<never> => {
    const blob: Blob | undefined = error?.error;
    if (blob instanceof Blob && blob.type?.includes('json')) {
      return from(blob.text()).pipe(
        switchMap((text: string) => {
          try {
            error.error = JSON.parse(text);
          } catch {
            // deja error.error como venía si no es JSON parseable
          }
          return this.handleError(error);
        }),
      );
    }
    return this.handleError(error);
  };

  // ── Enviar correo vía n8n ──────────────────────────────────────────
  // emails=undefined (Dependiente/Gestión): el backend usa el correo registrado
  // del afiliado por defecto. emails=[...] (Independiente): se envía solo a esos.
  sendEmail(affiliationId: number, emails: string[] | undefined, observation?: string): Observable<{ success: boolean; message: string }> {
    return this._http
      .post<{ success: boolean; message: string }>(
        `${environment.urlBD}/affiliates/${affiliationId}/send-email`,
        { emails, observation },
        { headers: this.getHeaders() }
      )
      .pipe(catchError(this.handleError));
  }

  // ── Envío de documentos por WhatsApp ────────────────────────────────
  getWhatsappSourceNumbers(): Observable<{ id: number; ownerName: string }[]> {
    return this._http
      .get<{ id: number; ownerName: string }[]>(`${this.baseUrl}/whatsapp/source-numbers`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  sendWhatsapp(
    affiliationId: number,
    sourceNumberId: number,
    destinationPhone: string,
    files: { file: File; certType: 'EPS' | 'ARL' | 'CCF' | 'AFP' }[],
  ): Observable<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('sourceNumberId', String(sourceNumberId));
    formData.append('destinationPhone', destinationPhone);
    files.forEach(({ file, certType }) => {
      formData.append('files', file);
      formData.append('certTypes', certType);
    });

    const token = this._tokenService.getToken();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this._http
      .post<{ success: boolean; message: string }>(`${this.baseUrl}/${affiliationId}/whatsapp-send`, formData, { headers })
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

  getDepartments(): Observable<Department[]> {
    return this._http
      .get<Department[]>(`${environment.urlBD}/cities/departments`, { headers: this.getHeaders() })
      .pipe(catchError(() => of([])));
  }

  getCitiesByDepartment(departmentCode: string): Observable<CityOption[]> {
    const params = new HttpParams().set('departmentCode', departmentCode);
    return this._http
      .get<CityOption[]>(`${environment.urlBD}/cities/dropdown`, { headers: this.getHeaders(), params })
      .pipe(catchError(() => of([])));
  }

  getBranchesDropdown(): Observable<Branch[]> {
    return this._http
      .get<Branch[]>(`${environment.urlBD}/branches/dropdown`, { headers: this.getHeaders() })
      .pipe(catchError(() => of([])));
  }

  // Reemplazan las listas hardcodeadas de origen del afiliado y motivo de
  // deshabilitación: ahora salen de affiliate_origins / deactivation_reasons.
  // El `id` es lo que se manda al crear/editar/deshabilitar (originId /
  // reasonTypeId); `code`/`label` son solo para mostrar y para formatear
  // valores ya guardados que llegan del backend.
  getOrigins(): Observable<{ id: number; code: string; label: string }[]> {
    return this._http
      .get<{ id: number; code: string; label: string }[]>(`${environment.urlBD}/affiliate-origins/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  getDeactivationReasons(): Observable<{ id: number; code: string; label: string }[]> {
    return this._http
      .get<{ id: number; code: string; label: string }[]>(`${environment.urlBD}/deactivation-reasons/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(() => of([])));
  }

  // ── Manejo de errores ─────────────────────────────────────────────
  private handleError(error: any): Observable<never> {
    const backendMessage = Array.isArray(error?.error?.message)
      ? error.error.message.join(', ')
      : error?.error?.message;

    let msg = 'Ha ocurrido un error inesperado';
    if (error.status === 401) msg = 'Sesión expirada. Inicia sesión nuevamente.';
    else if (error.status === 403)
      msg = backendMessage || 'Tu rol no tiene permiso para realizar esta acción.';
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
