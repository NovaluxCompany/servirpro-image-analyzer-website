import { test } from '@playwright/test';
import { authStateFile } from '../fixtures/credentials';
import { TransactionsPage } from '../pages/transactions.page';

test.use({ storageState: authStateFile('Pago') });

test.describe('Transferencias', () => {
  test('el listado de transacciones carga correctamente', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.goto();
    await transactionsPage.expectListVisible();
  });
});
