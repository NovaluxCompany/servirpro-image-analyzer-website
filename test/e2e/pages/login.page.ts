import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.page.fill('#email', email);
    await this.page.fill('#password', password);
    await this.page.getByRole('button', { name: 'Iniciar Sesión' }).click();
  }

  async expectLoggedIn(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
  }

  async expectError(message?: string | RegExp): Promise<void> {
    const alert = this.page.locator('text=Error de autenticación');
    await expect(alert).toBeVisible();
    if (message) {
      await expect(this.page.locator('.text-red-700').last()).toHaveText(message);
    }
  }
}
