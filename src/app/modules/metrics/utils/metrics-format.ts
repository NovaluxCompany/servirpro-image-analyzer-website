import { Pipe, PipeTransform } from '@angular/core';

const MONEY = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatMoney(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n < 0 ? '-' : ''}$${MONEY.format(Math.abs(n))}`;
}

export function formatNumber(value: number | null | undefined): string {
  return NUMBER.format(Number(value ?? 0));
}

/** '2026-07' -> 'Jul 2026' */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${year}`;
}

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatMoney(value);
  }
}

@Pipe({ name: 'monthLabel', standalone: true })
export class MonthLabelPipe implements PipeTransform {
  transform(value: string): string {
    return formatMonth(value);
  }
}
