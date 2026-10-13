import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { AffiliatesListComponent } from './pages/affiliates-list/affiliates-list';
import { DocumentUploadsListComponent } from './pages/document-uploads-list/document-uploads-list';
import { DocumentUploadDetailComponent } from './pages/document-upload-detail/document-upload-detail';

export const affiliatesRoutes: Routes = [
  {
    path: '',
    component: AffiliatesListComponent,
    canActivate: [LoginGuardian, roleGuard]
  },
  {
    path: 'cargue-documentos',
    component: DocumentUploadsListComponent,
    canActivate: [LoginGuardian, roleGuard]
  },
  {
    path: 'cargue-documentos/:id',
    component: DocumentUploadDetailComponent,
    canActivate: [LoginGuardian, roleGuard]
  },
];

/**
 * Espeja DOCUMENT_UPLOADS_MENU_PATH del backend
 * (document-uploads.controller.ts), usada por @RequirePermission ahí.
 */
export const DOCUMENT_UPLOADS_MENU_PATH = '/afiliados/cargue-documentos';
