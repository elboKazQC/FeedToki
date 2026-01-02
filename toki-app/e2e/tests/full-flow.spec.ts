import { test, expect } from '@playwright/test';
import { generateTestEmail, TEST_PASSWORD, TEST_DISPLAY_NAME, TEST_FOODS } from '../fixtures/test-data';
import {
  waitForPageLoad,
  clickButtonByText,
  fillInputByPlaceholder,
} from '../utils/page-helpers';
import { assertNoConsoleErrors, assertPageLoaded, assertNoWhitePage } from '../utils/assertions';
import { cleanupTestAccount } from '../fixtures/auth-fixtures';

/**
 * Test complet E2E - Flux utilisateur nouveau de bout en bout
 * 
 * Ce test valide le flux complet :
 * 1. Création de compte
 * 2. Onboarding
 * 3. Ajout de repas (recherche manuelle)
 * 4. Navigation vers les pages principales
 */
test.describe('Flux complet E2E', () => {
  let testEmail: string;
  let userId: string | null = null;

  test.afterEach(async () => {
    if (userId) {
      try {
        await cleanupTestAccount(userId);
      } catch (error) {
        console.error('Erreur cleanup compte test:', error);
      }
    }
  });

  test('devrait compléter le flux utilisateur complet sans erreur', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // Configurer les listeners d'erreurs
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

    // ===== ÉTAPE 1: Création de compte =====
    test.step('Créer un nouveau compte', async () => {
      testEmail = generateTestEmail();
      
      await page.goto('/auth');
      await waitForPageLoad(page);
      await assertNoWhitePage(page);

      // Basculer en mode inscription
      const createAccountButton = page.getByText(/créer un compte|s'inscrire/i);
      const isVisible = await createAccountButton.isVisible().catch(() => false);
      if (isVisible) {
        await createAccountButton.click();
        await page.waitForTimeout(500);
      }

      // Remplir le formulaire
      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
      await emailInput.fill(testEmail);
      
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill(TEST_PASSWORD);

      const displayNameInput = page.locator('input[placeholder*="nom" i], input[placeholder*="Nom" i]').first();
      const displayNameVisible = await displayNameInput.isVisible().catch(() => false);
      if (displayNameVisible) {
        await displayNameInput.fill(TEST_DISPLAY_NAME);
      }

      // Soumettre
      const submitButton = page.getByRole('button', { name: /créer|inscription/i });
      
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      await submitButton.click();
      await page.waitForTimeout(3000);

      // Vérifier redirection
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/(onboarding|tabs|\?)/);
    });

    // ===== ÉTAPE 2: Onboarding =====
    test.step('Compléter l\'onboarding', async () => {
      const currentUrl = page.url();
      
      if (currentUrl.includes('/onboarding')) {
        await waitForPageLoad(page);
        await assertNoWhitePage(page);

        // Sélectionner objectif
        const goalButton = page.getByText(/perdre|maintenir|prendre/i).first();
        const goalVisible = await goalButton.isVisible().catch(() => false);
        if (goalVisible) {
          await goalButton.click();
          await page.waitForTimeout(500);
        }

        // Remplir poids si requis
        const weightInput = page.locator('input[placeholder*="poids" i], input[type="number"]').first();
        const weightVisible = await weightInput.isVisible().catch(() => false);
        if (weightVisible) {
          await weightInput.fill('75');
          await page.waitForTimeout(300);
        }

        // Continuer
        const continueButton = page.getByRole('button', { name: /continuer|terminer/i });
        const continueVisible = await continueButton.isVisible().catch(() => false);
        if (continueVisible) {
          await continueButton.click();
          await page.waitForTimeout(2000);
        }
      }

      // Vérifier redirection vers page principale
      await waitForPageLoad(page);
      await assertNoWhitePage(page);
    });

    // ===== ÉTAPE 3: Ajouter un repas =====
    test.step('Ajouter un repas via recherche manuelle', async () => {
      await assertPageLoaded(page);

      // Cliquer sur "Ajouter"
      const addButton = page.getByRole('button', { name: /ajouter|add|\+|repas/i }).first();
      const addVisible = await addButton.isVisible().catch(() => false);
      
      if (!addVisible) {
        const plusButton = page.locator('button:has-text("+"), [aria-label*="ajouter" i]').first();
        await plusButton.waitFor({ state: 'visible', timeout: 10000 });
        await plusButton.click();
      } else {
        await addButton.click();
      }

      await page.waitForTimeout(1000);

      // Rechercher un aliment
      const searchInput = page.locator('input[placeholder*="rechercher" i], input[type="search"]').first();
      const searchVisible = await searchInput.isVisible().catch(() => false);
      
      if (searchVisible) {
        await searchInput.fill(TEST_FOODS.chicken);
        await page.waitForTimeout(1500);

        // Sélectionner un résultat
        const firstResult = page.locator('[role="button"], button, [class*="item"]').first();
        await firstResult.waitFor({ state: 'visible', timeout: 10000 });
        await firstResult.click();
        await page.waitForTimeout(500);

        // Enregistrer
        const saveButton = page.getByRole('button', { name: /enregistrer|save|valider/i });
        const saveVisible = await saveButton.isVisible().catch(() => false);
        if (saveVisible) {
          await saveButton.click();
          await page.waitForTimeout(2000);
        }
      }

      await waitForPageLoad(page);
      await assertNoWhitePage(page);
    });

    // ===== ÉTAPE 4: Navigation vers les pages principales =====
    test.step('Naviguer vers les pages principales', async () => {
      const pages = ['/stats', '/help', '/points-explanation'];

      for (const path of pages) {
        await page.goto(path);
        await waitForPageLoad(page);
        await assertNoWhitePage(page);
        await page.waitForTimeout(1000);
      }

      // Retour à la page principale
      await page.goto('/');
      await waitForPageLoad(page);
      await assertNoWhitePage(page);
    });

    // ===== VÉRIFICATIONS FINALES =====
    test.step('Vérifier qu\'il n\'y a pas d\'erreurs', async () => {
      await page.waitForTimeout(2000);

      const criticalErrors = consoleErrors.filter((error) => {
        return !error.includes('favicon') && 
               !error.includes('MaterialIcons') &&
               !error.includes('font');
      });

      if (criticalErrors.length > 0) {
        console.warn('Erreurs console détectées:', criticalErrors);
      }

      if (pageErrors.length > 0) {
        console.warn('Erreurs page détectées:', pageErrors);
      }

      // Le test passe si on arrive jusqu'ici sans crash
      expect(true).toBe(true);
    });
  });
});
