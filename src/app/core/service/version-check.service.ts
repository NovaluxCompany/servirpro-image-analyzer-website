import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigGeneralService } from './config-general.service';

const VERSION_STORAGE_KEY = 'app_version';

@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private _configService = inject(ConfigGeneralService);

  async check(): Promise<void> {
    this.cleanCacheBustParam();

    try {
      const backendVersion = await firstValueFrom(
        this._configService.getAppVersion()
      );
      console.log('[VersionCheck] Versión del backend:', backendVersion);

      const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
      console.log('[VersionCheck] Versión almacenada en localStorage:', storedVersion);

      if (storedVersion !== null && storedVersion !== backendVersion) {
        console.warn(`[VersionCheck] Versión diferente detectada (${storedVersion} → ${backendVersion}). Limpiando caché y recargando...`);
        localStorage.setItem(VERSION_STORAGE_KEY, backendVersion);
        await this.clearCachesAndReload();
      } else {
        console.log('[VersionCheck] Versión al día. No se requiere recarga.');
        localStorage.setItem(VERSION_STORAGE_KEY, backendVersion);
      }
    } catch (error) {
      console.error('[VersionCheck] Error al consultar la versión del backend:', error);
    }
  }

  private cleanCacheBustParam(): void {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_cb')) {
      url.searchParams.delete('_cb');
      window.history.replaceState({}, '', url.toString());
      console.log('[VersionCheck] Parámetro de cache-bust limpiado de la URL.');
    }
  }

  private async clearCachesAndReload(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('[VersionCheck] Cache Storage eliminado:', cacheNames);
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Navegar a una URL nueva con timestamp fuerza al browser a ignorar el disk cache,
    // a diferencia de reload() que sigue sirviendo recursos cacheados.
    const url = new URL(window.location.href);
    url.searchParams.set('_cb', Date.now().toString());
    console.log('[VersionCheck] Redirigiendo con cache-bust:', url.toString());
    window.location.replace(url.toString());
  }
}
