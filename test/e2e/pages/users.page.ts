import { Page, expect } from '@playwright/test';

export class UsersPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/usuarios');
    await expect(this.page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
  }

  async openCreateModal(): Promise<void> {
    await this.page.getByRole('button', { name: 'Nuevo Usuario' }).click();
    await expect(this.page.getByRole('heading', { name: 'Crear Usuario' })).toBeVisible();
  }

  async fillCreateForm(data: { name: string; email: string; password: string }): Promise<void> {
    await this.page.getByPlaceholder('Nombre completo').fill(data.name);
    await this.page.getByPlaceholder('correo@ejemplo.com').fill(data.email);
    await this.page.getByPlaceholder('Mínimo 6 caracteres').fill(data.password);
  }

  async continueToConfirm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      this.page.getByRole('heading', { name: '¿Confirmar creación de usuario?' })
    ).toBeVisible();
  }

  async confirmCreate(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirmar' }).click();
  }

  async expectCreateToast(): Promise<void> {
    await expect(this.page.getByText(/creado correctamente/)).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Crea un usuario de prueba dedicado (propio email/password) para specs que
   * necesiten operar sobre un usuario real sin tocar cuentas compartidas
   * entre tests o datos de producción. Deja al usuario visible en el
   * listado, listo para buscarlo con searchByEmail/rowByEmail.
   */
  async createUser(data: { name: string; email: string; password: string }): Promise<void> {
    await this.openCreateModal();
    await this.fillCreateForm(data);
    await this.continueToConfirm();
    await this.confirmCreate();
    await this.expectCreateToast();
  }

  rowByEmail(email: string) {
    return this.page.locator('tbody tr', { hasText: email });
  }

  async searchByEmail(email: string): Promise<void> {
    await this.page.getByPlaceholder('Buscar por correo...').fill(email);
  }

  async openRowActions(email: string): Promise<void> {
    await this.rowByEmail(email).locator('button[title="Acciones"]').click();
  }

  /**
   * El overlay del modal es el único elemento "fixed inset-0 z-50" visible
   * en este flujo (el dropdown de acciones de fila solo usa "fixed z-50",
   * sin inset-0). Acotar a este locator evita choques con el botón "Asignar
   * Rol" de la tab o el de otros elementos con el mismo texto.
   */
  roleModal() {
    return this.page.locator('div.fixed.inset-0.z-50');
  }

  /** Regresión: el botón debe deshabilitarse en cuanto se envía, evitando doble notificación. */
  async assertRoleAssignButtonDisablesWhileSubmitting(): Promise<void> {
    const button = this.roleModal().getByRole('button', { name: /Asignar Rol|Asignando.../ });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(button).toBeDisabled();
  }
}
