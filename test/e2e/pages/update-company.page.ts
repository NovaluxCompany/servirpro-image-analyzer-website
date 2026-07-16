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

  async expectValidFile(expectedRows: number): Promise<void> {
    await expect(
      this.page.getByText(new RegExp(`Se actualizará la empresa de ${expectedRows}`))
    ).toBeVisible({ timeout: 20_000 });
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
