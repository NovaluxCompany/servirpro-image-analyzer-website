export interface PlanAdmin {
  id: number;
  name: string;
  salePrice: number;
  firstMonthPrice: number | null;
}

export interface CreatePlanPayload {
  name: string;
  salePrice: number;
  firstMonthPrice?: number | null;
}

export interface UpdatePlanPayload {
  name?: string;
  salePrice?: number;
  firstMonthPrice?: number | null;
}
