// Context pour gérer le thème clair/sombre
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

type Theme = 'light' | 'dark' | 'system';
type ActiveTheme = 'light' | 'dark';

// Extended context type to be compatible with components expecting a React Navigation-like theme
type ThemeContextType = {
  theme: Theme;
  activeTheme: ActiveTheme;
  setTheme: (theme: Theme) => Promise<void>;
  // Use a flexible type to avoid over-constraining token shapes across light/dark
  colors: any;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'toki_theme_preference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // État pour éviter les erreurs d'hydratation React #418 sur web
  const [isClient, setIsClient] = useState(false);
  const systemColorScheme = useSystemColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');
  
  // Initialiser isClient après le premier rendu (web uniquement)
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Déterminer le thème actif basé sur la préférence et le système
  // IMPORTANT: Utiliser 'light' par défaut si pas encore côté client pour éviter erreur #418
  const activeTheme: ActiveTheme = 
    !isClient
      ? 'light' // Valeur stable pour le premier rendu (serveur et client doivent être identiques)
      : (theme === 'system' 
          ? (systemColorScheme || 'light') 
          : theme);

  // Charger la préférence au démarrage
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
        setThemeState(saved as Theme);
      }
    } catch (e) {
      console.error('Erreur chargement thème:', e);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.error('Erreur sauvegarde thème:', e);
    }
  };

  // Build a convenient colors object and isDark flag for consumers
  const colors = Colors[activeTheme];
  const isDark = activeTheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, activeTheme, setTheme, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé dans un ThemeProvider');
  }
  return context;
}
