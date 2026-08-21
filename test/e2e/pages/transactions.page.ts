import { Page, expect } from '@playwright/test';

export class TransactionsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/transacciones');
    await expect(this.page.getByRole('heading', { name: 'Transacciones' })).toBeVisible();
  }

  async expectListVisible(): Promise<void> {
    await expect(this.page.locator('table')).toBeVisible();
  }

  private get lockToggleButton() {
    return this.page.getByRole('button', { name: /Bloquear transacciones|Desbloquear transacciones/ });
  }

  private get newTransactionButton() {
    return this.page.getByRole('button', { name: 'Nueva transacción' });
  }

  /** true si el botón dice "Desbloquear..." (o sea, ya está bloqueado). */
  async isLocked(): Promise<boolean> {
    const text = await this.lockToggleButton.textContent();
    return /Desbloquear/.test(text ?? '');
  }

  /**
   * Alterna el bloqueo global de transacciones y espera a que el backend
   * confirme el nuevo estado (PATCH /transactions/lock) antes de continuar,
   * para no dejar el toggle "a medias" si el test sigue de largo.
   */
  async toggleLock(): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (res) => res.url().includes('/transactions/lock') && res.request().method() === 'PATCH'
      ),
      this.lockToggleButton.click(),
    ]);
  }

  async expectLocked(): Promise<void> {
    await expect(this.lockToggleButton).toHaveText(/Desbloquear transacciones/);
    await expect(this.newTransactionButton).toBeDisabled();
    // El texto "Transacciones bloqueadas:" aparece tanto en el banner de aviso
    // como en el toast de notificación (ambos con role="alert"), así que no
    // alcanza con filtrar por rol: se acota por la clase de fondo propia del
    // banner (bg-amber-100) para no violar el modo estricto con 2 matches.
    await expect(this.page.locator('[role="alert"].bg-amber-100')).toContainText('Transacciones bloqueadas:');
  }

  async expectUnlocked(): Promise<void> {
    await expect(this.lockToggleButton).toHaveText(/Bloquear transacciones/);
    await expect(this.newTransactionButton).toBeEnabled();
  }
}
