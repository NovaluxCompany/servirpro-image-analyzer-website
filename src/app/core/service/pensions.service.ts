import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment'
import { TokenService } from './token.service';
import { Pension } from '../interfaces/pension.interface';

@Injectable({
  providedIn: 'root',
})
export class PensionsService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  findAll(): Observable<Pension[]> {
    return this._http
      .get<Pension[]>(`${environment.urlBD}/pensions`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  findForDropdown(): Observable<Pension[]> {
    return this._http
      .get<Pension[]>(`${environment.urlBD}/pensions/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Ha ocurrido un error con el servicio de pensiones';

    if (error.status === 401) {
      errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
    } else if (error.status === 404) {
      errorMessage = 'No se encontraron pensiones';
    } else if (error.status >= 500) {
      errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
    }

    return throwError(() => new Error(errorMessage));
  }
}
