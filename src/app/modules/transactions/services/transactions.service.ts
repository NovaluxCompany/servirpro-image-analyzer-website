import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
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
    let params = new HttpParams();

    if (filters) {
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
      if (filters.affiliate) params = params.set('affiliate', filters.affiliate);
      if (filters.idNumber) params = params.set('idNumber', filters.idNumber);
      if (filters.reference) params = params.set('reference', filters.reference);
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
      .set('limit', limit.toString());

    if (filters) {
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
      if (filters.affiliate) params = params.set('affiliate', filters.affiliate);
      if (filters.idNumber) params = params.set('idNumber', filters.idNumber);
      if (filters.reference) params = params.set('reference', filters.reference);
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

  exportToExcel(filters?: TransactionFilters): Observable<Blob> {
    let params = new HttpParams();

    if (filters) {
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
      if (filters.affiliate) params = params.set('affiliate', filters.affiliate);
      if (filters.idNumber) params = params.set('idNumber', filters.idNumber);
      if (filters.reference) params = params.set('reference', filters.reference);
    }

    return this._http
      .get(`${this.baseUrl}/export/excel`, {
        headers: this.getHeaders(),
        params,
        responseType: 'blob'
      })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Ha ocurrido un error inesperado';

    if (error.status === 401) {
      errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
    } else if (error.status === 400) {
      if (error.error?.message) {
        if (Array.isArray(error.error.message)) {
          errorMessage = error.error.message.join(', ');
        } else {
          errorMessage = error.error.message;
        }
      } else {
        errorMessage = 'Los datos enviados no son válidos';
      }
    } else if (error.status === 413) {
      errorMessage = 'Las imágenes son muy grandes (máximo 5MB cada una)';
    } else if (error.status === 404) {
      errorMessage = 'Transacción no encontrada';
    } else if (error.status >= 500) {
      errorMessage = 'Error del servidor. Por favor, intenta más tarde.';
    }

    return throwError(() => new Error(errorMessage));
  }
}
