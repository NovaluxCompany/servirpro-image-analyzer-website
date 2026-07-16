import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';

/**
 * DEMO — este spec existe solo para mostrar cómo se ve un fallo en el
 * reporte de Playwright (captura de pantalla, trace, video). Bórralo
 * cuando ya no lo necesites: no forma parte del suite real.
 */
test.use({ storageState: authStateFile('Administrador') });

test('DEMO: este test está diseñado para fallar a propósito', async ({ page }) => {
  await page.goto('/afiliados');
  await expect(page.getByRole('heading', { name: 'Afiliados' })).toBeVisible();

  // Busca un texto que nunca va a existir en la página, a propósito.
  await expect(page.getByText('Este texto no existe en ninguna parte de la UI')).toBeVisible({
    timeout: 5_000,
  });
});
