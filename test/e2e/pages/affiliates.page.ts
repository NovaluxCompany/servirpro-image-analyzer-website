import { Page, Locator, expect } from '@playwright/test';
import path from 'path';
import { pickFirstSearchableSelectOption, pickFirstComboboxOption } from '../utils/searchable-select';

const AFFILIATE_DOCUMENT_FIXTURE = path.resolve(__dirname, '../fixtures/subregiones.pdf');
const AFFILIATE_DOCUMENT_FIXTURE_2 = path.resolve(__dirname, '../fixtures/generated/dummy-affiliate-document.pdf');

/** Dos PDF reales del repo, para probar la carga de VARIOS documentos a la vez. */
export const AFFILIATE_DOCUMENT_FIXTURES_MULTIPLE = [AFFILIATE_DOCUMENT_FIXTURE, AFFILIATE_DOCUMENT_FIXTURE_2];

/** Escapa caracteres especiales de regex (ej. el "+" de planes como "EPS+ARL5+AFP"). */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface NewAffiliateData {
  documentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Tipo de documento (catálogo "Tipo de documento"), ej. "CC", "CE", "PPT". Por defecto usa el primero disponible. */
  documentType?: string;
  /** Fecha de nacimiento en formato YYYY-MM-DD (input[type=date]). Opcional. */
  birthDate?: string;
  /** Texto del género (catálogo "Género"): "Hombre" o "Mujer" (así aparecen las opciones en el select, no "Masculino"/"Femenino"). Por defecto usa el primero disponible. */
  genderText?: string;
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

    if (data.documentType) {
      await pickFirstSearchableSelectOption(this.page, form, 'Tipo de documento', {
        matchText: new RegExp(`^\\s*${escapeRegExp(data.documentType)}\\s*$`, 'i'),
        searchText: data.documentType,
        timeoutMs: 15_000,
      });
    }

    await form.locator('input[formcontrolname="documentNumber"]').fill(data.documentNumber);
    await form.locator('input[formcontrolname="firstName"]').fill(data.firstName);
    await form.locator('input[formcontrolname="lastName"]').fill(data.lastName);

    await pickFirstComboboxOption(this.page, form, 'Referencia');

    if (data.birthDate) {
      await form.locator('input[formcontrolname="birthDate"]').fill(data.birthDate);
    }

    if (data.genderText) {
      await pickFirstSearchableSelectOption(this.page, form, 'Género', {
        matchText: new RegExp(`^\\s*${escapeRegExp(data.genderText)}\\s*$`, 'i'),
        searchText: data.genderText,
        timeoutMs: 15_000,
      });
    } else {
      await pickFirstSearchableSelectOption(this.page, form, 'Género');
    }

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
  async fillAffiliationData(overrides?: {
    planText?: string;
    agrupadoraText?: string;
    /** "" (sin especificar, default) | "NUEVO" | "REINGRESO" | "REFERIDO" */
    referralType?: '' | 'NUEVO' | 'REINGRESO' | 'REFERIDO';
    /** Rutas de los PDF a adjuntar. Por defecto sube un único archivo de prueba. */
    documentFiles?: string[];
  }): Promise<void> {
    const form = this.page.locator('form');

    // Match EXACTO para no caer en "EPS+AFP" al buscar "EPS". El <li> del
    // catálogo interpola {{ opt.label }} en su propia línea del template
    // Angular, así que su textContent real trae espacios/saltos de línea
    // alrededor ("\n  EPS\n  ") — el hasText de Playwright con RegExp
    // compara contra ese texto SIN recortar, así que un regex ^EPS$ estricto
    // nunca matchea; se permiten espacios opcionales alrededor con \s*.
    const planText = overrides?.planText
      ? await pickFirstSearchableSelectOption(this.page, form, 'Plan', {
          matchText: new RegExp(`^\\s*${escapeRegExp(overrides.planText)}\\s*$`, 'i'),
          searchText: overrides.planText,
          timeoutMs: 45_000,
        })
      : await pickFirstSearchableSelectOption(this.page, form, 'Plan');

    if (overrides?.agrupadoraText) {
      await pickFirstSearchableSelectOption(this.page, form, 'Agrupadora', {
        matchText: new RegExp(`^\\s*${escapeRegExp(overrides.agrupadoraText)}\\s*$`, 'i'),
        searchText: overrides.agrupadoraText,
        timeoutMs: 45_000,
      });
    } else {
      await pickFirstSearchableSelectOption(this.page, form, 'Agrupadora');
    }
    await pickFirstSearchableSelectOption(this.page, form, 'Asesor');

    // Sucursal y Descuento son opcionales en el formulario, pero se llenan
    // explícito (en vez de dejarlos vacíos) para que el afiliado de prueba
    // quede con datos completos, igual que un afiliado real.
    await pickFirstSearchableSelectOption(this.page, form, 'Sucursal', { timeoutMs: 45_000 });
    await form.locator('input[formcontrolname="discount"]').fill('0');

    // Campo obligatorio (select nativo formControlName="affiliateType"): aunque
    // visualmente ya muestra "Dependiente" como primera opción, el FormControl
    // arranca sin value hasta que se interactúa, así que sin este select
    // explícito el formulario queda inválido y el botón de submit no habilita.
    await form.locator('select[formcontrolname="affiliateType"]').selectOption('DEPENDIENTE');

    if (/ARL/i.test(planText)) {
      await form.locator('input[formcontrolname="profession"]').fill('Ingeniero de pruebas');
      await form.locator('input[formcontrolname="arl"]').fill('1');
    }
    // Mismo margen que Plan/Departamento/Municipio (45s): estos catálogos
    // también se cargan de forma asíncrona desde el backend al abrir la
    // sección, y el timeout por defecto (5s) ya demostró ser insuficiente
    // para catálogos async en este formulario (ver bug de "Plan"/"Género").
    if (/EPS/i.test(planText)) {
      await pickFirstSearchableSelectOption(this.page, form, 'EPS asignada', { timeoutMs: 45_000 });
    }
    if (/AFP/i.test(planText)) {
      await pickFirstSearchableSelectOption(this.page, form, 'AFP', { timeoutMs: 45_000 });
    }
    if (/CCF/i.test(planText)) {
      await pickFirstSearchableSelectOption(this.page, form, 'Caja de compensación', { timeoutMs: 45_000 });
    }

    const today = new Date().toISOString().slice(0, 10);
    await form.locator('input[formcontrolname="companyEntryDate"]').fill(today);

    if (overrides?.referralType !== undefined) {
      await form.locator('select[formcontrolname="referralType"]').selectOption(overrides.referralType);
    }

    // Opcional para casi todos los casos, obligatorio si la agrupadora
    // resultó ser de tipo "Gestión": se adjunta siempre para cubrir ambos
    // casos sin depender de qué agrupadora tocó al azar. Se usa un PDF real
    // del repo (no uno generado mínimo) porque el backend lo sube a Supabase
    // y algunos flujos posteriores esperan un archivo con contenido válido.
    await form.locator('input[type="file"]').setInputFiles(overrides?.documentFiles ?? [AFFILIATE_DOCUMENT_FIXTURE]);
  }

  async submit(): Promise<void> {
    await this.page.getByRole('button', { name: /Crear afiliado|Guardar cambios/ }).click();
  }

  /**
   * Igual que submit(), pero además captura la respuesta de POST /affiliates
   * y devuelve el affiliationId creado (necesario para armar un periodo de
   * facturación de prueba por API, ya que hoy no hay flujo de UI para
   * conciliar un pago y disparar esa creación automáticamente).
   */
  async submitAndGetId(): Promise<number> {
    const created = await this.submitAndGetCreated();
    return created.id;
  }

  /**
   * Igual que submitAndGetId(), pero también devuelve categoryId — la
   * clasificación ORDINARIO/NO ORDINARIO/RESOLUCION que el backend resolvió
   * a partir de birthDate/gender/documentType/plan (ver
   * AffiliateCategoryClassifierService). Necesario para crear un periodo de
   * facturación que coincida con la categoría real del afiliado, en vez de
   * forzar una categoría arbitraria por fuera de esa clasificación.
   */
  async submitAndGetCreated(): Promise<{ id: number; categoryId: number | null }> {
    const [response] = await Promise.all([
      this.page.waitForResponse((res) => res.url().includes('/affiliates') && res.request().method() === 'POST'),
      this.submit(),
    ]);
    const body = await response.json();
    return { id: body.id, categoryId: body.categoryId ?? null };
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

  /** Valor actual del select "Origen del afiliado" en el formulario abierto (crear o editar). */
  async getReferralTypeValue(): Promise<string> {
    return this.page.locator('form').locator('select[formcontrolname="referralType"]').inputValue();
  }

  /**
   * Abre el dropdown de acciones de una fila y clickea la acción pedida.
   * El menú de acciones se renderiza `fixed` fuera de la fila (ver
   * affiliates-list.html), así que el botón de la acción se busca a nivel
   * de página, no dentro del `row` — igual que openEditForRow().
   */
  async openRowAction(name: string, actionLabel: string | RegExp): Promise<void> {
    const row = this.rowByName(name);
    await row.locator('button[title="Acciones"]').click();
    await this.page.getByRole('button', { name: actionLabel }).click();
  }

  // ── Filtros ───────────────────────────────────────────────────────

  private get entryDateFromInput(): Locator {
    return this.page.locator('label:text("Ingreso desde")').locator('xpath=following-sibling::input[@type="date"]');
  }

  private get entryDateToInput(): Locator {
    return this.page.locator('label:text("Ingreso hasta")').locator('xpath=following-sibling::input[@type="date"]');
  }

  /** Filtra por rango de fecha de ingreso (formato YYYY-MM-DD). */
  async filterByEntryDateRange(from: string, to: string): Promise<void> {
    await this.entryDateFromInput.fill(from);
    await this.waitForTableLoaded();
    await this.entryDateToInput.fill(to);
    await this.waitForTableLoaded();
  }

  async clearEntryDateRangeFilter(): Promise<void> {
    await this.entryDateFromInput.fill('');
    await this.entryDateToInput.fill('');
    await this.waitForTableLoaded();
  }

  /** Filtra por estado de pago del mes: 'paid' | 'unpaid' | '' (Todos). */
  async filterByPaymentStatus(status: 'paid' | 'unpaid' | ''): Promise<void> {
    await this.page
      .locator('label:text("Pago del mes")')
      .locator('xpath=following-sibling::select')
      .selectOption(status);
    await this.waitForTableLoaded();
  }

  get emptyStateMessage(): Locator {
    return this.page.getByText('No se encontraron afiliados');
  }

  // ── Enviar correo (con observación) ──────────────────────────────

  async sendEmailForRow(name: string, observation?: string): Promise<void> {
    await this.openRowAction(name, 'Enviar correo');
    const modal = this.page.locator('.fixed.inset-0.z-50', { hasText: 'Enviar correo de afiliación' });
    await expect(modal.getByRole('heading', { name: 'Enviar correo de afiliación' })).toBeVisible();

    if (observation) {
      await modal.locator('textarea').fill(observation);
    }

    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => /\/affiliates\/\d+\/send-email/.test(res.url()) && res.request().method() === 'POST'
      ),
      modal.getByRole('button', { name: 'Enviar correo' }).click(),
    ]);
    expect(response.ok()).toBe(true);
  }

  // ── Documentos (múltiples) ───────────────────────────────────────

  private get documentsModal(): Locator {
    return this.page.locator('.fixed.inset-0.z-50', { hasText: 'Documentos' });
  }

  async openDocumentsForRow(name: string): Promise<void> {
    await this.openRowAction(name, /Ver documentos/);
    await expect(this.documentsModal.getByRole('heading', { name: 'Documentos' })).toBeVisible();
  }

  documentRows(): Locator {
    return this.documentsModal.locator('button[title="Descargar"]');
  }

  // ── Desactivar con razón ─────────────────────────────────────────

  async deactivateRowWithReason(name: string, reason: string): Promise<void> {
    await this.openRowAction(name, 'Desactivar');
    await expect(this.page.getByRole('heading', { name: 'Desactivar Afiliado' })).toBeVisible();

    await this.page.getByPlaceholder('Ej: No realizó el pago del mes').fill(reason);

    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => /\/affiliates\/\d+\/toggle/.test(res.url()) && res.request().method() === 'PATCH'
      ),
      this.page.getByRole('button', { name: /Sí, deshabilitar/ }).click(),
    ]);
    expect(response.ok()).toBe(true);
  }

  async expectRowDisabled(name: string): Promise<void> {
    await expect(this.rowByName(name).getByText('Deshabilitado')).toBeVisible();
  }
}
