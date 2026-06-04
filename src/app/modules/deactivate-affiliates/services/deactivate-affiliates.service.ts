import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import {
  ActiveDeactivationResponse,
  DeactivateAffiliateRow,
  DeactivateAffiliatesResponse,
  DeactivationContext,
} from '../interfaces/deactivate-affiliates.interface';

interface RawDeactivateAffiliateRow {
  id: number;
  nombre?: string;
  cedula?: string;
  referencia?: string;
  nombrePlan?: string;
  fechaCreacion?: string;
  fechaIngreso?: string | null;
  asesor?: string;
  empresa?: string;
  agrupadora?: string;
  profesion?: string;
  fullName?: string;
  documentNumber?: string;
  reference?: string;
  planName?: string;
  createdAt?: string;
  entryDate?: string | null;
  advisorName?: string;
  companyName?: string;
  grouperName?: string;
  profession?: string;
}

interface RawActiveDeactivationResponse extends Omit<ActiveDeactivationResponse, 'data'> {
  data: RawDeactivateAffiliateRow[];
}

@Injectable({
  providedIn: 'root',
})
export class DeactivateAffiliatesService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/affiliates';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getContext(): Observable<DeactivationContext> {
    return this._http
      .get<DeactivationContext>(`${this.baseUrl}/deactivation/context`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError((error) => this.handleError(error, 'Error al obtener contexto de desactivación')));
  }

  getActiveAffiliates(page: number): Observable<ActiveDeactivationResponse> {
    const params = new HttpParams().set('page', page);

    return this._http
      .get<RawActiveDeactivationResponse>(`${this.baseUrl}/deactivation/active`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(
        map((response) => ({
          ...response,
          data: response.data.map((row) => this.normalizeRow(row)),
        })),
      )
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar afiliados activos')));
  }

  private normalizeRow(row: RawDeactivateAffiliateRow): DeactivateAffiliateRow {
    return {
      id: row.id,
      nombre: row.nombre ?? row.fullName ?? '',
      cedula: row.cedula ?? row.documentNumber ?? '',
      referencia: row.referencia ?? row.reference ?? '',
      nombrePlan: row.nombrePlan ?? row.planName ?? '',
      fechaCreacion: row.fechaCreacion ?? row.createdAt ?? '',
      fechaIngreso: row.fechaIngreso ?? row.entryDate ?? null,
      asesor: row.asesor ?? row.advisorName ?? '',
      empresa: row.empresa ?? row.companyName ?? '',
      agrupadora: row.agrupadora ?? row.grouperName ?? '',
      profesion: row.profesion ?? row.profession ?? '',
    };
  }

  deactivateAffiliates(affiliateIds: number[]): Observable<DeactivateAffiliatesResponse> {
    return this._http
      .post<DeactivateAffiliatesResponse>(
        `${this.baseUrl}/deactivation`,
        { affiliateIds },
        { headers: this.getHeaders() },
      )
      .pipe(catchError((error) => this.handleError(error, 'Error al desactivar afiliados')));
  }

  private handleError(error: any, fallbackMessage: string): Observable<never> {
    const backendMessage = error?.error?.message;
    if (Array.isArray(backendMessage)) {
      return throwError(() => new Error(backendMessage.join(' ')));
    }

    return throwError(() => new Error(backendMessage || fallbackMessage));
  }
}
