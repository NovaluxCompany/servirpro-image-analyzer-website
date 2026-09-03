import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';

@Component({
  selector: 'app-affiliate-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './affiliate-info-modal.html',
})
export class AffiliateInfoModalComponent {
  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  closed = output<void>();

  onClose(): void {
    this.closed.emit();
  }

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
