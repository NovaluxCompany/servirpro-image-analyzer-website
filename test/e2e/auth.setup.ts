import { test as setup } from '@playwright/test';
import { CREDENTIALS, authStateFile, RoleName } from './fixtures/credentials';
import { LoginPage } from './pages/login.page';

const roles: RoleName[] = ['Administrador', 'Asesor', 'Pago', 'CargaAfiliados'];

for (const role of roles) {
  setup(`autenticar rol ${role}`, async ({ page }) => {
    const { email, password } = CREDENTIALS[role];
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(email, password);
    await loginPage.expectLoggedIn();

    await page.context().storageState({ path: authStateFile(role) });
  });
}
