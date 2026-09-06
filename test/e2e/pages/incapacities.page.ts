import { Page, Locator, expect } from '@playwright/test';
import { API_URL } from '../utils/api-url';

export type IncapacityRoute = 'GESTION' | 'CYA';

export interface RouteMapping {
  id: number;
  grouperId: number;
  route: IncapacityRoute;
  active: boolean;
  grouper?: { id: number; name: string };
}

export interface SafeAffiliate {
  /** id de la afiliación: es lo que el modal manda como affiliationId. */
  id: number;
  fullName: string;
  documentNumber: string;
  grouperId: number;
  grouperName: string;
}

/** Tipos de soporte, con el label visible de cada slot del formulario. */
export const DOCUMENT_LABELS = {
  INCAPACIDAD: 'Incapacidad',
  CERT_BANCARIO: 'Certificado bancario',
  HISTORIA_CLINICA: 'Historia clínica',
  AUTORIZACION_PAGO_TERCERO: 'Autorización de pago a terceros',
  RIPS: 'RIPS',
} as const;

export type DocumentType = keyof typeof DOCUMENT_LABELS;

/** dd/MM/yyyy, el formato con el que el listado y el histórico pintan las fechas. */
export function toDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.substring(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().substring(0, 10);
}

export class IncapacitiesPage {
  constructor(private readonly page: Page) {}

  // ── Navegación ────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto('/incapacidades');
    await expect(this.page.getByRole('heading', { name: 'Incapacidades' })).toBeVisible();
    await this.waitForTableLoaded();
  }

  /** El listado no tiene skeleton: la señal de "cargó" es que el texto de carga desaparece. */
  async waitForTableLoaded(timeoutMs = 20_000): Promise<void> {
    await expect(this.page.getByText('Cargando incapacidades...')).toBeHidden({ timeout: timeoutMs });
  }

  // ── API (solo para preparar/verificar, nunca para reemplazar el flujo de UI) ──

  private async token(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem('token'));
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.token();
    return { Authorization: `Bearer ${token}` };
  }

  /** Mapa agrupadora → destino (GESTION | CYA). Es la fuente del guardarraíl de correos. */
  async getRouteMapping(): Promise<RouteMapping[]> {
    const res = await this.page.request.get(`${API_URL}/incapacities/routes/mapping`, {
      headers: await this.authHeaders(),
    });
    expect(res.ok(), `No se pudo leer el mapa de enrutamiento: ${res.status()} ${await res.text()}`).toBe(
      true,
    );
    return res.json();
  }

  async listIncapacities(query = 'page=1&limit=50'): Promise<any[]> {
    const res = await this.page.request.get(`${API_URL}/incapacities?${query}`, {
      headers: await this.authHeaders(),
    });
    if (!res.ok()) return [];
    const body = await res.json();
    return body.items ?? [];
  }

  async getIncapacity(id: number): Promise<any | null> {
    const res = await this.page.request.get(`${API_URL}/incapacities/${id}`, {
      headers: await this.authHeaders(),
      failOnStatusCode: false,
    });
    return res.ok() ? res.json() : null;
  }

  /**
   * Primer afiliado activo cuya agrupadora NO enruta a Gestión.
   *
   * GUARDARRAÍL: aprobar una incapacidad enrutada a Gestión dispara un correo
   * real por n8n, y el suite no debe mandarle correo a nadie. El filtro es
   * FAIL-CLOSED a propósito: un afiliado cuyo grouperId no se puede resolver
   * se descarta en vez de asumir que es seguro — un `undefined` convertido a
   * NaN pasaría cualquier comparación y terminaría enviando el correo.
   */
  async findAffiliateSafeToApprove(): Promise<SafeAffiliate | null> {
    const headers = await this.authHeaders();
    const mapping = await this.getRouteMapping();
    const gestionGrouperIds = new Set(
      mapping.filter((m) => m.active && m.route === 'GESTION').map((m) => Number(m.grouperId)),
    );

    const res = await this.page.request.get(`${API_URL}/affiliates?page=1&limit=100&isActive=true`, {
      headers,
    });
    if (!res.ok()) return null;

    const body = await res.json();
    // El listado de afiliados responde { data: [...] }; se acepta items por si cambia.
    const items: any[] = body.data ?? body.items ?? [];

    const candidate = items.find((item) => {
      const grouperId = Number(item.grouperId);
      if (!item.id || !item.fullName || !item.documentNumber) return false;
      if (!Number.isFinite(grouperId)) return false; // fail-closed
      return !gestionGrouperIds.has(grouperId);
    });

    if (!candidate) return null;
    return {
      id: Number(candidate.id),
      fullName: String(candidate.fullName),
      documentNumber: String(candidate.documentNumber),
      grouperId: Number(candidate.grouperId),
      grouperName: String(candidate.grouperName ?? ''),
    };
  }

  // ── Modal "Enviar a incapacidades" (se abre desde la ficha del afiliado) ──

  get formModal(): Locator {
    return this.page.locator('.fixed.inset-0.z-50').filter({ hasText: 'Enviar a incapacidades' });
  }

  get historyTable(): Locator {
    return this.formModal.locator('table').first();
  }

  /**
   * Señal de que el histórico terminó de cargar, sin asumir cuál de los dos
   * estados salió: con incapacidades previas se pinta la tabla; sin ellas NO
   * se pinta (queda solo el aviso). Cuál toca depende del afiliado que el
   * ambiente haya elegido, así que el test no puede exigir uno.
   */
  historyLoaded(scope: Locator): Locator {
    return scope
      .locator('table thead')
      .or(scope.getByText('Este afiliado no tiene incapacidades registradas.'))
      .first();
  }

  /** Campo editable de días. Se autocompleta con el rango de fechas. */
  get daysInput(): Locator {
    return this.formModal.locator('#days');
  }

  /**
   * Busca un diagnóstico CIE-10 y elige el primer resultado. Devuelve la
   * etiqueta elegida, o null si el ambiente no tiene la tabla cargada.
   *
   * El select trabaja contra el servidor: escribe, espera el GET /cie10 y solo
   * entonces hay opciones. El diagnóstico es opcional en el formulario, así que
   * un ambiente sin CIE-10 no debe tumbar el flujo de registro — devuelve null
   * y el test sigue sin diagnóstico.
   */
  async pickDiagnosis(query: string): Promise<string | null> {
    // El <app-searchable-select> abre su panel en document.body, no dentro del modal.
    await this.formModal.getByPlaceholder('Buscar por código o descripción...').click();

    const panel = this.page.locator('.ss-dropdown-panel');
    const searchBox = panel.getByPlaceholder('Buscar...');
    await expect(searchBox).toBeVisible();

    const [response] = await Promise.all([
      this.page
        .waitForResponse(
          (res) => res.url().includes('/cie10') && res.request().method() === 'GET',
          { timeout: 10_000 },
        )
        .catch(() => null),
      searchBox.fill(query),
    ]);

    if (!response?.ok()) {
      await this.page.keyboard.press('Escape');
      return null;
    }

    const options = panel.locator('li');
    const first = options.first();
    // "Sin resultados" / "Escribe al menos N caracteres" también son <li>.
    const label = (await first.textContent())?.trim() ?? '';
    if (/^(Sin resultados|Escribe al menos|Buscando)/.test(label)) {
      await this.page.keyboard.press('Escape');
      return null;
    }

    await first.click();
    return label;
  }

  /**
   * El input de archivo de un tipo de soporte.
   *
   * Se ubica por id (`#file-INCAPACIDAD`) y no por las clases del recuadro:
   * las clases cambian con el rediseño y con el estado (vacío / adjunto /
   * error / arrastrando), el id no. El input está oculto (`sr-only`) porque
   * el área clickeable es su <label>, pero setInputFiles funciona igual
   * sobre un input oculto.
   */
  fileInput(type: DocumentType): Locator {
    return this.formModal.locator(`#file-${type}`);
  }

  /** Tarjeta del soporte, para verificar su estado visual. */
  documentSlot(type: DocumentType): Locator {
    return this.formModal.locator(`#file-${type}`).locator('xpath=..');
  }

  async fillDates(startDate: string, endDate: string): Promise<void> {
    await this.formModal.locator('#startDate').fill(startDate);
    await this.formModal.locator('#endDate').fill(endDate);
  }

  /**
   * Elige la primera opción real de un catálogo parametrizado (origen /
   * entidad que responde) y devuelve su label.
   *
   * El value es el id de incapacity_origins / incapacity_entity_types, que
   * depende del orden del seed y NO es fijo: quemar un id o un code en el
   * test lo rompe en cuanto el catálogo cambie. Se elige por posición y se
   * espera a que el catálogo llegue — hasta entonces el único <option> es el
   * placeholder "Cargando...".
   */
  async selectFirstCatalogOption(field: 'originId' | 'entityTypeId'): Promise<string> {
    const select = this.formModal.locator(`#${field}`);
    await expect
      .poll(() => select.locator('option').count(), {
        message: `El catálogo de ${field} no cargó ninguna opción.`,
        timeout: 15_000,
      })
      .toBeGreaterThan(1);

    const option = select.locator('option').nth(1);
    await select.selectOption(await option.getAttribute('value') ?? '');
    return (await option.textContent())?.trim() ?? '';
  }

  async attach(type: DocumentType, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.fileInput(type).setInputFiles(file);
  }

  get submitFormButton(): Locator {
    return this.formModal.getByRole('button', { name: 'Registrar incapacidad' });
  }

  get cancelFormButton(): Locator {
    return this.formModal.getByRole('button', { name: 'Cancelar' });
  }

  /**
   * Registra y devuelve la incapacidad creada, leída de la respuesta del POST.
   * Devolver el id evita tener que adivinar cuál fila del listado es la nueva.
   */
  async submitForm(): Promise<{ id: number; routedTo: string | null }> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => res.url().split('?')[0].endsWith('/incapacities') && res.request().method() === 'POST',
      ),
      this.submitFormButton.click(),
    ]);
    expect(response.status(), `POST /incapacities falló: ${await response.text()}`).toBe(201);
    const body = await response.json();
    return { id: Number(body.id), routedTo: body.routedTo ?? null };
  }

  // ── Listado ───────────────────────────────────────────────────────

  rows(): Locator {
    return this.page.locator('tbody tr');
  }

  /**
   * Fila del listado de una incapacidad concreta.
   *
   * El listado no pinta el id, así que se identifica por documento del
   * afiliado + fecha de inicio: dos incapacidades del mismo afiliado que
   * empiecen el mismo día serían indistinguibles para el usuario también.
   */
  rowFor(documentNumber: string, startDateIso: string): Locator {
    return this.rows()
      .filter({ hasText: documentNumber })
      .filter({ hasText: toDisplayDate(startDateIso) })
      .first();
  }

  /**
   * Recorre las páginas del listado hasta encontrar la fila. El backend no
   * garantiza que lo recién creado quede en la primera página.
   */
  async findRowAcrossPages(documentNumber: string, startDateIso: string, maxPages = 25): Promise<Locator> {
    for (let visited = 0; visited < maxPages; visited++) {
      const row = this.rowFor(documentNumber, startDateIso);
      if (await row.count()) return row;

      const next = this.page.getByRole('button', { name: 'Siguiente' });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
      await this.waitForTableLoaded();
    }
    throw new Error(
      `No se encontró la incapacidad del documento ${documentNumber} con inicio ${toDisplayDate(startDateIso)} en el listado.`,
    );
  }

  // ── Filtros ───────────────────────────────────────────────────────

  /** Filtra y devuelve la URL del GET que disparó el filtro (para verificar los query params). */
  async applyFilter(
    field: 'servirproStatus' | 'thirdPartyStatus' | 'routeFilter' | 'pilaFilter',
    value: string,
  ): Promise<string> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => res.url().includes('/incapacities?') && res.request().method() === 'GET',
      ),
      this.page.locator(`#${field}`).selectOption(value),
    ]);
    await this.waitForTableLoaded();
    return response.url();
  }

  // ── Modal de estado ───────────────────────────────────────────────

  statusModal(scope: 'SERVIRPRO' | 'TERCERO'): Locator {
    const title = scope === 'SERVIRPRO' ? 'Estado Servirpro' : 'Estado del tercero';
    return this.page.locator('.fixed.inset-0.z-50').filter({ hasText: title });
  }

  async openStatusModal(row: Locator, scope: 'SERVIRPRO' | 'TERCERO'): Promise<Locator> {
    await row.getByRole('button', { name: scope === 'SERVIRPRO' ? 'Servirpro' : 'Tercero' }).click();
    const modal = this.statusModal(scope);
    await expect(modal).toBeVisible();
    return modal;
  }

  /**
   * Aprueba del lado Servirpro y devuelve la incapacidad actualizada que
   * responde el PATCH (trae routedTo y el estado del tercero ya movido).
   */
  async approveServirpro(row: Locator, observation = 'Aprobado por prueba automatizada'): Promise<any> {
    const modal = await this.openStatusModal(row, 'SERVIRPRO');
    await modal.getByRole('radio', { name: 'Aprobado' }).check();
    await modal.locator('#observation').fill(observation);

    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) =>
          /\/incapacities\/\d+\/servirpro-status$/.test(res.url()) && res.request().method() === 'PATCH',
      ),
      modal.getByRole('button', { name: 'Guardar' }).click(),
    ]);
    expect(response.ok(), `PATCH servirpro-status falló: ${await response.text()}`).toBe(true);
    await expect(modal).toBeHidden();
    await this.waitForTableLoaded();
    return response.json();
  }

  // ── Soportes ──────────────────────────────────────────────────────

  /** Pide la URL firmada de un soporte sin pasar por la UI (para probar el 403 de historia clínica). */
  async requestDocumentUrl(incapacityId: number, documentId: number) {
    return this.page.request.get(
      `${API_URL}/incapacities/${incapacityId}/documents/${documentId}/url`,
      { headers: await this.authHeaders(), failOnStatusCode: false },
    );
  }

  /** Primera incapacidad del ambiente que tenga un soporte del tipo pedido. */
  async findDocumentOfType(type: DocumentType): Promise<{ incapacityId: number; documentId: number } | null> {
    for (const incapacity of await this.listIncapacities()) {
      const document = (incapacity.documents ?? []).find((d: any) => d.documentType === type);
      if (document) return { incapacityId: Number(incapacity.id), documentId: Number(document.id) };
    }
    return null;
  }

  // ── Toasts ────────────────────────────────────────────────────────

  toast(message: string | RegExp): Locator {
    return this.page.getByRole('alert').filter({ hasText: message });
  }
}
