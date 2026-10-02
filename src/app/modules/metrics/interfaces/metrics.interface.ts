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
    rows: Array<{ origin: string; affiliates: number; sales: number }>;
    affiliates: number;
    sales: number;
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
  offices: {
    available: boolean;
    rows: Array<{ branch: string; affiliates: number; profit: number }>;
    total: { affiliates: number; profit: number };
  };
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

export interface LifelineMonthRow {
  month: string;
  createdAmount: number;
  reentryAmount: number;
  monthlyAmount: number;
  createdCount: number;
  reentryCount: number;
  monthlyCount: number;
}

export interface LifelineResponse extends MetricsResponseBase {
  affiliate: { fullName: string; documentNumber: string } | null;
  months: LifelineMonthRow[];
  topPlans: Array<{ plan: string; sales: number; affiliates: number }>;
  topProfessions: Array<{ profession: string; affiliates: number }>;
}
