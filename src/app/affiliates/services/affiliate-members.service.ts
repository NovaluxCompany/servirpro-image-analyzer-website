import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from '../../core/service/token.service';
import {
  AffiliateMember,
  CreateAffiliateMemberDto,
  UpdateAffiliateMemberDto,
} from '../interfaces/affiliate-member.interface';
import {
  Plan,
  Company,
  Grouper,
  Advisor,
  EpsItem,
} from '../interfaces/catalog.interface';
import { PaginatedAffiliatesResponse } from '../interfaces/paginated-affiliates.interface';

@Injectable({ providedIn: 'root' })
export class AffiliateMembersService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private readonly baseUrl = environment.urlBD + '/affiliates';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Listado paginado ───────────────────────────────────────────────
  getAffiliates(): Observable<AffiliateMember[]> {
    return this._http
      .get<AffiliateMember[]>(`${this.baseUrl}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  // ── Crear afiliado ────────────────────────────────────────────────
  createAffiliate(dto: CreateAffiliateMemberDto): Observable<AffiliateMember> {
    return this._http
      .post<AffiliateMember>(this.baseUrl, dto, { headers: this.getHeaders() })
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

  // ── Catálogos (retornan vacío si el endpoint aún no existe) ───────
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

  // ── Búsqueda ADRES por tipo + número de documento ─────────────────
  searchAdres(documentType: string, documentNumber: string): Observable<any> {
    const params = new HttpParams()
      .set('documentType', documentType)
      .set('documentNumber', documentNumber);
    return this._http
      .get<any>(`${this.baseUrl}/adres`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(catchError(() => of({ found: false })));
  }

  // ── Búsqueda por documento (ADRES / Local) ────────────────────────
  searchByDocument(doc: string): Observable<Partial<AffiliateMember>> {
    return this._http
      .get<any>(`${this.baseUrl}/search/${doc}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
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
