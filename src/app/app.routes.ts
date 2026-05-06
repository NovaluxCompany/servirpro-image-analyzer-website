import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { PruebaLogin } from './prueba-login/prueba-login';
import { LoginGuardian } from '../app/core/guard/login-guard';
import { LayoutComponent } from './core/components/layout/layout';

export const routes: Routes = [
    {path: '', component: Login},
    {
        path: '',
        component: LayoutComponent,
        canActivate: [LoginGuardian],
        children: [
            {path: 'prueba', component: PruebaLogin},
            {
                path: 'transacciones',
                loadChildren: () => import('./transactions/transactions.routes').then(m => m.routes)
            },
            {
                path: 'afiliados',
                loadChildren: () => import('./affiliates/affiliates.routes').then(m => m.affiliatesRoutes)
            }
        ]
    }
    //{path: '**'}
];
