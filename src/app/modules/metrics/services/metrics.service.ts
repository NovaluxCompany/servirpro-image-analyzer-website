import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { MetricChartKey } from '../metric-charts.config';
import {
  AdvertisingMonth,
  AdvertisingResponse,
  CohortsResponse,
  ConditionsResponse,
  DeactivationsResponse,
  FidelizadorCollectionResponse,
  FidelizadorSummaryResponse,
  LifelineResponse,
  MetricsFilterOptions,
  MetricsFilters,
  MetricsSpecificFilters,
  NewAffiliationsResponse,
  NewVsReentryResponse,
  OfficeProfitsResponse,
  RetentionResponse,
  TopPlansResponse,
  TopProfessionsResponse,
} from '../interfaces/metrics.interface';

/** Endpoint del backend para cada gráfico (clave de URL -> ruta de API). */
const CHART_ENDPOINTS: Record<MetricChartKey, string> = {
  'afiliaciones-nuevas': 'new-affiliations',
  'resumen-fidelizadores': 'fidelizador-summary',
  'nuevos-vs-reingresos': 'new-vs-reentry',
  publicidad: 'advertising',
  'ganancias-oficinas': 'office-profits',
  'mensualidad-reingreso-retiro': 'conditions',
  retencion: 'retention',
  cohortes: 'cohorts',
  'linea-de-vida': 'lifeline',
  planes: 'top-plans',
  profesiones: 'top-professions',
  'recaudo-fidelizadores': 'fidelizador-collection',
  desactivaciones: 'deactivations',
};

export interface MetricChartResponses {
  'afiliaciones-nuevas': NewAffiliationsResponse;
  'resumen-fidelizadores': FidelizadorSummaryResponse;
  'nuevos-vs-reingresos': NewVsReentryResponse;
  publicidad: AdvertisingResponse;
  'ganancias-oficinas': OfficeProfitsResponse;
  'mensualidad-reingreso-retiro': ConditionsResponse;
  retencion: RetentionResponse;
  cohortes: CohortsResponse;
  'linea-de-vida': LifelineResponse;
  planes: TopPlansResponse;
  profesiones: TopProfessionsResponse;
  'recaudo-fidelizadores': FidelizadorCollectionResponse;
  desactivaciones: DeactivationsResponse;
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
        params: this.toParams(filters, specific, key),
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

  // ── Publicidad por mes (botón del gráfico 1) ──────────────────────────
  getAdvertisingMonths(year: number): Observable<AdvertisingMonth[]> {
    return this._http
      .get<AdvertisingMonth[]>(`${this.baseUrl}/advertising-spend`, { headers: this.getHeaders(), params: { year } })
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar la publicidad registrada')));
  }

  saveAdvertisingMonth(month: string, meta: number, web: number): Observable<AdvertisingMonth> {
    return this._http
      .put<AdvertisingMonth>(`${this.baseUrl}/advertising-spend`, { month, meta, web }, { headers: this.getHeaders() })
      .pipe(catchError((error) => this.handleError(error, 'Error al guardar la publicidad del mes')));
  }

  private toParams(filters: MetricsFilters, specific: MetricsSpecificFilters, key?: MetricChartKey): HttpParams {
    // Fechas vacías solo pasan en la línea de vida (= toda la historia): no se envían.
    // La publicidad no se envía: el backend la lee de lo guardado por mes.
    let params = new HttpParams()
      .set('affiliationCost', filters.affiliationCost || 0)
      .set('workerCost', filters.workerCost || 0);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);

    if (filters.fidelizadorIds.length) params = params.set('fidelizadorIds', filters.fidelizadorIds.join(','));
    if (filters.advisorIds?.length) params = params.set('advisorIds', filters.advisorIds.join(','));
    if (filters.originIds.length) params = params.set('originIds', filters.originIds.join(','));
    if (filters.branchIds.length) params = params.set('branchIds', filters.branchIds.join(','));
    if (filters.affiliateType) params = params.set('affiliateType', filters.affiliateType);

    if (specific.cohortFrom) params = params.set('cohortFrom', specific.cohortFrom);
    if (specific.cohortTo) params = params.set('cohortTo', specific.cohortTo);
    if (specific.includeNew != null) params = params.set('includeNew', String(specific.includeNew));
    if (specific.includeReentries != null) params = params.set('includeReentries', String(specific.includeReentries));
    if (specific.document?.trim()) params = params.set('document', specific.document.trim());
    if (specific.condition && specific.condition !== 'NEW') params = params.set('condition', specific.condition);
    if (specific.collectionMonth) params = params.set('month', specific.collectionMonth);
    if (specific.userIds?.length) params = params.set('userIds', specific.userIds.join(','));

    // Gráfico 10: viene del filtro general, pero solo lo usa ese gráfico.
    const inactivations = filters.inactivations;
    if (key === 'desactivaciones' && inactivations?.view) {
      params = params.set('view', inactivations.view);
      if (inactivations.reasonIds.length) params = params.set('reasonIds', inactivations.reasonIds.join(','));
      if (inactivations.userIds.length) params = params.set('userIds', inactivations.userIds.join(','));
      if (inactivations.view === 'DISAFFILIATIONS') {
        if (inactivations.statuses.length) params = params.set('statuses', inactivations.statuses.join(','));
        if (inactivations.subReasonIds.length) params = params.set('subReasonIds', inactivations.subReasonIds.join(','));
        if (inactivations.companyIds.length) params = params.set('companyIds', inactivations.companyIds.join(','));
      }
    }

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
