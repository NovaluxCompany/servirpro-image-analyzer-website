import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import {
  ValidationResponse,
  ExecutionResponse,
  HistoryResponse,
} from '../interfaces/update-company.interface';

@Injectable({
  providedIn: 'root',
})
export class UpdateCompanyService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/empresa';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  validateFile(file: File): Observable<ValidationResponse> {
    const formData = new FormData();
    formData.append('archivo', file);

    return this._http.post<ValidationResponse>(`${this.baseUrl}/validar`, formData, {
      headers: this.getHeaders(),
    });
  }

  executeUpload(file: File): Observable<ExecutionResponse> {
    const formData = new FormData();
    formData.append('archivo', file);

    return this._http.post<ExecutionResponse>(`${this.baseUrl}/ejecutar`, formData, {
      headers: this.getHeaders(),
    });
  }

  getHistory(page: number, limit: number): Observable<HistoryResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    return this._http.get<HistoryResponse>(`${this.baseUrl}/historial`, {
      headers: this.getHeaders(),
      params,
    });
  }

  downloadTemplate(): Observable<Blob> {
    return this._http.get(`${this.baseUrl}/plantilla`, {
      headers: this.getHeaders(),
      responseType: 'blob',
    });
  }

  downloadSummaryExcel(details: any[]): Observable<Blob> {
    return this._http.post(`${this.baseUrl}/resumen/excel`, { detalle: details }, {
      headers: this.getHeaders(),
      responseType: 'blob',
    });
  }
}
