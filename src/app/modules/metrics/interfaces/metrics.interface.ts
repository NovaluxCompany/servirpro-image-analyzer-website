/** Filtro general de Métricas (y la copia local que usa cada detalle). */
export interface MetricsFilters {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  fidelizadorIds: number[]; // 0 = sin fidelizador
  advisorIds: number[]; // 0 = sin asesor (solo gráfico 1)
  originIds: number[]; // 0 = sin origen
  branchIds: number[]; // 0 = sin sede
  // La publicidad ya no va en el filtro: se guarda por mes (botón
  // "Publicidad por mes" del gráfico 1) y el backend la lee de la BD.
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
  /** Gráfico 1: Nuevos (por defecto), Mensualidades o Retiros. */
  condition?: MetricsCondition;
  /** Gráfico 9: mes a revisar (YYYY-MM). */
  collectionMonth?: string;
  /** Gráfico 9: usuarios que realizaron los pagos (0 = "Sin usuario"). */
  userIds?: number[];
}

export type MetricsCondition = 'NEW' | 'MONTHLY' | 'WITHDRAWAL';

export type MetricsFilterField = 'dates' | 'fidelizadores' | 'advisors' | 'origins' | 'branches' | 'affiliationCost' | 'workerCost';

export interface MetricsFilterOptions {
  fidelizadores: Array<{ id: number; name: string }>;
  advisors: Array<{ id: number; name: string }>;
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
    rows: Array<{ advisor: string; affiliates: number; sales: number; affiliationCost: number }>;
    otherAffiliates: number;
    subtotal: CostBreakdown;
  }>;
  byAdvisor: Array<{
    advisor: string;
    rows: Array<{ origin: string; affiliates: number; sales: number; affiliationCost: number }>;
    affiliates: number;
    sales: number;
    affiliationCost: number;
  }>;
  /** Afiliados de otros asesores o sin asesor: cuentan en los totales, sin fila propia. */
  otherAffiliates: number;
  totals: CostBreakdown;
  condition: MetricsCondition;
  /** "Datos afiliaciones del bot de publicidad": asesores por canal pagado y el total del bot. */
  byChannel: AdvertisingChannelTable[];
}

export interface AdvertisingChannelTable {
  channel: 'META' | 'WEB';
  label: string;
  /** Solo los asesores del bot (Hanna, Sebas, Tatiana). */
  rows: Array<{ advisor: string; affiliates: number; sales: number; affiliationCost: number }>;
  /** Recuento de todos los afiliados del canal. */
  total: CostBreakdown;
  /** Afiliados del canal de otros asesores (incluidos en el total). */
  otherAffiliates: number;
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
  months: string[];
  channels: Array<{
    channel: 'META' | 'WEB';
    label: string;
    affiliates: number;
    collected: number;
    invested: number;
    affiliationCost: number;
    costPerAffiliate: number;
  }>;
  totals: { affiliates: number; collected: number; invested: number; affiliationCost: number; costPerAffiliate: number };
}

/** Publicidad guardada de un mes (modal "Publicidad por mes"). */
export interface AdvertisingMonth {
  month: string; // YYYY-MM
  meta: number;
  web: number;
  updatedAt: string | null;
}

// ── Gráfico 5 ────────────────────────────────────────────────────────────
/** MONTHLY = Ordinarios, REENTRY = No ordinarios, RESOLUTION = Resolución (solo si hay), WITHDRAWAL = Retiros. */
export type ConditionKind = 'MONTHLY' | 'REENTRY' | 'RESOLUTION' | 'WITHDRAWAL';

export interface ConditionRow {
  condition: ConditionKind;
  label: string;
  users: number;
  sold: number | null;
  payroll: number | null;
  admin: number | null;
  retirementPayment: number;
  lateFee: number;
  collectionShare: number | null;
}

export interface ConditionsFidelizador {
  fidelizador: string;
  conditions: ConditionRow[];
  /** pending / pendingAmount: los que faltan por cobrar y el valor de su plan. */
  monthlyCollection: { expected: number; paid: number; rate: number | null; pending: number; pendingAmount: number };
  withdrawalRate: number;
}

export interface ConditionsResponse extends MetricsResponseBase {
  rows: ConditionsFidelizador[];
  totals: ConditionsFidelizador;
  companyWithdrawalRate: number;
}

// ── Gráfico 9: recaudo de mensualidades por usuario ──────────────────────────────────────────────
export interface CollectionPendingRow {
  affiliationId: number;
  fullName: string;
  documentNumber: string | null;
  phone: string | null;
  plan: string | null;
  amount: number;
}

export interface CollectionUserRow {
  /** Usuario que realizó los pagos (null = "Sin usuario"). */
  userId: number | null;
  userName: string;
  expected: number;
  paid: number;
  pending: number;
  rate: number | null;
  expectedAmount: number;
  collectedAmount: number;
  reachedGoal: boolean;
  pendingAffiliates: CollectionPendingRow[];
}

export interface FidelizadorCollectionResponse extends MetricsResponseBase {
  month: string;
  /** false = no se escogió ningún usuario: no se calculó nada. */
  filtered: boolean;
  goal: number;
  rows: CollectionUserRow[];
  totals: Omit<CollectionUserRow, 'pendingAffiliates' | 'userId'>;
  users: Array<{ id: number; name: string }>;
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
  /** Primer mes: los que entraron. Siguientes: los que siguen afiliados al cierre del mes. */
  affiliates: number;
  /** Estaban retirados al cierre del mes anterior y volvieron a afiliarse. */
  returned: number;
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
    total: Omit<CohortMonthRow, 'month' | 'affiliates' | 'returned'>;
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
