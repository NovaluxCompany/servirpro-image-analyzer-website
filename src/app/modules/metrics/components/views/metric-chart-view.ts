import { Component, input } from '@angular/core';
import { MetricChartKey } from '../../metric-charts.config';
import { NewAffiliationsViewComponent } from './new-affiliations-view';
import { FidelizadorSummaryViewComponent } from './fidelizador-summary-view';
import { NewVsReentryViewComponent } from './new-vs-reentry-view';
import { AdvertisingViewComponent } from './advertising-view';
import { RetentionViewComponent } from './retention-view';
import { CohortsViewComponent } from './cohorts-view';
import { LifelineViewComponent } from './lifeline-view';
import { OfficeProfitsViewComponent } from './office-profits-view';
import { TopPlansViewComponent } from './top-plans-view';
import { TopProfessionsViewComponent } from './top-professions-view';

/** Pinta la vista que corresponde a cada gráfico (misma en tablero y detalle). */
@Component({
  selector: 'app-metric-chart-view',
  standalone: true,
  imports: [
    NewAffiliationsViewComponent,
    FidelizadorSummaryViewComponent,
    NewVsReentryViewComponent,
    AdvertisingViewComponent,
    RetentionViewComponent,
    CohortsViewComponent,
    LifelineViewComponent,
    OfficeProfitsViewComponent,
    TopPlansViewComponent,
    TopProfessionsViewComponent,
  ],
  template: `
    @switch (chartKey()) {
      @case ('afiliaciones-nuevas') {
        <app-new-affiliations-view [data]="data()" [detailed]="detailed()" [originCatalogIds]="originCatalogIds()" />
      }
      @case ('resumen-fidelizadores') {
        <app-fidelizador-summary-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('nuevos-vs-reingresos') {
        <app-new-vs-reentry-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('publicidad') {
        <app-advertising-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('ganancias-oficinas') {
        <app-office-profits-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('retencion') {
        <app-retention-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('cohortes') {
        <app-cohorts-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('linea-de-vida') {
        <app-lifeline-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('planes') {
        <app-top-plans-view [data]="data()" [detailed]="detailed()" />
      }
      @case ('profesiones') {
        <app-top-professions-view [data]="data()" [detailed]="detailed()" />
      }
    }
  `,
})
export class MetricChartViewComponent {
  chartKey = input.required<MetricChartKey>();
  // La respuesta concreta depende de chartKey (ver MetricChartResponses).
  data = input.required<any>();
  detailed = input(false);
  originCatalogIds = input<number[]>([]);
}
