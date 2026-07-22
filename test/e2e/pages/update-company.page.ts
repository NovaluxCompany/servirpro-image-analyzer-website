import { Page, expect } from '@playwright/test';

export class UpdateCompanyPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/actualizar-compania');
    await expect(this.page.getByRole('heading', { name: 'Actualizar Empresa' })).toBeVisible();
  }

  /** Descarga la plantilla real (headers garantizados iguales a los que exige el backend). */
  async downloadTemplate(destPath: string): Promise<string> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.getByRole('button', { name: 'Descargar plantilla' }).click(),
    ]);
    await download.saveAs(destPath);
    return destPath;
  }

  /** Sube el .xlsx generado por fillUpdateCompanyTemplate() (1-2 filas, nunca un archivo masivo real). */
  async uploadFile(filePath: string): Promise<void> {
    await this.page.locator('input[type="file"]').setInputFiles(filePath);
  }

  /**
   * Regla de negocio: el módulo solo permite subir archivos entre el día
   * `minDay` y `maxDay` de cada mes (ver update-company-list.html). Fuera de
   * esa ventana el input de archivo ni siquiera se renderiza. Los tests que
   * necesitan subir un archivo deben llamar a esto tras goto() y, si la
   * ventana está cerrada, verificar expectBlockedByDateWindow() en vez de
   * saltarse — así siempre se valida el comportamiento real del día actual.
   */
  async isWithinAllowedWindow(): Promise<boolean> {
    // El contexto (minDay/maxDay) llega async; hasta que carga, isDateAllowed()
    // puede mostrar transitoriamente el input de archivo por defecto. Hay que
    // esperar a que el estado se asiente (banner de bloqueo O input estable)
    // antes de decidir, no quedarse con el primer estado que aparezca.
    const blocked = this.page.getByText('Módulo no disponible en esta fecha');
    const fileInput = this.page.locator('input[type="file"]');
    await expect(blocked.or(fileInput)).toBeAttached({ timeout: 15_000 });
    await this.page.waitForTimeout(500); // deja asentar el estado tras la carga del contexto
    return (await fileInput.count()) > 0 && (await blocked.count()) === 0;
  }

  /** Confirma el estado "bloqueado por fecha" (alternativa a subir archivo cuando la ventana está cerrada). */
  async expectBlockedByDateWindow(): Promise<void> {
    await expect(this.page.getByText('Módulo no disponible en esta fecha')).toBeVisible();
    await expect(this.page.locator('input[type="file"]')).toHaveCount(0);
  }

  async expectValidFile(expectedRows: number): Promise<void> {
    await expect(
      this.page.getByText(new RegExp(`Se actualizará la empresa de ${expectedRows}`))
    ).toBeVisible({ timeout: 20_000 });
  }

  /**
   * Verifica que el backend rechazó el archivo por contenido inválido (ej.
   * una columna con el nombre mal escrito) y que el flujo no avanza.
   */
  async expectInvalidFile(errorDetailText?: string | RegExp): Promise<void> {
    await expect(
      this.page.getByText('El archivo contiene errores y no será procesado:')
    ).toBeVisible({ timeout: 20_000 });

    if (errorDetailText) {
      await expect(this.page.getByText(errorDetailText)).toBeVisible();
    }

    await expect(this.page.getByRole('button', { name: 'Procesar actualización' })).toHaveCount(0);
  }

  async processUpdate(): Promise<void> {
    await this.page.getByRole('button', { name: 'Procesar actualización' }).click();
    await expect(this.page.getByRole('heading', { name: 'Confirmar actualización' })).toBeVisible();
    await this.page.getByRole('button', { name: 'Sí, continuar' }).click();
  }

  async expectExecutionResult(): Promise<void> {
    await expect(this.page.getByText('Resultado del procesamiento')).toBeVisible({
      timeout: 30_000,
    });
  }
}
