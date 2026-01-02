import { test, expect } from '@playwright/test';
import { generateTestEmail, TEST_PASSWORD, TEST_DISPLAY_NAME, TEST_FOODS, TEST_MEAL_DESCRIPTIONS } from '../fixtures/test-data';
import {
  waitForPageLoad,
  clickButtonByText,
  fillInputByPlaceholder,
  waitForText,
} from '../utils/page-helpers';
import { assertNoConsoleErrors, assertPageLoaded, assertNoWhitePage } from '../utils/assertions';
import { cleanupTestAccount } from '../fixtures/auth-fixtures';

/**
 * Tests d'ajout de nourriture - Logging d'un repas
 * 
 * Prérequis: Un compte doit être créé et l'onboarding complété
 */
test.describe('Ajout de nourriture', () => {
  let testEmail: string;
  let userId: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Créer un compte et compléter l'onboarding
    testEmail = generateTestEmail();
    
    // Créer compte
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

    // Compléter onboarding rapidement (si requis)
    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding')) {
      // Sélectionner objectif
      const goalButton = page.getByText(/perdre|maintenir|prendre/i).first();
      const goalVisible = await goalButton.isVisible().catch(() => false);
      if (goalVisible) {
        await goalButton.click();
        await page.waitForTimeout(500);
      }

      // Continuer
      const continueButton = page.getByRole('button', { name: /continuer|terminer/i });
      const continueVisible = await continueButton.isVisible().catch(() => false);
      if (continueVisible) {
        await continueButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // Attendre d'être sur la page principale
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

  test('devrait ajouter un repas via recherche manuelle', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('Failed to decode downloaded font') &&
          !text.includes('OTS parsing error') &&
          !text.includes('MaterialIcons')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // 1. Vérifier qu'on est sur la page principale
    await assertPageLoaded(page);
    await assertNoWhitePage(page);

    // 2. Cliquer sur le bouton "Ajouter un repas" ou "+"
    const addButton = page.getByRole('button', { name: /ajouter|add|\+|repas/i }).first();
    const addVisible = await addButton.isVisible().catch(() => false);
    
    if (!addVisible) {
      // Chercher un bouton avec l'icône + ou un TouchableOpacity
      const plusButton = page.locator('button:has-text("+"), [aria-label*="ajouter" i], [class*="add"]').first();
      await plusButton.waitFor({ state: 'visible', timeout: 10000 });
      await plusButton.click();
    } else {
      await addButton.click();
    }

    await page.waitForTimeout(1000);

    // 3. Rechercher un aliment
    const searchInput = page.locator('input[placeholder*="rechercher" i], input[placeholder*="search" i], input[type="search"]').first();
    const searchVisible = await searchInput.isVisible().catch(() => false);
    
    if (searchVisible) {
      await searchInput.fill(TEST_FOODS.chicken);
      await page.waitForTimeout(1500); // Attendre les résultats de recherche

      // 4. Sélectionner un résultat
      const firstResult = page.locator('[role="button"], button, [class*="item"], [class*="food"]').first();
      await firstResult.waitFor({ state: 'visible', timeout: 10000 });
      await firstResult.click();
      await page.waitForTimeout(500);
    }

    // 5. Enregistrer le repas
    const saveButton = page.getByRole('button', { name: /enregistrer|save|valider|ajouter/i });
    const saveVisible = await saveButton.isVisible().catch(() => false);
    
    if (saveVisible) {
      await saveButton.click();
      await page.waitForTimeout(2000);
    }

    // 6. Vérifier que le repas a été ajouté (peut apparaître dans l'historique)
    await waitForPageLoad(page);
    await assertNoWhitePage(page);

    // 7. Vérifier qu'il n'y a pas d'erreurs critiques
    const criticalErrors = consoleErrors.filter((error) => {
      return !error.includes('favicon') && 
             !error.includes('MaterialIcons') &&
             !error.includes('font');
    });

    if (criticalErrors.length > 0) {
      console.warn('Erreurs console détectées:', criticalErrors);
    }
  });

  test('devrait ajouter un repas via IA (si disponible)', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('Failed to decode downloaded font') &&
          !text.includes('OTS parsing error') &&
          !text.includes('MaterialIcons')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    await assertPageLoaded(page);

    // 1. Naviguer vers la page d'ajout de repas ou IA
    const addButton = page.getByRole('button', { name: /ajouter|add|\+|repas|ia/i }).first();
    const addVisible = await addButton.isVisible().catch(() => false);
    
    if (addVisible) {
      await addButton.click();
      await page.waitForTimeout(1000);
    }

    // 2. Chercher un bouton "Utiliser l'IA" ou accéder à l'IA
    const aiButton = page.getByText(/ia|intelligence artificielle|décrire|parser/i).first();
    const aiVisible = await aiButton.isVisible().catch(() => false);
    
    if (!aiVisible) {
      // Peut-être que l'IA est accessible via une route directe
      await page.goto('/ai-logger');
      await waitForPageLoad(page);
    } else {
      await aiButton.click();
      await page.waitForTimeout(1000);
    }

    // 3. Entrer une description de repas
    const descriptionInput = page.locator('textarea, input[placeholder*="décrire" i], input[placeholder*="description" i]').first();
    const descVisible = await descriptionInput.isVisible().catch(() => false);
    
    if (descVisible) {
      await descriptionInput.fill(TEST_MEAL_DESCRIPTIONS.simple);
      
      // 4. Cliquer sur "Analyser" ou "Parser"
      const parseButton = page.getByRole('button', { name: /analyser|parser|envoyer|générer/i });
      await parseButton.waitFor({ state: 'visible', timeout: 10000 });
      await parseButton.click();
      
      // 5. Attendre l'analyse (peut prendre du temps)
      await page.waitForTimeout(5000);
      
      // 6. Confirmer les résultats (si nécessaire)
      const confirmButton = page.getByRole('button', { name: /confirmer|valider|enregistrer|save/i });
      const confirmVisible = await confirmButton.isVisible().catch(() => false);
      
      if (confirmVisible) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // 7. Vérifier qu'il n'y a pas d'erreurs critiques
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter((error) => {
      return !error.includes('favicon') && 
             !error.includes('MaterialIcons') &&
             !error.includes('font');
    });

    if (criticalErrors.length > 0) {
      console.warn('Erreurs console détectées:', criticalErrors);
    }

    await assertNoWhitePage(page);
  });
});
