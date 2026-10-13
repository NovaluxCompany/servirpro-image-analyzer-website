import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { IncapacitiesListComponent } from './pages/incapacities-list/incapacities-list';

export const incapacitiesRoutes: Routes = [
  {
    path: '',
    component: IncapacitiesListComponent,
    canActivate: [LoginGuardian, roleGuard],
  },
];

/**
 * Ruta del menú contra la que se validan los permisos del módulo.
 *
 * Vive acá y no en cada pantalla porque otros módulos también la necesitan:
 * el listado de afiliados valida 'create' sobre este path antes de abrir el
 * modal de "Enviar a incapacidades". Espeja INCAPACITIES_MENU_PATH del
 * backend (incapacities.service.ts).
 */
export const INCAPACITIES_MENU_PATH = '/incapacidades';
