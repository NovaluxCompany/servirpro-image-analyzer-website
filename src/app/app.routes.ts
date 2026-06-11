import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { LoginGuardian } from '../app/core/guard/login-guard';
import { roleGuard } from './core/guard/role.guard';
import { redirectBackGuard } from './core/guard/redirect-back.guard';
import { LayoutComponent } from './core/components/layout/layout';

export const routes: Routes = [
    { path: '', component: Login },
    { path: 'login', component: Login },
    {
        path: '',
        component: LayoutComponent,
        canActivate: [LoginGuardian],
        children: [
            {
                path: 'transacciones',
                canActivate: [roleGuard],
                loadChildren: () => import('./modules/transactions/transactions.routes').then(m => m.routes)
            },
            {
                path: 'afiliados',
                canActivate: [roleGuard],
                loadChildren: () => import('./modules/affiliates/affiliates.routes').then(m => m.affiliatesRoutes)
            },
            {
                path: 'menu',
                canActivate: [redirectBackGuard],
                loadChildren: () => import('./modules/menu/services/menu.routes').then(m => m.menuRoutes)
            },
            {
                path: 'roles',
                canActivate: [redirectBackGuard],
                loadChildren: () => import('./modules/roles/roles.routes').then(m => m.rolesRoutes)
            },
            {
                path: 'desactivar-afiliados',
                canActivate: [roleGuard],
                loadChildren: () => import('./modules/deactivate-affiliates/deactivate-affiliates.routes').then(m => m.deactivateAffiliatesRoutes)
            },
            {
                path: 'actualizar-compania',
                canActivate: [roleGuard],
                loadChildren: () => import('./modules/update-company/update-company.routes').then(m => m.updateCompanyRoutes)
            }
        ]
    },
    { path: '**', canActivate: [redirectBackGuard], component: Login }
];
