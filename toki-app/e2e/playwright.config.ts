import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement depuis .env.test
dotenv.config({ path: path.join(__dirname, '.env.test') });

/**
 * Configuration Playwright pour tests E2E FeedToki
 * 
 * Supporte 3 projets :
 * - Web (Windows desktop)
 * - iPhone (émulation Safari iOS)
 * - Android (émulation Chrome Mobile)
 */
export default defineConfig({
  // URL de base de l'application
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:8081',
  
  // Timeout par défaut pour chaque test
  timeout: parseInt(process.env.E2E_TIMEOUT || '60000', 10),
  
  // Nombre de retries en cas d'échec
  retries: process.env.CI ? 1 : 0,
  
  // Workers : nombre de tests parallèles
  workers: process.env.CI ? 1 : 1, // Séquentiel pour éviter conflits Firebase
  
  // Configuration des rapports
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  // Configuration globale pour tous les projets
  use: {
    // URL de base (doit être défini ici aussi pour être utilisé dans les tests)
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8081',
    
    // Screenshots uniquement en cas d'échec
    screenshot: 'only-on-failure',
    
    // Vidéos uniquement en cas d'échec
    video: 'retain-on-failure',
    
    // Traces pour debug
    trace: 'retain-on-failure',
    
    // Timeout pour les actions (clics, remplissage, etc.)
    actionTimeout: 30000,
    
    // Timeout pour navigation
    navigationTimeout: 60000,
  },
  
  // Projets de test (Web, iPhone, Android)
  projects: [
    // Web - Desktop (Windows)
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        locale: 'fr-FR',
      },
    },
    
    // iPhone - Émulation Safari iOS
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 13 Pro'],
        locale: 'fr-FR',
      },
    },
    
    // Android - Émulation Chrome Mobile
    {
      name: 'android',
      use: {
        ...devices['Pixel 5'],
        locale: 'fr-FR',
      },
    },
  ],
  
  // Serveur de développement (optionnel - si besoin de démarrer un serveur avant les tests)
  // webServer: {
  //   command: 'npm run web',
  //   url: 'http://localhost:8081',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
