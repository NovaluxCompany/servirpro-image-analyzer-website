import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from '../../core/service/token.service';
import { Affiliate } from '../interfaces/affiliate.interface';

@Injectable({
  providedIn: 'root',
})
export class AffiliatesService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/affiliates';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  searchAffiliates(search: string): Observable<Affiliate[]> {
    const params = new HttpParams().set('search', search);

    return this._http
      .get<Affiliate[]>(`${environment.urlBD}/affiliates/search`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Ha ocurrido un error al buscar afiliados';

    if (error.status === 401) {
      errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
    } else if (error.status === 404) {
      errorMessage = 'No se encontraron afiliados';
    } else if (error.status >= 500) {
      errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
    }

    return throwError(() => new Error(errorMessage));
  }
}
