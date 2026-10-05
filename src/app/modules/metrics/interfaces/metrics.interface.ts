/** Filtro general de Métricas (y la copia local que usa cada detalle). */
export interface MetricsFilters {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  fidelizadorIds: number[]; // 0 = sin fidelizador
  originIds: number[]; // 0 = sin origen
  branchIds: number[]; // 0 = sin sede
  adMeta: number;
  adWeb: number;
  affiliationCost: number;
  workerCost: number;
}

/** Filtros propios de un gráfico (solo los usa su vista de detalle). */
export interface MetricsSpecificFilters {
  cohortFrom?: string; // YYYY-MM
  cohortTo?: string; // YYYY-MM
  includeNew?: boolean;
  includeReentries?: boolean;
  document?: string;
}

export type MetricsFilterField = 'dates' | 'fidelizadores' | 'origins' | 'branches' | 'advertising' | 'affiliationCost' | 'workerCost';

export interface MetricsFilterOptions {
  fidelizadores: Array<{ id: number; name: string }>;
  origins: Array<{ id: number; code: string; name: string }>;
  branches: Array<{ id: number; name: string }>;
  defaults: { affiliationCost: number; workerCost: number };
  minCohortMonth: string;
}

interface MetricsResponseBase {
  missingData: string[];
}

export interface CostBreakdown {
  affiliates: number;
  sales: number;
  affiliationCost: number;
  advertising: number;
  netProfit: number;
  costPerClient: number;
}

export interface NewAffiliationsResponse extends MetricsResponseBase {
  byOrigin: Array<{
    originId: number | null;
    originCode: string | null;
    origin: string;
    rows: Array<{ fidelizador: string; affiliates: number; sales: number; affiliationCost: number }>;
    subtotal: CostBreakdown;
  }>;
  byFidelizador: Array<{
    fidelizador: string;
    rows: Array<{ origin: string; affiliates: number; sales: number; affiliationCost: number }>;
    affiliates: number;
    sales: number;
    affiliationCost: number;
  }>;
  totals: CostBreakdown;
}

export interface FidelizadorSummaryRow {
  fidelizador: string;
  affiliates: number;
  sales: number;
  affiliationCost: number;
  advertising: number;
  costPerClient: number;
  workerCost: number;
  netProfit: number;
}

export interface FidelizadorSummaryResponse extends MetricsResponseBase {
  rows: FidelizadorSummaryRow[];
  offices: FidelizadorSummaryRow | null;
  totals: FidelizadorSummaryRow;
  computedCostPerClient: number;
}

export interface NewVsReentryResponse extends MetricsResponseBase {
  newOnes: { affiliates: number; sales: number };
  reentries: { affiliates: number; sales: number };
  total: { affiliates: number; sales: number };
}

export interface AdvertisingResponse extends MetricsResponseBase {
  advertising: { meta: number; web: number; total: number };
}

export interface OfficeProfitsResponse extends MetricsResponseBase {
  available: boolean;
  rows: Array<{ branch: string; affiliates: number; profit: number }>;
  total: { affiliates: number; profit: number };
}

export type RetentionLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface RetentionRow {
  fidelizador: string;
  monthly: number;
  newOnes: number;
  totalUsers: number;
  payments: number;
  withdrawals: number;
  withdrawalRate: number;
  level: RetentionLevel;
}

export interface RetentionResponse extends MetricsResponseBase {
  rows: RetentionRow[];
  totals: RetentionRow;
  withdrawalsWithoutDate: number;
}

export interface CohortMonthRow {
  month: string;
  affiliates: number;
  monthly: number;
  payroll: number;
  retirementPayment: number;
  lateFee: number;
  netCollection: number;
}

export interface CohortsResponse extends MetricsResponseBase {
  cohortFrom: string;
  cohortTo: string;
  minCohortMonth: string;
  months: string[];
  cohorts: Array<{
    cohortMonth: string;
    rows: CohortMonthRow[];
    total: Omit<CohortMonthRow, 'month' | 'affiliates'>;
  }>;
}

export type LifelineEventKind =
  | 'CREATION'
  | 'REENTRY'
  | 'CHANGE'
  | 'DEACTIVATION'
  | 'DISAFFILIATION_REQUEST'
  | 'DISAFFILIATION_CONFIRMED'
  | 'DISAFFILIATION_REJECTED'
  | 'INCAPACITY'
  | 'INCAPACITY_EXTENSION';

export interface LifelineEvent {
  date: string; // ISO
  kind: LifelineEventKind;
  title: string;
  user: string | null;
  details: Array<{ label: string; value: string }>;
  changes: Array<{ field: string; label: string; oldValue: string | null; newValue: string | null }>;
  history: Array<{ date: string; label: string; user: string | null; observation: string | null }>;
  badges: string[];
}

export interface LifelineSegment {
  start: string;
  end: string | null;
  startKind: 'CREATION' | 'REENTRY';
  endReason: string | null;
  days: number;
}

export interface LifelineMonthRow {
  month: string;
  amount: number;
  payments: number;
  owed: boolean;
}

export interface LifelineSummary {
  isActive: boolean;
  totalDays: number;
  currentDays: number | null;
  totalPaid: number;
  currentMonthlyValue: number | null;
  currentDiscount: number | null;
  monthsOwed: number;
  monthsPaid: number;
  compliance: number | null;
  monthsInArrears: number;
  currentUnpaidStreak: number;
  lastPaymentMonth: string | null;
  reentries: number;
  incapacities: number;
  incapacityDays: number;
  withdrawalRisk: boolean;
}

export interface LifelineResponse extends MetricsResponseBase {
  requiresDocument: boolean;
  affiliate: { fullName: string; documentNumber: string; documentType: string | null } | null;
  summary: LifelineSummary | null;
  segments: LifelineSegment[];
  events: LifelineEvent[];
  months: LifelineMonthRow[];
  range: { from: string | null; to: string | null };
}

export interface TopPlansResponse extends MetricsResponseBase {
  plans: Array<{ plan: string; salesCount: number; sales: number; affiliates: number }>;
  totalSalesCount: number;
}

export interface TopProfessionsResponse extends MetricsResponseBase {
  professions: Array<{ profession: string; affiliates: number }>;
}
