import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { BillingPeriod } from '../interfaces/billing-period.interface';
import { BillingPeriodFilters } from '../interfaces/billing-period-filters.interface';
import { PaginatedResponse } from '../../transactions/interfaces/paginated-response.interface';
import { SiigoInvoicePayloadPreview } from '../interfaces/siigo-invoice-payload.interface';

@Injectable({ providedIn: 'root' })
export class BillingPeriodsService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private readonly baseUrl = environment.urlBD + '/affiliate-billing-periods';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getBillingPeriods(): Observable<BillingPeriod[]> {
    return this._http
      .get<BillingPeriod[]>(this.baseUrl, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getPaginatedBillingPeriods(
    filters: BillingPeriodFilters,
    page: number = 1,
    limit: number = 10,
  ): Observable<PaginatedResponse<BillingPeriod>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('dateFrom', filters.dateFrom)
      .set('dateTo', filters.dateTo);

    if (filters.status) params = params.set('status', filters.status);

    return this._http
      .get<PaginatedResponse<BillingPeriod>>(`${this.baseUrl}/paginated`, { headers: this.getHeaders(), params })
      .pipe(catchError(this.handleError));
  }

  getSiigoInvoicePayloadPreview(id: number, mora: number = 0): Observable<SiigoInvoicePayloadPreview> {
    const params = new HttpParams().set('mora', mora.toString());
    return this._http
      .get<SiigoInvoicePayloadPreview>(`${this.baseUrl}/${id}/siigo-payload`, { headers: this.getHeaders(), params })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    let msg = 'Ha ocurrido un error inesperado';
    if (error.status === 401) msg = 'Sesión expirada. Inicia sesión nuevamente.';
    else if (error.status === 403) msg = 'No tienes permiso para ver los periodos de facturación.';
    else if (error.status === 400) {
      if (Array.isArray(error.error?.message)) msg = error.error.message.join(', ');
      else if (error.error?.message) msg = error.error.message;
      else msg = 'Los datos enviados no son válidos';
    }
    else if (error.status >= 500) msg = 'Error del servidor. Intenta más tarde.';
    return throwError(() => new Error(msg));
  }
}
