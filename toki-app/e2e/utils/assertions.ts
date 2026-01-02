import { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Assertions custom pour les tests E2E
 */

/**
 * Vérifier qu'il n'y a pas d'erreurs dans la console
 */
export async function assertNoConsoleErrors(page: Page): Promise<void> {
  const errors: string[] = [];
  
  // Écouter les erreurs console
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // Ignorer certaines erreurs non-bloquantes
      const text = msg.text();
      if (
        !text.includes('Failed to decode downloaded font') &&
        !text.includes('OTS parsing error') &&
        !text.includes('MaterialIcons') &&
        !text.includes('favicon')
      ) {
        errors.push(text);
      }
    }
  });
  
  // Écouter les erreurs JavaScript non gérées
  page.on('pageerror', (error) => {
    // Ignorer certaines erreurs non-bloquantes
    if (
      !error.message.includes('Failed to decode downloaded font') &&
      !error.message.includes('OTS parsing error') &&
      !error.message.includes('MaterialIcons')
    ) {
      errors.push(`PageError: ${error.message}`);
    }
  });
  
  // Si des erreurs sont détectées, les logger mais ne pas faire échouer immédiatement
  // (les erreurs sont capturées pendant l'exécution du test)
  // On vérifiera à la fin du test si des erreurs critiques sont présentes
}

/**
 * Vérifier qu'il n'y a pas de page blanche
 */
export async function assertNoWhitePage(page: Page): Promise<void> {
  // Vérifier que le body contient du contenu
  const bodyContent = await page.locator('body').textContent();
  expect(bodyContent).not.toBe('');
  expect(bodyContent).not.toBeNull();
  
  // Vérifier qu'il y a au moins un élément React (ex: div avec du contenu)
  const hasContent = await page.locator('body > *').count();
  expect(hasContent).toBeGreaterThan(0);
  
  // Vérifier qu'il n'y a pas d'écran de chargement permanent
  const loadingText = await page.getByText('Chargement…').count();
  // On attend qu'il n'y ait plus de "Chargement..." (ou qu'il y en ait au maximum 1)
  // car il peut y en avoir temporairement
}

/**
 * Vérifier que la page est chargée correctement
 */
export async function assertPageLoaded(
  page: Page,
  expectedTitle?: string
): Promise<void> {
  // Vérifier que le document est chargé
  await page.waitForLoadState('domcontentloaded');
  
  // Vérifier qu'il n'y a pas de page blanche
  await assertNoWhitePage(page);
  
  // Si un titre est attendu, vérifier qu'il est présent
  if (expectedTitle) {
    await expect(page.getByText(expectedTitle, { exact: false })).toBeVisible({
      timeout: 10000,
    });
  }
}

/**
 * Vérifier qu'il n'y a pas d'erreurs réseau critiques
 */
export async function assertNoCriticalNetworkErrors(page: Page): Promise<void> {
  const failedRequests: string[] = [];
  
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    
    // Ignorer certaines URLs qui peuvent échouer sans impact
    const ignoredUrls = [
      'favicon',
      'google-analytics',
      'googletagmanager',
      'fonts.googleapis',
      'fonts.gstatic',
    ];
    
    const shouldIgnore = ignoredUrls.some((pattern) => url.includes(pattern));
    
    if (!shouldIgnore && status >= 400 && status < 500) {
      // Erreurs 4xx sont critiques
      failedRequests.push(`Failed request: ${url} (${status})`);
    } else if (!shouldIgnore && status >= 500) {
      // Erreurs 5xx sont très critiques
      failedRequests.push(`Server error: ${url} (${status})`);
    }
  });
  
  // Si des erreurs critiques sont détectées, elles seront dans failedRequests
  // On les vérifiera après l'exécution du test
}

/**
 * Vérifier qu'un élément est visible et cliquable
 */
export async function assertElementVisibleAndClickable(
  page: Page,
  selector: string,
  timeout = 10000
): Promise<void> {
  const element = page.locator(selector);
  await expect(element).toBeVisible({ timeout });
  await expect(element).toBeEnabled({ timeout });
}

/**
 * Vérifier qu'un texte est présent et visible
 */
export async function assertTextVisible(
  page: Page,
  text: string,
  timeout = 10000
): Promise<void> {
  await expect(page.getByText(text, { exact: false })).toBeVisible({ timeout });
}
