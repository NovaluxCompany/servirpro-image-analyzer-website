import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { PricesOverview } from '../interfaces/prices.interface';

@Injectable({ providedIn: 'root' })
export class PricesService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/prices';

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this._tokenService.getToken()}` });
  }

  getOverview(): Observable<PricesOverview> {
    return this._http
      .get<PricesOverview>(this.baseUrl, { headers: this.getHeaders() })
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar los precios')));
  }

  private handleError(error: any, fallbackMessage: string): Observable<never> {
    const backendMessage = error?.error?.message;
    const message = Array.isArray(backendMessage) ? backendMessage.join(' ') : backendMessage || fallbackMessage;
    return throwError(() => new Error(message));
  }
}
