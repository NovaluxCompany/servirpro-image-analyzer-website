import { ChartOptions } from 'chart.js';
import { formatMoney, formatNumber } from './metrics-format';

/**
 * Paleta categórica validada para daltonismo (orden fijo: el orden ES el
 * mecanismo de seguridad, no se reordena ni se generan colores extra). Un
 * 9º grupo no recibe color nuevo: se agrupa en "Otros".
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

/** Para "Sin origen", "Sin fidelizador", "Otros": gris neutro, nunca un color de serie. */
export const NEUTRAL_COLOR = '#b4b2a9';

/** Colores de estado (semáforo): solo significan bueno/alerta/crítico, siempre con ícono + etiqueta. */
export const STATUS_COLORS = { GREEN: '#0ca30c', YELLOW: '#fab219', RED: '#d03b3b' } as const;

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff',
};

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/**
 * Color estable por origen: sigue al origen (su posición en el catálogo),
 * no a su posición en el resultado, para que filtrar no repinte el resto.
 */
export function originColor(originId: number | null, catalogIds: number[]): string {
  if (originId == null) return NEUTRAL_COLOR;
  const index = catalogIds.indexOf(originId);
  return index >= 0 && index < SERIES_COLORS.length ? SERIES_COLORS[index] : NEUTRAL_COLOR;
}

type ValueKind = 'money' | 'number' | 'percent';

function formatValue(value: number, kind: ValueKind): string {
  if (kind === 'money') return formatMoney(value);
  if (kind === 'percent') return `${formatNumber(value)} %`;
  return formatNumber(value);
}

/** Opciones base: rejilla y ejes recesivos, tooltip con formato, leyenda solo con >= 2 series. */
export function baseOptions(
  kind: ValueKind,
  opts: { horizontal?: boolean; stacked?: boolean; legend?: boolean; compact?: boolean } = {},
): ChartOptions<'bar' | 'line'> {
  const valueAxis = {
    beginAtZero: true,
    stacked: opts.stacked,
    grid: { color: INK.grid },
    border: { color: INK.axis },
    ticks: {
      color: INK.muted,
      maxTicksLimit: opts.compact ? 5 : 8,
      callback: (v: string | number) => (kind === 'money' ? compactMoney(Number(v)) : formatValue(Number(v), kind)),
    },
  };
  const categoryAxis = {
    stacked: opts.stacked,
    grid: { display: false },
    border: { color: INK.axis },
    ticks: { color: INK.secondary, autoSkip: true, maxRotation: 0 },
  };

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: opts.horizontal ? 'y' : 'x',
    // En barras horizontales la categoría va en Y: sin axis 'y', Chart.js busca
    // la barra más cercana por X y el tooltip muestra otra fila, no la del cursor.
    interaction: { mode: 'index', intersect: false, axis: opts.horizontal ? 'y' : 'x' },
    animation: { duration: 250 },
    scales: opts.horizontal ? { x: valueAxis, y: categoryAxis } : { x: categoryAxis, y: valueAxis },
    plugins: {
      legend: {
        display: opts.legend ?? true,
        position: 'bottom',
        labels: { color: INK.secondary, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const raw = opts.horizontal ? ctx.parsed.x : ctx.parsed.y;
            return `${ctx.dataset.label ?? ''}: ${formatValue(Number(raw ?? 0), kind)}`;
          },
        },
      },
    },
  } as ChartOptions<'bar' | 'line'>;
}

/** Eje en millones/miles para que los montos grandes no desborden. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${formatNumber(abs / 1_000_000)} M`;
  if (abs >= 1_000) return `${sign}$${formatNumber(abs / 1_000)} mil`;
  return formatMoney(value);
}

/** Estilo de barra: extremos redondeados de 4px y separación de 2px entre rellenos. */
export const BAR_STYLE = {
  borderRadius: 4,
  borderColor: INK.surface,
  borderWidth: 1,
  maxBarThickness: 36,
};

export const STACKED_BAR_STYLE = {
  borderRadius: 0,
  borderColor: INK.surface,
  borderWidth: { top: 2, bottom: 0, left: 0, right: 0 },
  maxBarThickness: 40,
};

export const LINE_STYLE = {
  borderWidth: 2,
  pointRadius: 4,
  pointHoverRadius: 6,
  pointBorderColor: INK.surface,
  pointBorderWidth: 2,
  tension: 0.2,
};
