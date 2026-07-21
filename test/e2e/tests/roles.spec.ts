import { test, expect } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { RolesPage } from '../pages/roles.page';

test.use({ storageState: authStateFile('Administrador') });

function testRoleName(caseName: string): string {
  return `Prueba-Rol-${caseName}-${Date.now().toString().slice(-6)}`;
}

test.describe('Roles', () => {
  test.afterEach(async ({ page }) => {
    await new RolesPage(page).cleanupTestRoles();
  });

  test('el botón "Guardar Rol" se deshabilita si el nombre está vacío (único campo obligatorio)', async ({
    page,
  }) => {
    const rolesPage = new RolesPage(page);
    await rolesPage.goto();
    await rolesPage.openRolesTab();
    await rolesPage.openCreateModal();

    // Nombre vacío -> botón deshabilitado.
    await expect(rolesPage.saveButton()).toBeDisabled();

    // La descripción es opcional: llenarla sola no habilita el botón.
    await page.getByPlaceholder('Descripción del rol').fill('Solo descripción, sin nombre');
    await expect(rolesPage.saveButton()).toBeDisabled();
  });

  test('crea un rol nuevo (nace habilitado) y aparece en el listado', async ({ page }) => {
    const rolesPage = new RolesPage(page);
    const name = testRoleName('Crear');

    await rolesPage.goto();
    await rolesPage.openRolesTab();
    await rolesPage.openCreateModal();
    await rolesPage.fillForm({ name, description: 'Rol de prueba E2E' });
    await rolesPage.submit();

    await expect(page.getByRole('heading', { name: 'Crear Nuevo Rol' })).toHaveCount(0, {
      timeout: 15_000,
    });

    const row = rolesPage.rowByName(name);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Habilitado')).toBeVisible();
  });

  test('deshabilitar un rol requiere confirmación y actualiza su estado', async ({ page }) => {
    const rolesPage = new RolesPage(page);
    const name = testRoleName('Deshabilitar');

    await rolesPage.goto();
    await rolesPage.openRolesTab();
    await rolesPage.openCreateModal();
    await rolesPage.fillForm({ name });
    await rolesPage.submit();

    const row = rolesPage.rowByName(name);
    await expect(row).toBeVisible({ timeout: 15_000 });

    await rolesPage.askToggleFromRow(name);
    await expect(
      page.getByRole('heading', { name: 'Deshabilitar Rol' })
    ).toBeVisible();
    // Regla de negocio: al deshabilitar, se advierte que los usuarios con
    // este rol perderán el acceso asociado.
    await expect(
      page.getByText('Los usuarios con este rol perderán el acceso asociado.')
    ).toBeVisible();

    await rolesPage.confirmToggle();

    await expect(row.getByText('Deshabilitado')).toBeVisible({ timeout: 15_000 });
  });

  test('el botón "Guardar Cambios" de permisos permanece deshabilitado sin cambios', async ({
    page,
  }) => {
    const rolesPage = new RolesPage(page);
    await rolesPage.goto();
    await rolesPage.openPermissionsTab();

    const options = await page.locator('select option').allTextContents();
    const firstRealOption = options.find((o) => o.trim() && o !== '-- Selecciona --');
    test.skip(!firstRealOption, 'No hay roles disponibles para probar asignación de permisos.');

    await rolesPage.selectRoleForPermissions(firstRealOption!);

    // Sin tocar ningún checkbox, no hay cambios pendientes que guardar.
    await expect(rolesPage.saveChangesButton()).toBeDisabled();
  });

  test('cambiar un permiso habilita "Guardar Cambios" y pide confirmación antes de aplicar', async ({
    page,
  }) => {
    const rolesPage = new RolesPage(page);
    await rolesPage.goto();
    await rolesPage.openPermissionsTab();

    const options = await page.locator('select option').allTextContents();
    const firstRealOption = options.find((o) => o.trim() && o !== '-- Selecciona --');
    test.skip(!firstRealOption, 'No hay roles disponibles para probar asignación de permisos.');

    await rolesPage.selectRoleForPermissions(firstRealOption!);

    // Los checkboxes dentro del grid "ml-6" son permisos individuales; el
    // checkbox de la cabecera del menú es "Seleccionar todo" y se comporta
    // distinto (afecta a todos los permisos del menú a la vez).
    const firstCheckbox = page.locator('.ml-6 input[type="checkbox"]').first();
    test.skip((await firstCheckbox.count()) === 0, 'No hay menús/permisos configurados para probar.');

    await firstCheckbox.click();
    await expect(rolesPage.saveChangesButton()).toBeEnabled();

    await rolesPage.askConfirmPermissions();
    // Regla de negocio: el cambio afecta a todos los usuarios con ese rol.
    await expect(
      page.getByText('Esta acción afecta a todos los usuarios con este rol.')
    ).toBeVisible();
  });
});
