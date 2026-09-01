import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { Transaction } from '../interfaces/transaction.interface';
import { TransactionFilters } from '../interfaces/transaction-filters.interface';
import { PaginatedResponse } from '../interfaces/paginated-response.interface';

@Injectable({
  providedIn: 'root',
})
export class TransactionsService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/transactions';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getTransactions(filters?: TransactionFilters): Observable<Transaction[]> {
    let params = new HttpParams().set('isActive', 'true');

    if (filters) {
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
      if (filters.affiliate) params = params.set('affiliate', filters.affiliate);
      if (filters.idNumber) params = params.set('idNumber', filters.idNumber);
      if (filters.reference) params = params.set('reference', filters.reference);
      if (filters.uploadedBy) params = params.set('uploadedBy', filters.uploadedBy);
      if (filters.status) params = params.set('status', filters.status);
    }

    return this._http
      .get<Transaction[]>(this.baseUrl, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(catchError(this.handleError));
  }

  getPaginatedTransactions(filters?: TransactionFilters, page: number = 1, limit: number = 10): Observable<PaginatedResponse<Transaction>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('isActive', 'true');

    if (filters) {
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
      if (filters.affiliate) params = params.set('affiliate', filters.affiliate);
      if (filters.idNumber) params = params.set('idNumber', filters.idNumber);
      if (filters.reference) params = params.set('reference', filters.reference);
      if (filters.uploadedBy) params = params.set('uploadedBy', filters.uploadedBy);
      if (filters.status) params = params.set('status', filters.status);
    }

    return this._http
      .get<PaginatedResponse<Transaction>>(`${this.baseUrl}/paginated`, { headers: this.getHeaders(), params })
      .pipe(catchError(this.handleError));
  }

  getTransactionById(id: string): Observable<Transaction> {
    return this._http
      .get<Transaction>(`${this.baseUrl}/${id}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError(this.handleError));
  }

  createTransaction(formData: FormData): Observable<Transaction> {
    const token = this._tokenService.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this._http
      .post<Transaction>(this.baseUrl, formData, {
        headers,
      })
      .pipe(catchError(this.handleError));
  }

  setTransactionActive(id: string, isActive: boolean): Observable<{ id: number; isActive: boolean }> {
    return this._http
      .patch<{ id: number; isActive: boolean }>(`${this.baseUrl}/${id}/active`, { isActive }, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  getLockStatus(): Observable<{ locked: boolean }> {
    return this._http
      .get<{ locked: boolean }>(`${this.baseUrl}/lock-status`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  setLockStatus(locked: boolean): Observable<{ locked: boolean }> {
    return this._http
      .patch<{ locked: boolean }>(`${this.baseUrl}/lock`, { locked }, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  exportToExcel(filters?: TransactionFilters): Observable<Blob> {
    let params = new HttpParams().set('isActive', 'true');

    if (filters) {
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
      if (filters.affiliate) params = params.set('affiliate', filters.affiliate);
      if (filters.idNumber) params = params.set('idNumber', filters.idNumber);
      if (filters.reference) params = params.set('reference', filters.reference);
      if (filters.uploadedBy) params = params.set('uploadedBy', filters.uploadedBy);
      if (filters.status) params = params.set('status', filters.status);
    }

    return this._http
      .get(`${this.baseUrl}/export/excel`, {
        headers: this.getHeaders(),
        params,
        responseType: 'blob'
      })
      .pipe(catchError((error) => this.handleBlobError(error)));
  }

  // Con responseType 'blob', un error 400 con cuerpo JSON (ej. "no hay resultados
  // para ese rango") llega como Blob en error.error, no como objeto parseado —
  // hay que leerlo como texto y parsearlo antes de poder mostrar el mensaje real.
  private handleBlobError = (error: any): Observable<never> => {
    const blob: Blob | undefined = error?.error;
    if (blob instanceof Blob && blob.type?.includes('json')) {
      return from(blob.text()).pipe(
        switchMap((text: string) => {
          try {
            error.error = JSON.parse(text);
          } catch {
            // deja error.error como venía si no es JSON parseable
          }
          return this.handleError(error);
        }),
      );
    }
    return this.handleError(error);
  };

  private handleError(error: any): Observable<never> {
    // El backend ya devuelve mensajes descriptivos por escenario (documento duplicado,
    // creación bloqueada, validación de campos, etc.) — se leen primero siempre que
    // vengan, y solo se cae al mensaje genérico por status cuando no hay ninguno.
    const backendMessage = Array.isArray(error.error?.message)
      ? error.error.message.join(', ')
      : error.error?.message;

    let errorMessage = backendMessage || 'Ha ocurrido un error inesperado';

    if (!backendMessage) {
      if (error.status === 401) {
        errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      } else if (error.status === 403) {
        errorMessage = 'No tienes permiso para ver esta información.';
      } else if (error.status === 400) {
        errorMessage = 'Los datos enviados no son válidos.';
      } else if (error.status === 409) {
        errorMessage = 'Ya existe un registro en conflicto con los datos enviados.';
      } else if (error.status === 413) {
        errorMessage = 'Las imágenes son muy grandes (máximo 5MB cada una).';
      } else if (error.status === 404) {
        errorMessage = 'Transacción no encontrada.';
      } else if (error.status >= 500) {
        errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
      }
    }

    const wrapped = new Error(errorMessage) as Error & { status?: number };
    wrapped.status = error.status;
    return throwError(() => wrapped);
  }
}
