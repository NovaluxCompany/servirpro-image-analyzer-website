import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service'; // Asegúrate de que la ruta sea correcta
import { PensionInterface } from '../interfaces/pension.interface';

@Injectable({
  providedIn: 'root',
})
export class PensionService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getPensions(): Observable<PensionInterface[]> {
    return this._http
      .get<PensionInterface[]>(`${environment.urlBD}/pensions/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error en el servicio de pensiones';
    if (error.status === 401) {
      errorMessage = 'Sesión expirada.';
    }
    return throwError(() => new Error(errorMessage));
  }
}
