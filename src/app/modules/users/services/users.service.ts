import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { TokenService } from '../../../core/service/token.service';
import { environment } from '../../../../environments/environment';
import { SystemUser, CreateUserPayload, UpdateUserPayload } from '../interfaces/user.interface';

@Injectable({ providedIn: 'root' })
export class UsersManagementService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private readonly baseUrl = environment.urlBD + '/users';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private handleError(error: any): Observable<never> {
    const message =
      error?.error?.message ?? error?.message ?? 'Error inesperado. Intenta de nuevo.';
    const wrapped = new Error(message) as Error & { status?: number };
    wrapped.status = error?.status;
    return throwError(() => wrapped);
  }

  getUsers(): Observable<SystemUser[]> {
    return this._http
      .get<SystemUser[]>(this.baseUrl, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  createUser(payload: CreateUserPayload): Observable<SystemUser> {
    return this._http
      .post<SystemUser>(this.baseUrl, payload, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  updateUser(id: number, payload: UpdateUserPayload): Observable<SystemUser> {
    return this._http
      .patch<SystemUser>(`${this.baseUrl}/${id}`, payload, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  toggleStatus(id: number): Observable<SystemUser> {
    return this._http
      .patch<SystemUser>(`${this.baseUrl}/${id}/status`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  assignRole(userId: number, roleId: number): Observable<void> {
    return this._http
      .patch<void>(`${this.baseUrl}/${userId}/role`, { roleId }, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }
}
