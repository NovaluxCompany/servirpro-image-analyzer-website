import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { MetricChartKey } from '../metric-charts.config';
import {
  AdvertisingResponse,
  CohortsResponse,
  FidelizadorSummaryResponse,
  LifelineResponse,
  MetricsFilterOptions,
  MetricsFilters,
  MetricsSpecificFilters,
  NewAffiliationsResponse,
  NewVsReentryResponse,
  RetentionResponse,
} from '../interfaces/metrics.interface';

/** Endpoint del backend para cada gráfico (clave de URL -> ruta de API). */
const CHART_ENDPOINTS: Record<MetricChartKey, string> = {
  'afiliaciones-nuevas': 'new-affiliations',
  'resumen-fidelizadores': 'fidelizador-summary',
  'nuevos-vs-reingresos': 'new-vs-reentry',
  publicidad: 'advertising',
  retencion: 'retention',
  cohortes: 'cohorts',
  'linea-de-vida': 'lifeline',
};

export interface MetricChartResponses {
  'afiliaciones-nuevas': NewAffiliationsResponse;
  'resumen-fidelizadores': FidelizadorSummaryResponse;
  'nuevos-vs-reingresos': NewVsReentryResponse;
  publicidad: AdvertisingResponse;
  retencion: RetentionResponse;
  cohortes: CohortsResponse;
  'linea-de-vida': LifelineResponse;
}

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/metrics';

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this._tokenService.getToken()}` });
  }

  getFilterOptions(): Observable<MetricsFilterOptions> {
    return this._http
      .get<MetricsFilterOptions>(`${this.baseUrl}/filter-options`, { headers: this.getHeaders() })
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar los filtros de métricas')));
  }

  getChart<K extends MetricChartKey>(
    key: K,
    filters: MetricsFilters,
    specific: MetricsSpecificFilters = {},
  ): Observable<MetricChartResponses[K]> {
    return this._http
      .get<MetricChartResponses[K]>(`${this.baseUrl}/${CHART_ENDPOINTS[key]}`, {
        headers: this.getHeaders(),
        params: this.toParams(filters, specific),
      })
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar el gráfico')));
  }

  exportNewAffiliations(filters: MetricsFilters): Observable<Blob> {
    return this._http
      .get(`${this.baseUrl}/new-affiliations/export/excel`, {
        headers: this.getHeaders(),
        params: this.toParams(filters, {}),
        responseType: 'blob',
      })
      .pipe(catchError((error) => this.handleError(error, 'Error al exportar Excel')));
  }

  private toParams(filters: MetricsFilters, specific: MetricsSpecificFilters): HttpParams {
    let params = new HttpParams()
      .set('from', filters.from)
      .set('to', filters.to)
      .set('adMeta', filters.adMeta || 0)
      .set('adWeb', filters.adWeb || 0)
      .set('affiliationCost', filters.affiliationCost || 0)
      .set('workerCost', filters.workerCost || 0);

    if (filters.fidelizadorIds.length) params = params.set('fidelizadorIds', filters.fidelizadorIds.join(','));
    if (filters.originIds.length) params = params.set('originIds', filters.originIds.join(','));
    if (filters.branchIds.length) params = params.set('branchIds', filters.branchIds.join(','));

    if (specific.cohortFrom) params = params.set('cohortFrom', specific.cohortFrom);
    if (specific.cohortTo) params = params.set('cohortTo', specific.cohortTo);
    if (specific.includeNew != null) params = params.set('includeNew', String(specific.includeNew));
    if (specific.includeReentries != null) params = params.set('includeReentries', String(specific.includeReentries));
    if (specific.document?.trim()) params = params.set('document', specific.document.trim());

    return params;
  }

  private handleError(error: any, fallbackMessage: string): Observable<never> {
    const backendMessage = error?.error?.message;
    const message = Array.isArray(backendMessage) ? backendMessage.join(' ') : backendMessage || fallbackMessage;
    const wrapped = new Error(message) as Error & { status?: number };
    wrapped.status = error?.status;
    return throwError(() => wrapped);
  }
}
