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
}
