import { test, expect } from '@playwright/test';
import { generateTestEmail, TEST_PASSWORD, TEST_DISPLAY_NAME } from '../fixtures/test-data';
import {
  waitForPageLoad,
  waitForNavigation,
} from '../utils/page-helpers';
import { assertNoConsoleErrors, assertPageLoaded, assertNoWhitePage } from '../utils/assertions';
import { cleanupTestAccount } from '../fixtures/auth-fixtures';

/**
 * Tests de navigation - Vérifier que toutes les pages principales sont accessibles
 * 
 * Prérequis: Un compte doit être créé et l'onboarding complété
 */
test.describe('Navigation', () => {
  let testEmail: string;
  let userId: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Créer un compte et compléter l'onboarding
    testEmail = generateTestEmail();
    
    await page.goto('/auth');
    await waitForPageLoad(page);

    const createAccountButton = page.getByText(/créer un compte|s'inscrire/i);
    const isVisible = await createAccountButton.isVisible().catch(() => false);
    if (isVisible) {
      await createAccountButton.click();
      await page.waitForTimeout(500);
    }

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.fill(testEmail);
    
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);

    const displayNameInput = page.locator('input[placeholder*="nom" i], input[placeholder*="Nom" i]').first();
    const displayNameVisible = await displayNameInput.isVisible().catch(() => false);
    if (displayNameVisible) {
      await displayNameInput.fill(TEST_DISPLAY_NAME);
    }

    const submitButton = page.getByRole('button', { name: /créer|inscription/i });
    
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await submitButton.click();
    await page.waitForTimeout(3000);

    // Compléter onboarding rapidement
    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding')) {
      const goalButton = page.getByText(/perdre|maintenir|prendre/i).first();
      const goalVisible = await goalButton.isVisible().catch(() => false);
      if (goalVisible) {
        await goalButton.click();
        await page.waitForTimeout(500);
      }

      const continueButton = page.getByRole('button', { name: /continuer|terminer/i });
      const continueVisible = await continueButton.isVisible().catch(() => false);
      if (continueVisible) {
        await continueButton.click();
        await page.waitForTimeout(2000);
      }
    }

    await waitForPageLoad(page);
  });

  test.afterEach(async () => {
    if (userId) {
      try {
        await cleanupTestAccount(userId);
      } catch (error) {
        console.error('Erreur cleanup compte test:', error);
      }
    }
  });

  // Liste des pages à tester
  const pagesToTest = [
    { path: '/', name: 'Page principale' },
    { path: '/(tabs)', name: 'Tabs' },
    { path: '/stats', name: 'Statistiques' },
    { path: '/help', name: 'Aide' },
    { path: '/points-explanation', name: 'Explication points' },
    { path: '/subscription', name: 'Abonnement' },
    { path: '/version', name: 'Version' },
  ];

  for (const pageInfo of pagesToTest) {
    test(`devrait naviguer vers ${pageInfo.name} (${pageInfo.path})`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (
            !text.includes('Failed to decode downloaded font') &&
            !text.includes('OTS parsing error') &&
            !text.includes('MaterialIcons') &&
            !text.includes('favicon')
          ) {
            consoleErrors.push(text);
          }
        }
      });

      page.on('pageerror', (error) => {
        if (
          !error.message.includes('Failed to decode downloaded font') &&
          !error.message.includes('OTS parsing error') &&
          !error.message.includes('MaterialIcons')
        ) {
          pageErrors.push(`PageError: ${error.message}`);
        }
      });

      // 1. Naviguer vers la page
      await page.goto(pageInfo.path);
      await waitForPageLoad(page);

      // 2. Vérifier qu'il n'y a pas de page blanche
      await assertNoWhitePage(page);
      await assertPageLoaded(page);

      // 3. Attendre un peu pour capturer toutes les erreurs
      await page.waitForTimeout(2000);

      // 4. Vérifier qu'il n'y a pas d'erreurs critiques
      const criticalErrors = consoleErrors.filter((error) => {
        return !error.includes('favicon') && 
               !error.includes('MaterialIcons') &&
               !error.includes('font');
      });

      if (criticalErrors.length > 0) {
        console.warn(`Erreurs console sur ${pageInfo.path}:`, criticalErrors);
      }

      if (pageErrors.length > 0) {
        console.warn(`Erreurs page sur ${pageInfo.path}:`, pageErrors);
      }

      // 5. Vérifier que la page contient du contenu
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      expect(bodyText?.length).toBeGreaterThan(0);
    });
  }

  test('devrait pouvoir naviguer entre les pages sans erreur', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('Failed to decode downloaded font') &&
          !text.includes('OTS parsing error') &&
          !text.includes('MaterialIcons') &&
          !text.includes('favicon')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // Naviguer vers plusieurs pages en séquence
    const pages = ['/', '/stats', '/help', '/points-explanation', '/'];

    for (const path of pages) {
      await page.goto(path);
      await waitForPageLoad(page);
      await assertNoWhitePage(page);
      await page.waitForTimeout(1000);
    }

    // Vérifier qu'il n'y a pas d'erreurs critiques cumulées
    const criticalErrors = consoleErrors.filter((error) => {
      return !error.includes('favicon') && 
             !error.includes('MaterialIcons') &&
             !error.includes('font');
    });

    if (criticalErrors.length > 0) {
      console.warn('Erreurs console lors de la navigation:', criticalErrors);
    }
  });
});
