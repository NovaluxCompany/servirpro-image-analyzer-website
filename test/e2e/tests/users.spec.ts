import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { UsersPage } from '../pages/users.page';
import { randomEmail } from '../utils/test-data';

test.use({ storageState: authStateFile('Administrador') });

test.describe('Usuarios', () => {
  test('crear usuario muestra notificación (toast), no un modal de éxito', async ({ page }) => {
    const usersPage = new UsersPage(page);
    const email = randomEmail('e2e-usuario');

    await usersPage.goto();
    await usersPage.openCreateModal();
    await usersPage.fillCreateForm({ name: 'Usuario Prueba E2E', email, password: 'Prueba.2026' });
    await usersPage.continueToConfirm();
    await usersPage.confirmCreate();

    await usersPage.expectCreateToast();
    // El modal "¡Usuario creado!" ya no debe existir en el flujo.
    await expect(page.getByRole('heading', { name: '¡Usuario creado!' })).toHaveCount(0);

    await usersPage.searchByEmail(email);
    await expect(usersPage.rowByEmail(email)).toBeVisible({ timeout: 15_000 });
  });

  test('el botón "Asignar Rol" se deshabilita mientras se procesa (evita doble notificación)', async ({
    page,
  }) => {
    const usersPage = new UsersPage(page);
    // Usuario de prueba dedicado a este spec — nunca un usuario "delicado"
    // (admin real, etc.). Ajusta este correo si vuelves a regenerar datos.
    const targetEmail = 'e2eusuario.1784147384257@e2e-test.local';

    await usersPage.goto();
    await page.getByRole('button', { name: 'Asignar Rol', exact: true }).first().click(); // tab
    await expect(page.locator('tbody tr.animate-pulse')).toHaveCount(0, { timeout: 15_000 });

    await usersPage.searchByEmail(targetEmail);
    const row = usersPage.rowByEmail(targetEmail);
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.locator('button[title="Acciones"]').click();
    // El dropdown de acciones de la fila usa "fixed z-50" (sin inset-0), a
    // diferencia del overlay del modal ("fixed inset-0 z-50"): así no chocan.
    await page.locator('div.fixed.z-50:not(.inset-0)').getByRole('button', { name: 'Asignar Rol' }).click();

    const roleModal = usersPage.roleModal();
    await expect(roleModal.getByRole('heading', { name: 'Asignar Rol' })).toBeVisible();

    // Elige un rol DISTINTO al que ya tiene (nunca reasigna el mismo rol,
    // porque entonces el backend no cambia nada y el test no prueba nada) y
    // evita "Administrador" a propósito: ese rol dispara un modal de
    // advertencia adicional que rompería la aserción de "botón deshabilitado
    // mientras se procesa" que es el foco real de este test.
    const otherRoleLabel = roleModal
      .locator('label')
      .filter({ hasNotText: 'Actual' })
      .filter({ hasNotText: 'Administrador' })
      .first();
    await otherRoleLabel.click();

    await usersPage.assertRoleAssignButtonDisablesWhileSubmitting();
  });
});
