import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import {
  ActiveAffiliateRow,
  ActiveDeactivationResponse,
  AffiliateTransactionRow,
  DeactivateAffiliatesResponse,
  DeactivationContext,
  InactivationAffiliateRow,
} from '../interfaces/deactivate-affiliates.interface';

interface RawDeactivateAffiliateRow {
  id: number;
  fullName?: string;
  documentNumber?: string;
  reference?: string;
  planName?: string;
  createdAt?: string;
  entryDate?: string | null;
  advisorName?: string;
  companyName?: string;
  grouperName?: string;
  profession?: string;
}

interface RawActiveDeactivationResponse extends Omit<ActiveDeactivationResponse, 'data'> {
  data: RawDeactivateAffiliateRow[];
}

interface RawInactivationAffiliateRow {
  id?: number;
  affiliate_id?: number;
  affiliateId?: number;
  full_name?: string;
  fullName?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  document?: string;
  document_number?: string;
  reference?: string;
  plan?: string;
  plan_value?: number | string;
  planValue?: number | string;
  total_transactions?: number | string;
  totalTransactions?: number | string;
  entry_date?: string | null;
  entryDate?: string | null;
  advisor?: string;
  company?: string;
  grouper?: string;
  pension?: string;
  expected_amount?: number | string;
  expectedAmount?: number | string;
  paid_amount?: number | string;
  paidAmount?: number | string;
  amount_generated_ai?: number | string;
  amountGeneratedAI?: number | string;
  difference?: number | string;
  last_payment?: string | null;
  lastPayment?: string | null;
  amountsMatch?: boolean | string | number | null;
  amount_match?: boolean | string | number | null;
  amounts_match?: boolean | string | number | null;
}

interface RawAffiliateTransactionRow {
  _id?: string;
  id?: number;
  transaction_id?: number;
  transactionId?: number;
  reference?: string;
  created_at?: string;
  createdAt?: string;
  total_value?: number | string;
  totalValue?: number | string;
  amount_paid?: number | string;
  amountPaid?: number | string;
  amountGeneratedAI?: number | string;
  discounted_value?: number | string | null;
  discountedValue?: number | string | null;
  amounts_match?: boolean | string | number | null;
  amountsMatch?: boolean | string | number | null;
  amount_match?: boolean | string | number | null;
  status?: string;
  observation?: string | null;
  n8n_last_error?: string | null;
  n8nLastError?: string | null;
  created_by_user?: { name?: string; id?: number } | null;
  createdByUser?: { name?: string; id?: number } | null;
  createdBy?: { name?: string; id?: number } | null;
  advisor?: string | null;
  advisorName?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DeactivateAffiliatesService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/affiliates';
  private transactionsBaseUrl = environment.urlBD + '/transactions';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getContext(): Observable<DeactivationContext> {
    return this._http
      .get<DeactivationContext>(`${this.baseUrl}/deactivation/context`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError((error) => this.handleError(error, 'Error al obtener contexto de desactivación')));
  }

  getActiveAffiliates(page: number): Observable<ActiveDeactivationResponse> {
    const params = new HttpParams().set('page', page);

    return this._http
      .get<RawActiveDeactivationResponse>(`${this.baseUrl}/deactivation/active`, {
        headers: this.getHeaders(),
        params,
      })
      .pipe(
        map((response) => ({
          ...response,
          data: response.data.map((row) => this.normalizeRow(row)),
        })),
      )
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar afiliados activos')));
  }

  private normalizeRow(row: RawDeactivateAffiliateRow): ActiveAffiliateRow {
    return {
      id: row.id,
      fullName: row.fullName ?? '',
      idNumber: row.documentNumber ?? '',
      reference: row.reference ?? '',
      planName: row.planName ?? '',
      createdAt: row.createdAt ?? '',
      entryDate: row.entryDate ?? null,
      advisor: row.advisorName ?? '',
      company: row.companyName ?? '',
      grouper: row.grouperName ?? '',
      profession: row.profession ?? '',
    };
  }

  deactivateAffiliates(affiliateIds: number[]): Observable<DeactivateAffiliatesResponse> {
    return this._http
      .post<DeactivateAffiliatesResponse>(
        `${this.baseUrl}/deactivation`,
        { affiliateIds },
        { headers: this.getHeaders() },
      )
      .pipe(catchError((error) => this.handleError(error, 'Error al desactivar afiliados')));
  }

  getUnpaidAffiliates(): Observable<InactivationAffiliateRow[]> {
    return this._http
      .get<RawInactivationAffiliateRow[]>(`${this.baseUrl}/inactivation/unpaid`, {
        headers: this.getHeaders(),
      })
      .pipe(map((rows) => rows.map((row) => this.normalizeInactivationRow(row, false))))
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar afiliados sin pago')));
  }

  getUnderpaidAffiliates(): Observable<InactivationAffiliateRow[]> {
    return this._http
      .get<RawInactivationAffiliateRow[]>(`${this.baseUrl}/inactivation/underpaid`, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((rows) => {
          const normalizedRows = rows.map((row) => this.normalizeInactivationRow(row, true));
          const filteredRows = normalizedRows.filter((row) => this.isUnderpaid(row));

          // Fallback: if backend already filtered underpaid rows but flags are absent,
          // do not hide all results in UI.
          return filteredRows.length > 0 ? filteredRows : normalizedRows;
        }),
      )
      .pipe(catchError((error) => this.handleError(error, 'Error al cargar afiliados con pago incompleto')));
  }

  getAffiliateTransactions(documentId: string): Observable<AffiliateTransactionRow[]> {
    const rawDocument = (documentId ?? '').trim();
    const normalizedDocument = rawDocument.replace(/\D/g, '');

    if (!rawDocument) {
      return of<AffiliateTransactionRow[]>([]);
    }

    const loadByDocument = (queryKey: string, doc: string) =>
      this._http
        .get<unknown>(this.transactionsBaseUrl, {
          headers: this.getHeaders(),
          params: new HttpParams().set(queryKey, doc),
        })
        .pipe(
          map((payload): AffiliateTransactionRow[] => this.extractTransactionRows(payload).map((row) => this.normalizeTransactionRow(row))),
        );

    const attempts: Array<{ key: string; value: string }> = [
      { key: 'idNumber', value: rawDocument },
      { key: 'document', value: rawDocument },
      { key: 'document_number', value: rawDocument },
      { key: 'id_number', value: rawDocument },
    ];

    if (normalizedDocument && normalizedDocument !== rawDocument) {
      attempts.push(
        { key: 'idNumber', value: normalizedDocument },
        { key: 'document', value: normalizedDocument },
        { key: 'document_number', value: normalizedDocument },
        { key: 'id_number', value: normalizedDocument },
      );
    }

    const uniqueAttempts = attempts.filter(
      (attempt, index, all) => all.findIndex((item) => item.key === attempt.key && item.value === attempt.value) === index,
    );

    let chain = loadByDocument(uniqueAttempts[0].key, uniqueAttempts[0].value);

    for (let i = 1; i < uniqueAttempts.length; i++) {
      chain = chain.pipe(
        switchMap((rows) => {
          if (rows.length > 0) {
            return of(rows);
          }

          return loadByDocument(uniqueAttempts[i].key, uniqueAttempts[i].value);
        }),
      );
    }

    return chain.pipe(
      catchError((error) => this.handleError(error, 'Error al cargar el detalle de transacciones')),
    );
  }

  private normalizeInactivationRow(
    row: RawInactivationAffiliateRow,
    includePaymentFields: boolean,
  ): InactivationAffiliateRow {
    const expectedAmount = this.toNumber(row.expected_amount ?? row.expectedAmount);
    const paidAmount = this.toNumber(row.paid_amount ?? row.paidAmount);
    const amountGeneratedAI = this.toNumber(row.amount_generated_ai ?? row.amountGeneratedAI);
    const planValue = this.toNumber(row.plan_value ?? row.planValue);
    const totalTransactions = this.toNumber(row.total_transactions ?? row.totalTransactions);
    const difference = this.toNumber(row.difference ?? expectedAmount - paidAmount);
    const fullName =
      row.full_name ??
      row.fullName ??
      [row.first_name ?? row.firstName, row.last_name ?? row.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

    return {
      affiliateId: Number(row.affiliate_id ?? row.affiliateId ?? row.id ?? 0),
      name: fullName,
      document: row.document_number ?? row.document ?? '',
      reference: row.reference ?? '',
      plan: row.plan ?? '',
      planValue: includePaymentFields ? planValue : undefined,
      totalTransactions: includePaymentFields ? totalTransactions : undefined,
      entryDate: row.entry_date ?? row.entryDate ?? null,
      advisor: row.advisor ?? '',
      company: row.company ?? '',
      grouper: row.grouper ?? '',
      expectedAmount: expectedAmount || undefined,
      paidAmount: includePaymentFields ? paidAmount : undefined,
      amountGeneratedAI: includePaymentFields ? amountGeneratedAI : undefined,
      difference: includePaymentFields ? difference : undefined,
      lastPayment: row.last_payment ?? row.lastPayment ?? null,
      amountsMatch: this.toBoolean(row.amountsMatch ?? row.amount_match ?? row.amounts_match),
      pension: row.pension ?? undefined,
    };
  }

  private toNumber(value: number | string | undefined | null): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toBoolean(value: boolean | string | number | null | undefined): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
      return undefined;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }

    return undefined;
  }

  private isUnderpaid(row: InactivationAffiliateRow): boolean {
    const matchFromAmounts = row.amountsMatch;
    if (matchFromAmounts !== undefined) {
      return matchFromAmounts === false;
    }

    return (row.difference ?? 0) > 0;
  }

  private normalizeTransactionRow(row: RawAffiliateTransactionRow): AffiliateTransactionRow {
    const rawMatch = row.amounts_match ?? row.amountsMatch ?? row.amount_match;
    const amountsMatch = this.toBoolean(rawMatch);
    const transactionId = String(
      row.transaction_id ??
        row.transactionId ??
        row.id ??
        row._id ??
        `${row.reference ?? 'tx'}-${row.created_at ?? row.createdAt ?? ''}`,
    );

    // Extraer nombre del asesor del objeto createdBy
    let advisorName: string | null = null;
    const createdByUser = row.created_by_user ?? row.createdByUser ?? row.createdBy;
    if (createdByUser && typeof createdByUser === 'object' && createdByUser.name) {
      advisorName = createdByUser.name;
    } else if (row.advisor || row.advisorName) {
      advisorName = (row.advisor ?? row.advisorName) as string;
    }

    return {
      transactionId,
      reference: row.reference ?? '',
      createdAt: row.created_at ?? row.createdAt ?? '',
      totalValue: this.toNumber(row.total_value ?? row.totalValue),
      amountPaid: this.toNumber(row.amount_paid ?? row.amountPaid ?? row.amountGeneratedAI),
      discountedValue:
        row.discounted_value != null
          ? this.toNumber(row.discounted_value)
          : row.discountedValue != null
            ? this.toNumber(row.discountedValue)
            : null,
      amountsMatch: amountsMatch !== undefined ? amountsMatch : null,
      status: row.status ?? '',
      observation: row.observation ?? null,
      errorReason: row.n8n_last_error ?? row.n8nLastError ?? null,
      advisorName: advisorName,
    };
  }

  private extractTransactionRows(payload: unknown): RawAffiliateTransactionRow[] {
    if (Array.isArray(payload)) {
      return payload as RawAffiliateTransactionRow[];
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const source = payload as Record<string, unknown>;
    const directCollections = [
      source['data'],
      source['transactions'],
      source['results'],
      source['items'],
      source['rows'],
    ];

    for (const collection of directCollections) {
      if (Array.isArray(collection)) {
        return collection as RawAffiliateTransactionRow[];
      }
    }

    const nestedData = source['data'];
    if (nestedData && typeof nestedData === 'object') {
      const nested = nestedData as Record<string, unknown>;
      const nestedCollections = [nested['transactions'], nested['results'], nested['items'], nested['rows']];

      for (const collection of nestedCollections) {
        if (Array.isArray(collection)) {
          return collection as RawAffiliateTransactionRow[];
        }
      }
    }

    return [];
  }

  private handleError(error: any, fallbackMessage: string): Observable<never> {
    const backendMessage = error?.error?.message;
    if (Array.isArray(backendMessage)) {
      return throwError(() => new Error(backendMessage.join(' ')));
    }

    return throwError(() => new Error(backendMessage || fallbackMessage));
  }
}
