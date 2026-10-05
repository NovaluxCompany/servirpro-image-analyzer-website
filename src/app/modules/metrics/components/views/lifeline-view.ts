import { DatePipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { LifelineEventKind, LifelineResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe, MonthLabelPipe, formatMonth } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

type EventGroup = 'all' | 'affiliation' | 'changes' | 'disaffiliation' | 'incapacities';

const KIND_GROUP: Record<LifelineEventKind, Exclude<EventGroup, 'all'>> = {
  CREATION: 'affiliation',
  REENTRY: 'affiliation',
  DEACTIVATION: 'affiliation',
  CHANGE: 'changes',
  DISAFFILIATION_REQUEST: 'disaffiliation',
  DISAFFILIATION_CONFIRMED: 'disaffiliation',
  DISAFFILIATION_REJECTED: 'disaffiliation',
  INCAPACITY: 'incapacities',
  INCAPACITY_EXTENSION: 'incapacities',
};

/** Color del punto de la línea de tiempo + ícono (el tipo nunca va solo por color). */
const KIND_STYLE: Record<LifelineEventKind, { dot: string; icon: string }> = {
  CREATION: { dot: 'bg-blue-600', icon: '+' },
  REENTRY: { dot: 'bg-green-600', icon: '↻' },
  CHANGE: { dot: 'bg-gray-500', icon: '✎' },
  DEACTIVATION: { dot: 'bg-red-600', icon: '■' },
  DISAFFILIATION_REQUEST: { dot: 'bg-orange-500', icon: '?' },
  DISAFFILIATION_CONFIRMED: { dot: 'bg-orange-700', icon: '✕' },
  DISAFFILIATION_REJECTED: { dot: 'bg-gray-400', icon: '↺' },
  INCAPACITY: { dot: 'bg-purple-600', icon: '✚' },
  INCAPACITY_EXTENSION: { dot: 'bg-purple-400', icon: '»' },
};

export const EVENT_GROUPS: Array<{ key: EventGroup; label: string }> = [
  { key: 'all', label: 'Todo' },
  { key: 'affiliation', label: 'Afiliación y reingresos' },
  { key: 'changes', label: 'Cambios' },
  { key: 'disaffiliation', label: 'Desafiliación' },
  { key: 'incapacities', label: 'Incapacidades' },
];

/**
 * Gráfico 8: línea de vida de UN afiliado. Sin documento solo muestra la
 * advertencia (no hay vista general). Resumen arriba (antigüedad, pagos,
 * cumplimiento, reingresos, incapacidades, riesgo de retiro), los tramos,
 * los meses pagados y la línea de tiempo con todos los eventos.
 */
@Component({
  selector: 'app-lifeline-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe, MonthLabelPipe, DatePipe],
  templateUrl: './lifeline-view.html',
})
export class LifelineViewComponent {
  data = input.required<LifelineResponse>();
  detailed = input(false);

  readonly groups = EVENT_GROUPS;
  group = signal<EventGroup>('all');
  /** Por defecto del más viejo al más nuevo; el botón lo invierte. */
  newestFirst = signal(false);

  visibleEvents = computed(() => {
    const group = this.group();
    const events = this.data().events;
    // El backend ya los envía del más viejo al más nuevo.
    const filtered = group === 'all' ? [...events] : events.filter((e) => KIND_GROUP[e.kind] === group);
    return this.newestFirst() ? filtered.reverse() : filtered;
  });

  toggleOrder(): void {
    this.newestFirst.update((v) => !v);
  }

  groupCount(group: EventGroup): number {
    const events = this.data().events;
    return group === 'all' ? events.length : events.filter((e) => KIND_GROUP[e.kind] === group).length;
  }

  hasPayments = computed(() => this.data().months.some((m) => m.amount > 0));

  kindStyle(kind: LifelineEventKind) {
    return KIND_STYLE[kind];
  }

  /** 400 días -> '1 año 1 mes'. */
  duration(days: number | null): string {
    if (days == null) return '—';
    if (days < 31) return `${days} día${days === 1 ? '' : 's'}`;
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const parts = [
      years > 0 ? `${years} año${years === 1 ? '' : 's'}` : '',
      months > 0 ? `${months} mes${months === 1 ? '' : 'es'}` : '',
    ].filter(Boolean);
    return parts.join(' ') || `${days} días`;
  }

  /** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
  shortDate(date: string | null): string {
    if (!date) return '—';
    const [y, m, d] = date.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  monthState(month: { amount: number; owed: boolean }): 'paid' | 'unpaid' | 'none' {
    if (month.amount > 0) return 'paid';
    return month.owed ? 'unpaid' : 'none';
  }

  // Una sola serie (valor pagado por mes): un color, sin leyenda.
  paymentsConfig = computed<ChartConfiguration>(() => {
    const months = this.data().months;
    return {
      type: 'bar',
      data: {
        labels: months.map((m) => formatMonth(m.month)),
        datasets: [{ label: 'Pagado', data: months.map((m) => m.amount), backgroundColor: seriesColor(0), ...BAR_STYLE }],
      },
      options: baseOptions('money', { legend: false, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
