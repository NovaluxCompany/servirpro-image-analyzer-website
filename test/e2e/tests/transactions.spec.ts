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

test.describe('Bloqueo de transacciones (Administrador)', () => {
  test.use({ storageState: authStateFile('Administrador') });

  /**
   * IMPORTANTE: el bloqueo es GLOBAL (afecta a todos los usuarios del
   * ambiente, no solo a esta sesión). El test siempre deja el sistema en el
   * mismo estado en que lo encontró (try/finally), incluso si una aserción
   * falla a mitad de camino.
   */
  test('el Administrador puede bloquear y desbloquear la creación de transacciones', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page);
    await transactionsPage.goto();

    const wasLocked = await transactionsPage.isLocked();

    try {
      if (!wasLocked) {
        await transactionsPage.toggleLock();
        await transactionsPage.expectLocked();

        await transactionsPage.toggleLock();
        await transactionsPage.expectUnlocked();
      } else {
        // Ya estaba bloqueado por otra causa externa: solo se prueba el
        // camino de desbloqueo y se vuelve a dejar bloqueado como estaba.
        await transactionsPage.toggleLock();
        await transactionsPage.expectUnlocked();

        await transactionsPage.toggleLock();
        await transactionsPage.expectLocked();
      }
    } finally {
      const isLockedNow = await transactionsPage.isLocked();
      if (isLockedNow !== wasLocked) {
        await transactionsPage.toggleLock();
      }
    }
  });
});
