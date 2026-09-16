import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';

/**
 * Pestaña "Datos básicos" de la ficha del afiliado.
 *
 * Es el contenido que antes vivía dentro de affiliate-info-modal, movido tal
 * cual: el modal pasó a ser un contenedor de pestañas y este componente
 * quedó con el marcado y los helpers de presentación que ya existían.
 */
@Component({
  selector: 'app-affiliate-basic-data-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './affiliate-basic-data-tab.html',
})
export class AffiliateBasicDataTabComponent {
  affiliate = input<AffiliateMember | null>(null);

  formatDate(date?: string | Date): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const [y, m, day] = d.toISOString().substring(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }

  display(value: unknown): string {
    if (value === null || value === undefined) return '—';
    const str = String(value).trim();
    return str === '' ? '—' : str;
  }

  referralTypeLabel(value?: string): string {
    const labels: Record<string, string> = {
      META: 'Meta',
      WEB: 'Web',
      REINGRESO: 'Reingreso',
      REFERIDO: 'Referido',
      SIN_ESPECIFICAR: 'Sin especificar',
    };
    return value ? (labels[value] ?? value) : '—';
  }
}
