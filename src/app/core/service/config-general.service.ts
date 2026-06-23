import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import { ParamConfigGeneral } from '../interfaces/param-config-general.interface';

@Injectable({
  providedIn: 'root',
})
export class ConfigGeneralService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  findAll(): Observable<ParamConfigGeneral[]> {
    return this._http
      .get<ParamConfigGeneral[]>(`${environment.urlBD}/param-config-general`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  findByKey(key: string): Observable<ParamConfigGeneral> {
    return this._http
      .get<ParamConfigGeneral>(`${environment.urlBD}/param-config-general/${key}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  getValue(key: string): Observable<string> {
    return this._http
      .get<{ value: string }>(`${environment.urlBD}/param-config-general/${key}/value`, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) => response.value),
        catchError(this.handleError)
      );
  }

  private handleError(error: any): Observable<never> {
    console.error('Error en ConfigGeneralService:', error);
    return throwError(() => error);
  }
}
