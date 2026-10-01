import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { MetricsDashboardComponent } from './pages/metrics-dashboard/metrics-dashboard';
import { MetricDetailComponent } from './pages/metric-detail/metric-detail';

export const metricsRoutes: Routes = [
  {
    path: '',
    component: MetricsDashboardComponent,
    canActivate: [LoginGuardian, roleGuard],
  },
  {
    // /metricas/<grafico>: detalle con filtros propios (ver METRIC_CHARTS).
    path: ':chart',
    component: MetricDetailComponent,
    canActivate: [LoginGuardian, roleGuard],
  },
];
