import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { UsersPage } from '../pages/users.page';
import { randomEmail } from '../utils/test-data';

test.use({ storageState: authStateFile('Administrador') });

test.describe('Usuarios', () => {
  test('nombre, correo y contraseña son obligatorios; el correo valida formato', async ({
    page,
  }) => {
    const usersPage = new UsersPage(page);
    await usersPage.goto();
    await usersPage.openCreateModal();

    // Dejar cada campo vacío tras "tocarlo" (blur) marca el error de obligatorio,
    // y mientras tanto el botón "Continuar" permanece deshabilitado (no se puede
    // avanzar con el formulario inválido).
    const continueButton = page.getByRole('button', { name: 'Continuar' });
    await expect(continueButton).toBeDisabled();

    await page.getByPlaceholder('Nombre completo').click();
    await page.getByPlaceholder('correo@ejemplo.com').click();
    await page.getByPlaceholder('Mínimo 6 caracteres').click();
    await page.getByPlaceholder('Nombre completo').click(); // blur contraseña
    await expect(
      page.getByText('Este campo es obligatorio, no debe ir vacío.')
    ).toHaveCount(3);
    await expect(continueButton).toBeDisabled();

    // Un correo con formato inválido cambia el mensaje de "obligatorio" a "formato válido".
    await page.getByPlaceholder('correo@ejemplo.com').fill('correo-invalido');
    await page.getByPlaceholder('Mínimo 6 caracteres').click(); // blur correo
    await expect(page.getByText('Ingresa un correo electrónico con un formato válido.')).toBeVisible();
    await expect(continueButton).toBeDisabled();

    // El modal de confirmación nunca debe abrirse mientras el formulario sea inválido.
    await expect(
      page.getByRole('heading', { name: '¿Confirmar creación de usuario?' })
    ).toHaveCount(0);
  });

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
    // Usuario de prueba creado por este mismo test — nunca se reutiliza una
    // cuenta compartida o real, para no arriesgar datos de otros specs/producción.
    const targetEmail = randomEmail('e2e-role-submit');

    await usersPage.goto();
    await usersPage.createUser({ name: 'Usuario Prueba Rol E2E', email: targetEmail, password: 'Prueba.2026' });

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
    await otherRoleLabel.scrollIntoViewIfNeeded();
    await otherRoleLabel.click();

    await usersPage.assertRoleAssignButtonDisablesWhileSubmitting();
  });

  test('asignar el rol "Administrador" muestra una advertencia adicional antes de confirmar', async ({
    page,
  }) => {
    const usersPage = new UsersPage(page);
    // Usuario de prueba propio: así el modal de advertencia por Administrador
    // se dispara y se cancela sin afectar ninguna cuenta compartida o real.
    const targetEmail = randomEmail('e2e-admin-warn');

    await usersPage.goto();
    await usersPage.createUser({ name: 'Usuario Prueba Admin-Warn E2E', email: targetEmail, password: 'Prueba.2026' });

    await page.getByRole('button', { name: 'Asignar Rol', exact: true }).first().click();
    await expect(page.locator('tbody tr.animate-pulse')).toHaveCount(0, { timeout: 15_000 });

    await usersPage.searchByEmail(targetEmail);
    const row = usersPage.rowByEmail(targetEmail);
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.locator('button[title="Acciones"]').click();
    await page.locator('div.fixed.z-50:not(.inset-0)').getByRole('button', { name: 'Asignar Rol' }).click();

    const roleModal = usersPage.roleModal();
    await expect(roleModal.getByRole('heading', { name: 'Asignar Rol' })).toBeVisible();

    const adminLabel = roleModal.locator('label').filter({ hasText: 'Administrador' }).first();
    await adminLabel.scrollIntoViewIfNeeded();
    await adminLabel.click();
    const submitButton = roleModal.getByRole('button', { name: 'Asignar Rol', exact: true });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click();

    // Regla de negocio: asignar Administrador requiere una segunda confirmación
    // explícita, distinta al resto de roles, por el alcance de ese rol.
    await expect(page.getByRole('heading', { name: 'Atención' })).toBeVisible();
    await expect(
      page.getByText('Este rol tiene acceso a todos los módulos y puede cambiar mucha información sensible.')
    ).toBeVisible();

    // Cancela sin confirmar para no dejar Administrador realmente asignado
    // a este usuario de prueba compartido entre specs.
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(roleModal.getByRole('heading', { name: 'Asignar Rol' })).toBeVisible();
  });
});
