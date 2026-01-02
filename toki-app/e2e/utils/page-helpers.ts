import { Page, Locator } from '@playwright/test';

/**
 * Helpers pour interagir avec les pages React Native Web
 */

/**
 * Attendre que la page soit complètement chargée
 */
export async function waitForPageLoad(page: Page, timeout = 30000): Promise<void> {
  // Attendre que le document soit prêt
  await page.waitForLoadState('domcontentloaded', { timeout });
  
  // Attendre que le réseau soit idle (pas de requêtes en cours)
  await page.waitForLoadState('networkidle', { timeout });
  
  // Attendre un peu pour que React finisse de rendre
  await page.waitForTimeout(1000);
}

/**
 * Cliquer sur un bouton par son texte
 */
export async function clickButtonByText(
  page: Page,
  text: string,
  options?: { timeout?: number; exact?: boolean }
): Promise<void> {
  const button = page.getByRole('button', { name: text, exact: options?.exact ?? false });
  await button.waitFor({ state: 'visible', timeout: options?.timeout ?? 30000 });
  await button.click();
}

/**
 * Remplir un input par son placeholder
 */
export async function fillInputByPlaceholder(
  page: Page,
  placeholder: string,
  value: string
): Promise<void> {
  const input = page.getByPlaceholder(placeholder);
  await input.waitFor({ state: 'visible', timeout: 30000 });
  await input.fill(value);
}

/**
 * Remplir un input par son label ou texte associé
 */
export async function fillInputByLabel(
  page: Page,
  label: string,
  value: string
): Promise<void> {
  // Chercher le label puis l'input associé
  const labelElement = page.getByText(label);
  const inputId = await labelElement.getAttribute('for');
  
  if (inputId) {
    await page.fill(`#${inputId}`, value);
  } else {
    // Fallback: chercher l'input près du label
    const input = page.locator(`input[placeholder*="${label}" i], input[aria-label*="${label}" i]`).first();
    await input.waitFor({ state: 'visible', timeout: 30000 });
    await input.fill(value);
  }
}

/**
 * Attendre la navigation vers une URL
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 30000
): Promise<void> {
  await page.waitForURL(urlPattern, { timeout, waitUntil: 'domcontentloaded' });
}

/**
 * Vérifier qu'un texte est présent sur la page
 */
export async function expectTextOnPage(page: Page, text: string): Promise<void> {
  const { expect } = await import('@playwright/test');
  const locator = page.getByText(text, { exact: false });
  await expect(locator).toBeVisible({ timeout: 10000 });
}

/**
 * Attendre qu'un élément soit visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout = 30000
): Promise<Locator> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  return element;
}

/**
 * Attendre qu'un élément avec texte soit visible
 */
export async function waitForText(
  page: Page,
  text: string,
  timeout = 30000
): Promise<Locator> {
  const element = page.getByText(text, { exact: false });
  await element.waitFor({ state: 'visible', timeout });
  return element;
}

/**
 * Cliquer sur un lien ou élément cliquable par texte
 */
export async function clickByText(
  page: Page,
  text: string,
  options?: { timeout?: number; exact?: boolean }
): Promise<void> {
  const element = page.getByText(text, { exact: options?.exact ?? false });
  await element.waitFor({ state: 'visible', timeout: options?.timeout ?? 30000 });
  await element.click();
}

/**
 * Attendre qu'un spinner/loader disparaisse
 */
export async function waitForLoadingToFinish(page: Page, timeout = 30000): Promise<void> {
  // Attendre que tous les ActivityIndicator/spinners disparaissent
  // En React Native Web, ils sont souvent des divs avec des classes spécifiques
  try {
    await page.waitForFunction(
      () => {
        // Chercher des éléments de chargement courants
        const loaders = document.querySelectorAll('[data-testid*="loading"], [class*="spinner"], [class*="loader"]');
        return loaders.length === 0;
      },
      { timeout }
    );
  } catch (e) {
    // Si on ne trouve pas de loader, continuer
    console.log('Aucun loader détecté, continuation...');
  }
  
  // Attendre que le réseau soit idle
  await page.waitForLoadState('networkidle', { timeout });
}
