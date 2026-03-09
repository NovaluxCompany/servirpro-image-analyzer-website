import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { PruebaLogin } from './prueba-login/prueba-login';
import { LoginGuardian } from '../app/core/guard/login-guard';

export const routes: Routes = [
    {path: '', component: Login},
    {path: 'prueba', component: PruebaLogin, canActivate:[LoginGuardian]}
    //{path: '**'}
];
