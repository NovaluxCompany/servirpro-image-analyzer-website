import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';
import { AffiliateBasicDataTabComponent } from '../affiliate-basic-data-tab/affiliate-basic-data-tab';
import { IncapacityHistoryComponent } from '../../../incapacities/components/incapacity-history/incapacity-history';
import { DisaffiliationHistoryComponent } from '../disaffiliation-history/disaffiliation-history';
import { PermissionService } from '../../../../core/service/permission.service';
import { INCAPACITIES_MENU_PATH } from '../../../incapacities/incapacities.routes';

// Mismo path que gatea el paso 2 (confirmar) en Desactivar Afiliados. Se
// reutiliza acá para que quien no tiene acceso a ese menú tampoco vea el
// histórico de desafiliaciones del afiliado.
const DISAFFILIATION_MENU_PATH = '/desactivar-afiliados/desafiliar';

type InfoTab = 'datos' | 'incapacidades' | 'desafiliaciones';

/**
 * Ficha del afiliado. Pasó de ser una vista única a un contenedor de
 * pestañas: los datos básicos siguen igual (movidos a
 * affiliate-basic-data-tab), y se suman el histórico de incapacidades y el
 * de solicitudes de desafiliación, que se cargan solo cuando alguien abre
 * esa pestaña. Cada una de esas dos pestañas solo se muestra si el rol
 * tiene el permiso de 'view' correspondiente — si no, ni el botón aparece.
 */
@Component({
  selector: 'app-affiliate-info-modal',
  standalone: true,
  imports: [CommonModule, AffiliateBasicDataTabComponent, IncapacityHistoryComponent, DisaffiliationHistoryComponent],
  templateUrl: './affiliate-info-modal.html',
})
export class AffiliateInfoModalComponent {
  private _permission = inject(PermissionService);

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

  canViewIncapacities = computed(() => this._permission.can('view', INCAPACITIES_MENU_PATH));
  canViewDisaffiliations = computed(() => this._permission.can('view', DISAFFILIATION_MENU_PATH));

  onClose(): void {
    this.activeTab.set('datos');
    this.closed.emit();
  }
}
