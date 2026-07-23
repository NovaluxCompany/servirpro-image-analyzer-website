import { Page, expect } from '@playwright/test';

/**
 * Page Object para "Desactivar Afiliados".
 *
 * IMPORTANTE (regla de negocio): estas pruebas jamás deben usar el botón
 * "Inhabilitar todo". Este objeto ni siquiera expone un método para
 * clickearlo — solo permite seleccionar filas puntuales (1 o 2) y usar
 * "Desactivar seleccionados", para no arriesgar una desactivación masiva
 * que afecte afiliados reales.
 */
export class DeactivateAffiliatesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/desactivar-afiliados');
    await expect(
      this.page.getByRole('heading', { name: 'Desactivar Afiliados', level: 1 })
    ).toBeVisible();
  }

  /**
   * El filtro por nombre pega al backend con debounce, igual que en
   * Afiliados: se espera la ventana del debounce y luego, por una señal
   * real (el texto "Cargando afiliados..." desaparece), a que la tabla
   * termine de refrescarse antes de seguir.
   */
  async searchByName(name: string): Promise<void> {
    await this.page.getByPlaceholder('Buscar por nombre...').fill(name);
    await this.page.waitForTimeout(600);
    await expect(this.page.getByText('Cargando afiliados...')).toBeHidden({ timeout: 20_000 });
  }

  rowByName(name: string) {
    return this.page.locator('tbody tr', { hasText: name });
  }

  /**
   * Primera fila cuyo nombre contiene `namePrefix` (ej. "Prueba-" matchea
   * cualquier afiliado de prueba, sin necesitar el nombre exacto).
   */
  firstRowMatching(namePrefix: string) {
    return this.rowByName(namePrefix).first();
  }

  /** Marca el checkbox de UNA fila puntual (nunca "seleccionar todos"). */
  async selectRow(name: string): Promise<void> {
    await this.rowByName(name).locator('input[type="checkbox"]').check();
  }

  /** Igual que selectRow, pero sobre la primera fila que matchea un prefijo. */
  async selectFirstRowMatching(namePrefix: string): Promise<void> {
    await this.firstRowMatching(namePrefix).locator('input[type="checkbox"]').check();
  }

  async deactivateSelectedButton() {
    return this.page.getByRole('button', { name: 'Desactivar seleccionados' });
  }

  async confirmDeactivation(): Promise<void> {
    const button = await this.deactivateSelectedButton();
    await expect(button).toBeEnabled();
    await button.click();

    await expect(
      this.page.getByRole('heading', { name: 'Desactivar afiliados', level: 3 })
    ).toBeVisible();
    await this.page.getByRole('button', { name: /Sí, desactivar/ }).click();
  }

  /**
   * OJO: el modal "Resumen de inhabilitación" SOLO aparece si hubo fallos
   * parciales (`response.failed?.length > 0` en el componente). En una
   * desactivación exitosa y limpia — el caso normal — el componente
   * recarga la lista y muestra un toast, nunca ese modal. La señal
   * confiable de éxito es que la fila desaparezca de "sin pago" (ya no
   * está activa/impaga) tras recargar los datos.
   */
  async expectDeactivated(name: string): Promise<void> {
    await expect(this.firstRowMatching(name)).toBeHidden({ timeout: 20_000 });
  }
}
