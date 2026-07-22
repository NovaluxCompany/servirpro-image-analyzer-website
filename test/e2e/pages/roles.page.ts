import { Page, expect } from '@playwright/test';

export class RolesPage {
  constructor(private readonly page: Page) {}

  /**
   * Borra por API los roles de prueba creados por este spec (prefijo
   * "Prueba-Rol-"), para no dejar basura acumulándose en el selector de
   * "Asignar Rol" de Usuarios: con muchos roles ese modal (sin scroll
   * interno) desborda el viewport y rompe ese flujo. Usa el mismo endpoint
   * que RolesService (ver src/app/modules/roles/services/roles.service.ts)
   * y el token guardado por TokenService en localStorage bajo la key "token".
   */
  async cleanupTestRoles(): Promise<void> {
    // Coincide con environment.ts (urlBD): backend real usado en dev/e2e.
    const apiUrl = 'http://localhost:3000/api';
    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const res = await this.page.request.get(`${apiUrl}/roles?page=1&limit=200`, { headers });
    if (!res.ok()) return;
    const body = await res.json();
    const testRoles = (body.items ?? []).filter((r: { name?: string }) =>
      r.name?.startsWith('Prueba-Rol-')
    );
    for (const role of testRoles) {
      await this.page.request.delete(`${apiUrl}/roles/${role.id}`, { headers }).catch(() => {});
    }
  }

  async goto(): Promise<void> {
    await this.page.goto('/roles');
    await expect(this.page.getByRole('heading', { name: 'Roles y Permisos' })).toBeVisible();
  }

  async openRolesTab(): Promise<void> {
    await this.page.getByRole('button', { name: 'Roles', exact: true }).click();
  }

  async openPermissionsTab(): Promise<void> {
    await this.page.getByRole('button', { name: 'Asignar Permisos' }).click();
    // La lista de roles del selector carga de forma asíncrona tras el click.
    await expect(this.page.locator('select option')).not.toHaveCount(1, { timeout: 15_000 });
  }

  /**
   * Devuelve el texto del primer rol seleccionable (distinto del placeholder
   * "-- Selecciona --"). Usa un locator con espera propia en vez de leer
   * allTextContents() en un instante fijo, para no correr contra un re-render
   * a mitad de camino tras openPermissionsTab().
   */
  async firstSelectableRoleName(): Promise<string> {
    const realOption = this.page.locator('select option').filter({ hasNotText: '-- Selecciona --' }).first();
    await expect(realOption, 'Se requiere al menos un rol configurado en el ambiente de pruebas.').toBeAttached({
      timeout: 10_000,
    });
    return (await realOption.textContent())?.trim() ?? '';
  }

  async openCreateModal(): Promise<void> {
    await this.page.getByRole('button', { name: 'Nuevo Rol' }).click();
    await expect(this.page.getByRole('heading', { name: 'Crear Nuevo Rol' })).toBeVisible();
  }

  async fillForm(data: { name: string; description?: string }): Promise<void> {
    await this.page.getByPlaceholder('Ej: Asesor').fill(data.name);
    if (data.description) {
      await this.page.getByPlaceholder('Descripción del rol').fill(data.description);
    }
  }

  /** El único campo obligatorio del rol es "Nombre del rol"; el botón se deshabilita mientras esté vacío. */
  saveButton() {
    return this.page.getByRole('button', { name: /Guardar Rol|Procesando.../ });
  }

  async submit(): Promise<void> {
    await this.saveButton().click();
  }

  rowByName(name: string) {
    return this.page.locator('tbody tr', { hasText: name });
  }

  async openRowActions(name: string): Promise<void> {
    await this.rowByName(name).locator('button[title="Acciones"]').click();
  }

  /** El dropdown de fila usa "fixed z-50" sin "inset-0"; los modales usan "fixed inset-0 z-50". */
  rowDropdown() {
    return this.page.locator('div.fixed.z-50:not(.inset-0)');
  }

  modalOverlay() {
    return this.page.locator('div.fixed.inset-0.z-50');
  }

  async askToggleFromRow(name: string): Promise<void> {
    await this.openRowActions(name);
    await this.rowDropdown().getByRole('button', { name: /Deshabilitar|Habilitar/ }).click();
  }

  async confirmToggle(): Promise<void> {
    const modal = this.modalOverlay();
    await modal.getByRole('button', { name: /Sí, (deshabilitar|habilitar)/ }).click();
  }

  // --- Tab "Asignar Permisos" ---

  async selectRoleForPermissions(roleName: string): Promise<void> {
    await this.page.locator('select').selectOption({ label: roleName });
    await expect(this.page.getByRole('heading', { name: roleName, level: 3 })).toBeVisible();
    // Los checkboxes de permisos individuales (dentro de ".ml-6", uno por
    // menú) cargan tras seleccionar el rol; esperamos a que al menos uno
    // esté listo antes de seguir, para no leer el DOM a mitad de un render.
    await expect(this.page.locator('.ml-6 input[type="checkbox"]').first()).toBeAttached({ timeout: 10_000 });
  }

  permissionCheckbox(permissionDescription: string) {
    return this.page
      .locator('label', { hasText: permissionDescription })
      .locator('input[type="checkbox"]');
  }

  saveChangesButton() {
    return this.page.getByRole('button', { name: 'Guardar Cambios' });
  }

  async askConfirmPermissions(): Promise<void> {
    await this.saveChangesButton().click();
    await expect(
      this.page.getByRole('heading', { name: 'Confirmar cambio de permisos' })
    ).toBeVisible();
  }

  async confirmPermissionsChange(): Promise<void> {
    const modal = this.modalOverlay();
    await modal.getByRole('button', { name: /Sí, confirmar|Procesando.../ }).click();
  }
}
