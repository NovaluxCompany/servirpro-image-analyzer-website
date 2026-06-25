import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { DATE_PIPE_DEFAULT_TIMEZONE } from '@angular/common';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { VersionCheckService } from './core/service/version-check.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    { provide: DATE_PIPE_DEFAULT_TIMEZONE, useValue: 'America/Bogota' },
    {
      provide: APP_INITIALIZER,
      useFactory: (versionCheck: VersionCheckService) => () => versionCheck.check(),
      deps: [VersionCheckService],
      multi: true,
    }
  ]
};
