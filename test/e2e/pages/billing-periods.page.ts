import { Page, Locator, expect } from '@playwright/test';

export type BillingPeriodStatus = 'PENDING' | 'INVOICED' | 'ERROR';

export class BillingPeriodsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/periodos-facturacion');
    await expect(this.page.getByRole('heading', { name: 'Periodos de Facturación' })).toBeVisible();
  }

  /**
   * Crea un periodo de facturación por API para el affiliationId dado (mes/año
   * actuales). Hoy no existe flujo de UI para conciliar un pago y disparar esa
   * creación automáticamente (ver TransactionsService.markLatestBillingPeriodsAsNew,
   * que no tiene botón equivalente en el frontend), así que se llama directo al
   * backend con el token guardado por TokenService en localStorage bajo "token"
   * — mismo patrón que RolesPage.cleanupTestRoles().
   *
   * `categoryId` debe ser la categoría (ORDINARIO/NO ORDINARIO/RESOLUCION) real
   * del afiliado (ver AffiliatesPage.submitAndGetCreated()), NO un string libre:
   * CreateAffiliateBillingPeriodDto no tiene ningún campo "block" — el
   * ValidationPipe global (forbidNonWhitelisted) rechaza con 400 cualquier
   * propiedad que no exista en el DTO.
   */
  async createBillingPeriodForAffiliation(
    affiliationId: number,
    categoryId: number,
    expectedAmount: number,
  ): Promise<number> {
    const apiUrl = 'http://localhost:3000/api'; // coincide con environment.ts (urlBD)
    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    const now = new Date();

    const res = await this.page.request.post(`${apiUrl}/affiliate-billing-periods`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        affiliationId,
        periodYear: now.getFullYear(),
        periodMonth: now.getMonth() + 1,
        categoryId,
        expectedAmount,
      },
    });
    expect(res.ok(), `No se pudo crear el periodo de facturación de prueba: ${await res.text()}`).toBe(true);
    const body = await res.json();
    return body.id;
  }

  /**
   * Nombre de la categoría (ORDINARIO/NO ORDINARIO/RESOLUCION) de un periodo
   * ya creado, tal como quedó guardada en la BD (GET /affiliate-billing-periods/:id
   * trae la relación `category`). Sirve para verificar temprano, con un mensaje
   * claro, que la clasificación automática del afiliado dio la categoría
   * esperada — en vez de descubrirlo indirectamente más tarde como un
   * "no coincide con ninguna regla de pricing" en la modal de envío.
   */
  async getCategoryName(billingPeriodId: number): Promise<string | null> {
    const apiUrl = 'http://localhost:3000/api';
    const token = await this.page.evaluate(() => localStorage.getItem('token'));
    const res = await this.page.request.get(`${apiUrl}/affiliate-billing-periods/${billingPeriodId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `No se pudo consultar el periodo de facturación de prueba: ${await res.text()}`).toBe(true);
    const body = await res.json();
    return body.category?.name ?? null;
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

  /**
   * Busca una fila por nombre de afiliado recorriendo páginas con "Siguiente"
   * si hace falta. La tabla no tiene filtro de nombre/cédula (solo fecha y
   * estado) y ordena por periodYear/periodMonth sin desempate, así que un
   * periodo recién creado en el mes actual puede caer en cualquier página
   * cuando hay muchos otros periodos del mismo mes.
   */
  async findRowByAffiliateNameAcrossPages(name: string, maxPages = 10): Promise<Locator> {
    for (let i = 0; i < maxPages; i++) {
      const row = this.rowByAffiliateName(name);
      const found = await row.isVisible().catch(() => false);
      if (found) return row;

      const nextButton = this.page.getByRole('button', { name: 'Siguiente' });
      const canGoNext = await nextButton.isEnabled().catch(() => false);
      if (!canGoNext) break;
      await nextButton.click();
      await this.waitForTableLoaded(20_000);
    }
    return this.rowByAffiliateName(name);
  }

  /** Fila cuya columna de afiliado contiene el nombre dado (clientLabel: "Nombre (documento)"). */
  rowByAffiliateName(name: string): Locator {
    return this.rows().filter({ hasText: name });
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

  lateFeeInput(): Locator {
    return this.modal().locator('#late-fee-input');
  }

  async setLateFee(value: number): Promise<void> {
    await this.lateFeeInput().fill(String(value));
  }

  totalRow(): Locator {
    return this.modal().locator('dl div', { hasText: 'Total a enviar' });
  }

  planValueRow(): Locator {
    return this.modal().locator('dl div', { hasText: 'Valor del plan' });
  }

  adminRow(): Locator {
    return this.modal().locator('dl div', { hasText: 'Administración' });
  }

  reserveRow(): Locator {
    return this.modal().locator('dl div', { hasText: 'Reserva' });
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

  async cancelSend(): Promise<void> {
    await this.cancelButton().click();
  }

  /**
   * NO se agrega un helper de confirmSend()/expectSendSuccessToast() a propósito:
   * el botón "Confirmar envío" ya llama al endpoint real que crea la factura en
   * Siigo (POST /affiliate-billing-periods/:id/send-to-siigo). No se debe
   * automatizar ese click en e2e salvo contra un afiliado de prueba dedicado
   * (ver instrucciones del equipo sobre nombrar afiliados de prueba
   * "PruebaFactura" antes de probar este flujo).
   */

  async expectNoMatchErrorToast(): Promise<void> {
    await expect(
      this.page.getByText('Este pago no coincide con ninguna regla de pricing de Siigo y no puede enviarse.')
    ).toBeVisible({ timeout: 15_000 });
  }
}
