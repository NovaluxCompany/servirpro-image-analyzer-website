import { Page, expect } from '@playwright/test';
import { pickFirstSearchableSelectOption, pickFirstComboboxOption } from '../utils/searchable-select';
import { buildDummyPdf } from '../utils/build-dummy-pdf';

export interface NewAffiliateData {
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}

export class AffiliatesPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/afiliados');
    await expect(this.page.getByRole('heading', { name: 'Afiliados' })).toBeVisible();
  }

  async openCreateModal(): Promise<void> {
    await this.page.getByRole('button', { name: 'Nuevo Afiliado' }).click();
    await expect(this.page.getByRole('heading', { name: 'Nuevo Afiliado', level: 2 })).toBeVisible();
  }

  /**
   * Llena la Sección 1 (Datos Personales). "Tipo de documento" ya trae "CC"
   * por defecto. Género y Referencia usan la primera opción disponible.
   *
   * Departamento tarda en cargar su catálogo, así que se le da hasta 45s de
   * margen antes de elegir una opción. Municipio (depende del departamento
   * elegido) usa el mismo margen.
   */
  async fillPersonalData(data: NewAffiliateData): Promise<void> {
    const form = this.page.locator('form');

    await form.locator('input[formcontrolname="documentNumber"]').fill(data.documentNumber);
    await form.locator('input[formcontrolname="firstName"]').fill(data.firstName);
    await form.locator('input[formcontrolname="lastName"]').fill(data.lastName);

    await pickFirstComboboxOption(this.page, form, 'Referencia');
    await pickFirstSearchableSelectOption(this.page, form, 'Género');

    await form.locator('input[formcontrolname="email"]').fill(data.email);

    await pickFirstSearchableSelectOption(this.page, form, 'Departamento', { timeoutMs: 45_000 });
    await pickFirstSearchableSelectOption(this.page, form, 'Municipio', { timeoutMs: 45_000 });
  }

  /**
   * La Sección 2 ("Datos de Afiliación") empieza ABIERTA por defecto
   * (`section2Open = true` en el componente) — clickear su header a ciegas
   * la CIERRA en vez de abrirla. Solo se clickea si de verdad está
   * colapsada (el campo "Plan" no visible todavía).
   */
  async openSectionAfiliacion(): Promise<void> {
    const planLabel = this.page.locator('form').locator('label', { hasText: 'Plan' }).first();
    const alreadyOpen = await planLabel.isVisible().catch(() => false);
    if (!alreadyOpen) {
      await this.page.getByText('Datos de Afiliación').click();
      await planLabel.waitFor({ state: 'visible', timeout: 5_000 });
    }
  }

  /**
   * Llena la Sección 2. Según el Plan elegido, algunos campos son
   * obligatorios y otros no aplican (profesión + nivel ARL si el plan
   * incluye "ARL", EPS si incluye "EPS", AFP si incluye "AFP", Caja de
   * compensación si incluye "CCF") — se resuelve dinámicamente con el
   * texto del Plan que realmente quedó seleccionado, no a ciegas.
   */
  async fillAffiliationData(): Promise<void> {
    const form = this.page.locator('form');

    const planText = await pickFirstSearchableSelectOption(this.page, form, 'Plan');
    await pickFirstSearchableSelectOption(this.page, form, 'Agrupadora');
    await pickFirstSearchableSelectOption(this.page, form, 'Asesor');

    if (/ARL/i.test(planText)) {
      await form.locator('input[formcontrolname="profession"]').fill('Ingeniero de pruebas');
      await form.locator('input[formcontrolname="arl"]').fill('1');
    }
    if (/EPS/i.test(planText)) {
      await pickFirstSearchableSelectOption(this.page, form, 'EPS asignada');
    }
    if (/AFP/i.test(planText)) {
      await pickFirstSearchableSelectOption(this.page, form, 'AFP');
    }
    if (/CCF/i.test(planText)) {
      await pickFirstSearchableSelectOption(this.page, form, 'Caja de compensación');
    }

    const today = new Date().toISOString().slice(0, 10);
    await form.locator('input[formcontrolname="companyEntryDate"]').fill(today);

    // Opcional para casi todos los casos, obligatorio si la agrupadora
    // resultó ser de tipo "Gestión": se adjunta siempre para cubrir ambos
    // casos sin depender de qué agrupadora tocó al azar.
    const dummyPdfPath = buildDummyPdf();
    await form.locator('input[type="file"]').setInputFiles(dummyPdfPath);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: /Crear afiliado|Guardar cambios/ }).click();
  }

  async expectCreatedToastOrModalClosed(): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: 'Nuevo Afiliado', level: 2 })
    ).toBeHidden({ timeout: 15_000 });
  }

  /** Espera a que la tabla termine de cargar (desaparecen las filas skeleton). */
  async waitForTableLoaded(timeoutMs = 20_000): Promise<void> {
    await expect(this.page.locator('tbody tr.animate-pulse')).toHaveCount(0, { timeout: timeoutMs });
  }

  /**
   * El filtro por nombre pega al backend (no es un filtro client-side) y
   * tiene debounce antes de disparar la llamada, así que una pequeña espera
   * fija cubre esa ventana antes de esperar (de forma real, por el
   * indicador de carga) a que la tabla "asiente" el resultado filtrado.
   */
  async searchByName(name: string): Promise<void> {
    await this.page.getByPlaceholder('Buscar por nombre...').fill(name);
    await this.page.waitForTimeout(600); // ventana del debounce antes del fetch
    await this.waitForTableLoaded();
  }

  rowByName(name: string) {
    return this.page.locator('tbody tr', { hasText: name });
  }

  async openEditForRow(name: string): Promise<void> {
    const row = this.rowByName(name);
    await row.locator('button[title="Acciones"]').click();
    await this.page.getByRole('button', { name: 'Editar' }).click();
  }
}
