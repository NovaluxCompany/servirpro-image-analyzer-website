import { Page, Locator, expect } from '@playwright/test';

export type BillingPeriodStatus = 'PENDING' | 'INVOICED' | 'ERROR';

export class BillingPeriodsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/periodos-facturacion');
    await expect(this.page.getByRole('heading', { name: 'Periodos de Facturación' })).toBeVisible();
  }

  // --- Filtros ---

  async search(options: { dateFrom: string; dateTo: string; status?: BillingPeriodStatus }): Promise<void> {
    await this.page.locator('#dateFrom').fill(options.dateFrom);
    await this.page.locator('#dateTo').fill(options.dateTo);
    if (options.status) {
      await this.page.locator('#status').selectOption(options.status);
    }
    await this.page.getByRole('button', { name: 'Buscar' }).click();
  }

  /** Busca en un rango amplio (últimos ~3 años) para maximizar la chance de encontrar datos reales. */
  async searchWideRange(status?: BillingPeriodStatus): Promise<void> {
    const today = new Date();
    const dateTo = today.toISOString().slice(0, 10);
    const from = new Date(today);
    from.setFullYear(from.getFullYear() - 3);
    const dateFrom = from.toISOString().slice(0, 10);
    await this.search({ dateFrom, dateTo, status });
  }

  async expectDateFromRequiredError(): Promise<void> {
    await expect(this.page.getByText('La fecha desde es obligatoria')).toBeVisible();
  }

  async expectDateToRequiredError(): Promise<void> {
    await expect(this.page.getByText('La fecha hasta es obligatoria')).toBeVisible();
  }

  // --- Tabla ---

  table(): Locator {
    return this.page.locator('table');
  }

  rows(): Locator {
    return this.page.locator('tbody tr');
  }

  async expectEmptyState(): Promise<void> {
    await expect(this.page.getByText('No se encontraron periodos de facturación')).toBeVisible();
  }

  async expectPromptToSearch(): Promise<void> {
    await expect(
      this.page.getByText('Selecciona un rango de fechas y presiona Buscar para ver los periodos de facturación')
    ).toBeVisible();
  }

  async waitForTableLoaded(timeout = 15_000): Promise<void> {
    await expect(this.page.locator('tr.animate-pulse').first()).toHaveCount(0, { timeout });
  }

  /** Primera fila que expone el botón "Enviar a Siigo" (hasSiigoMatch = true), si existe. */
  rowWithSendToSiigoButton(): Locator {
    return this.rows().filter({ has: this.page.getByRole('button', { name: 'Enviar a Siigo' }) }).first();
  }

  async clickSendToSiigo(row: Locator): Promise<void> {
    await row.getByRole('button', { name: 'Enviar a Siigo' }).click();
  }

  // --- Modal "Enviar a Siigo" ---

  modal(): Locator {
    return this.page.locator('div.fixed.inset-0.z-50');
  }

  async expectModalVisible(): Promise<void> {
    await expect(this.modal().getByRole('heading', { name: 'Enviar a Siigo' })).toBeVisible();
  }

  async expectModalHidden(): Promise<void> {
    await expect(this.modal()).toHaveCount(0);
  }

  moraInput(): Locator {
    return this.modal().locator('#mora-input');
  }

  async setMora(value: number): Promise<void> {
    await this.moraInput().fill(String(value));
  }

  totalRow(): Locator {
    return this.modal().locator('dl div', { hasText: 'Total a enviar' });
  }

  async expectPricingBreakdownVisible(): Promise<void> {
    await expect(this.modal().getByText('Valor del plan')).toBeVisible({ timeout: 15_000 });
    await expect(this.modal().getByText('Total a enviar')).toBeVisible();
  }

  confirmButton(): Locator {
    return this.modal().getByRole('button', { name: 'Confirmar envío' });
  }

  cancelButton(): Locator {
    return this.modal().getByRole('button', { name: 'Cancelar' });
  }

  async confirmSend(): Promise<void> {
    await this.confirmButton().click();
  }

  async cancelSend(): Promise<void> {
    await this.cancelButton().click();
  }

  async expectSendSuccessToast(): Promise<void> {
    await expect(this.page.getByText('Información enviada a Siigo correctamente')).toBeVisible({ timeout: 15_000 });
  }

  async expectNoMatchErrorToast(): Promise<void> {
    await expect(
      this.page.getByText('Este pago no coincide con ninguna regla de pricing de Siigo y no puede enviarse.')
    ).toBeVisible({ timeout: 15_000 });
  }
}
