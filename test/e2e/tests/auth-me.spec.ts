import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';

test.use({ storageState: authStateFile('Administrador') });

test.describe('GET /auth/me (refresco de roles/permisos en caliente)', () => {
  test('cada navegación protegida por roleGuard dispara /auth/me y devuelve el UserInfo actualizado', async ({
    page,
  }) => {
    // roleGuard llama a refreshUser() en cada navegación (ver role.guard.ts),
    // que a su vez pega contra GET /auth/me salvo que haya corrido hace
    // menos de REFRESH_USER_TTL_MS (3s) — ver auth.service.ts. Navegar en
    // frío a una ruta protegida es la forma más directa y realista de
    // observar esa llamada, sin depender de esperar el timer de 45s.
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith('/auth/me') && res.request().method() === 'GET',
        { timeout: 15_000 }
      ),
      page.goto('/afiliados'),
    ]);

    await expect(page.getByRole('heading', { name: 'Afiliados' })).toBeVisible();

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email');
    expect(Array.isArray(body.roles)).toBe(true);
    expect(Array.isArray(body.menuPaths)).toBe(true);
  });
});
