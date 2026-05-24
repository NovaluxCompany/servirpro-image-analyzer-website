import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service'; // Asegúrate de que la ruta sea correcta
import { CompensationBoxInterface } from '../interfaces/compensation-box.interface';

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

  getCompensationBoxes(): Observable<CompensationBoxInterface[]> {
    return this._http
      .get<CompensationBoxInterface[]>(`${environment.urlBD}/compensation_box/dropdown`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error en el servicio de cajas de compensación';
    if (error.status === 401) {
      errorMessage = 'Sesión expirada.';
    }
    return throwError(() => new Error(errorMessage));
  }
}
