import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';
import { AffiliateBasicDataTabComponent } from '../affiliate-basic-data-tab/affiliate-basic-data-tab';
import { IncapacityHistoryComponent } from '../../../incapacities/components/incapacity-history/incapacity-history';

type InfoTab = 'datos' | 'incapacidades';

/**
 * Ficha del afiliado. Pasó de ser una vista única a un contenedor de dos
 * pestañas: los datos básicos siguen igual (movidos a
 * affiliate-basic-data-tab) y se suma el histórico de incapacidades, que se
 * carga solo cuando alguien abre esa pestaña.
 */
@Component({
  selector: 'app-affiliate-info-modal',
  standalone: true,
  imports: [CommonModule, AffiliateBasicDataTabComponent, IncapacityHistoryComponent],
  templateUrl: './affiliate-info-modal.html',
})
export class AffiliateInfoModalComponent {
  isVisible = input<boolean>(false);
  affiliate = input<AffiliateMember | null>(null);

  closed = output<void>();

  /** Siempre abre en datos básicos, que es lo que se consulta el 90% de las veces. */
  activeTab = signal<InfoTab>('datos');

  /** El id de la afiliación llega como string desde el listado. */
  affiliationId = computed<number | null>(() => {
    const id = this.affiliate()?.id;
    return id ? Number(id) : null;
  });

  onClose(): void {
    this.activeTab.set('datos');
    this.closed.emit();
  }
}
