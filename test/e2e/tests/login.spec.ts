import { test, expect } from '@playwright/test';
import { CREDENTIALS } from '../fixtures/credentials';
import { LoginPage } from '../pages/login.page';

test.describe('Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // fuerza sesión limpia

  for (const role of Object.keys(CREDENTIALS) as Array<keyof typeof CREDENTIALS>) {
    test(`login válido - rol ${role}`, async ({ page }) => {
      const { email, password } = CREDENTIALS[role];
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.login(email, password);
      await loginPage.expectLoggedIn();
    });
  }

  test('credenciales inválidas muestran error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('no-existe@e2e-test.local', 'ClaveIncorrecta123');
    await loginPage.expectError();
    await expect(page).toHaveURL(/\/login|\/$/);
  });

  test('campos vacíos no permiten enviar el formulario', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
    await expect(page).toHaveURL(/\/login|\/$/);
  });
});
