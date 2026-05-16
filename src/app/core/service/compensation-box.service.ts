import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '.../../../src/environments/environment';
import { TokenService } from './token.service';
import { CompensationBox } from '../interfaces/compensation-box.interface';

@Injectable({
  providedIn: 'root',
})
export class CompensationBoxService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  findAll(): Observable<CompensationBox[]> {
    return this._http
      .get<CompensationBox[]>(`${environment.urlBD}/compensation-boxes`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  findForDropdown(): Observable<CompensationBox[]> {
    return this._http
      .get<CompensationBox[]>(`${environment.urlBD}/compensation-boxes/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Ha ocurrido un error con el servicio de cajas de compensación';

    if (error.status === 401) {
      errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
    } else if (error.status === 404) {
      errorMessage = 'No se encontraron cajas de compensación';
    } else if (error.status >= 500) {
      errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
    }

    return throwError(() => new Error(errorMessage));
  }
}
