import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import {
  ActiveDeactivationResponse,
  AffiliateTransactionRow,
  DeactivateAffiliateRow,
  DeactivateAffiliatesResponse,
  DeactivationContext,
  InactivationAffiliateRow,
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

interface RawInactivationAffiliateRow {
  affiliate_id?: number;
  affiliateId?: number;
  nombre?: string;
  apellido?: string;
  documento?: string;
  plan?: string;
  monto_esperado?: number | string;
  montoEsperado?: number | string;
  monto_pagado?: number | string;
  montoPagado?: number | string;
  diferencia?: number | string;
  ultimo_pago?: string | null;
  ultimoPago?: string | null;
}

interface RawAffiliateTransactionRow {
  transaction_id?: number;
  transactionId?: number;
  fecha?: string;
  monto?: number | string;
  concepto?: string;
  estado?: string;
  observacion?: string | null;
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

  getUnpaidAffiliates(): Observable<InactivationAffiliateRow[]> {
    return this._http
      .get<RawInactivationAffiliateRow[]>(`${this.baseUrl}/inactivation/unpaid`, {
        headers: this.getHeaders(),
      })
      .pipe(map((rows) => rows.map((row) => this.normalizeInactivationRow(row, false))))
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar afiliados sin pago')));
  }

  getUnderpaidAffiliates(): Observable<InactivationAffiliateRow[]> {
    return this._http
      .get<RawInactivationAffiliateRow[]>(`${this.baseUrl}/inactivation/underpaid`, {
        headers: this.getHeaders(),
      })
      .pipe(map((rows) => rows.map((row) => this.normalizeInactivationRow(row, true))))
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar afiliados con pago incompleto')));
  }

  getAffiliateTransactions(affiliateId: number, month?: number, year?: number): Observable<AffiliateTransactionRow[]> {
    let params = new HttpParams();

    if (month !== undefined) {
      params = params.set('month', month);
    }

    if (year !== undefined) {
      params = params.set('year', year);
    }

    return this._http
      .get<RawAffiliateTransactionRow[]>(`${this.baseUrl}/${affiliateId}/transactions`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(map((rows) => rows.map((row) => this.normalizeTransactionRow(row))))
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar el detalle de transacciones')));
  }

  private normalizeInactivationRow(
    row: RawInactivationAffiliateRow,
    includePaymentFields: boolean,
  ): InactivationAffiliateRow {
    const montoEsperado = Number(row.monto_esperado ?? row.montoEsperado ?? 0);
    const montoPagado = Number(row.monto_pagado ?? row.montoPagado ?? 0);
    const diferencia = Number(row.diferencia ?? montoEsperado - montoPagado);

    return {
      affiliateId: Number(row.affiliate_id ?? row.affiliateId ?? 0),
      nombre: row.nombre ?? '',
      apellido: row.apellido ?? '',
      documento: row.documento ?? '',
      plan: row.plan ?? '',
      montoEsperado,
      montoPagado: includePaymentFields ? montoPagado : undefined,
      diferencia: includePaymentFields ? diferencia : undefined,
      ultimoPago: row.ultimo_pago ?? row.ultimoPago ?? null,
    };
  }

  private normalizeTransactionRow(row: RawAffiliateTransactionRow): AffiliateTransactionRow {
    return {
      transactionId: Number(row.transaction_id ?? row.transactionId ?? 0),
      fecha: row.fecha ?? '',
      monto: Number(row.monto ?? 0),
      concepto: row.concepto ?? '',
      estado: row.estado ?? '',
      observacion: row.observacion ?? null,
    };
  }

  private handleError(error: any, fallbackMessage: string): Observable<never> {
    const backendMessage = error?.error?.message;
    if (Array.isArray(backendMessage)) {
      return throwError(() => new Error(backendMessage.join(' ')));
    }

    return throwError(() => new Error(backendMessage || fallbackMessage));
  }
}
