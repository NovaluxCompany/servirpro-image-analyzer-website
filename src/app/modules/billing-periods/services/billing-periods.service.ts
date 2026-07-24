import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { BillingPeriod } from '../interfaces/billing-period.interface';

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

  private handleError(error: any): Observable<never> {
    let msg = 'Ha ocurrido un error inesperado';
    if (error.status === 401) msg = 'Sesión expirada. Inicia sesión nuevamente.';
    else if (error.status === 403) msg = 'No tienes permiso para ver los periodos de facturación.';
    else if (error.status >= 500) msg = 'Error del servidor. Intenta más tarde.';
    return throwError(() => new Error(msg));
  }
}
