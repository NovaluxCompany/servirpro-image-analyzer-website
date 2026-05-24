export interface CatalogItem {
  id: string;
  name: string;
}

export interface Plan extends CatalogItem {
  price?: number;
  description?: string;
}

export interface Company extends CatalogItem {}
export interface Grouper extends CatalogItem {}
export interface Advisor extends CatalogItem {}
export interface EpsItem extends CatalogItem {}
export interface Pension extends CatalogItem {}
export interface CompensationBox extends CatalogItem {}

export interface AffiliateCatalogs {
  plans: Plan[];
  companies: Company[];
  groupers: Grouper[];
  advisors: Advisor[];
  epsList: EpsItem[];
  pensions: Pension[];
  compensationBoxes: CompensationBox[];
}
