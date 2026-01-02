# Solution - Erreur d'Hydratation React #418

**Date de résolution :** 2 janvier 2026  
**Version de déploiement :** 1.0.74  
**Problème :** Erreur React #418 (Hydration Mismatch) sur la version web déployée

## 🔍 Description du Problème

L'application web affichait constamment l'erreur suivante dans la console :
```
Error: Minified React error #418; visit https://react.dev/errors/418?args[]=
```

Cette erreur se produisait même après avoir vidé le cache du navigateur, indiquant que le problème venait du code lui-même, pas du cache.

### Cause Racine

L'erreur #418 se produit lorsque le HTML rendu côté serveur (SSR) ne correspond pas au HTML rendu côté client lors de l'hydratation React. Dans notre cas, plusieurs composants retournaient des valeurs différentes entre le rendu serveur et client :

1. **`ThemeProvider`** utilisait `useSystemColorScheme()` qui peut retourner `null` ou une valeur différente entre serveur/client
2. **`RootLayoutContent`** utilisait des hooks (`useAuth()`, `useColorScheme()`) qui retournent des valeurs différentes au premier rendu
3. **`StatusBar`** peut causer des différences d'hydratation selon le contexte

## ✅ Solution Appliquée

### 1. Correction de `ThemeProvider` (`lib/theme-context.tsx`)

**Problème :** `useSystemColorScheme()` peut retourner des valeurs différentes entre serveur et client.

**Solution :** Ajout d'un état `isClient` pour garantir une valeur stable au premier rendu.

```typescript
export function ThemeProvider({ children }: { children: ReactNode }) {
  // État pour éviter les erreurs d'hydratation React #418 sur web
  const [isClient, setIsClient] = useState(false);
  const systemColorScheme = useSystemColorScheme();
  const [theme, setThemeState] = useState<Theme>('system');
  
  // Initialiser isClient après le premier rendu (web uniquement)
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // IMPORTANT: Utiliser 'light' par défaut si pas encore côté client
  const activeTheme: ActiveTheme = 
    !isClient
      ? 'light' // Valeur stable pour le premier rendu
      : (theme === 'system' 
          ? (systemColorScheme || 'light') 
          : theme);
```

### 2. Correction de `RootLayoutContent` (`app/_layout.tsx`)

**Problème :** Les hooks `useAuth()` et `useColorScheme()` retournent des valeurs différentes au premier rendu serveur vs client.

**Solution :** Retourner `null` si `!isClient` sur web pour garantir que serveur et client rendent la même chose.

```typescript
function RootLayoutContent() {
  const [isClient, setIsClient] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // ... hooks déclarés avant le return conditionnel (règle React)
  const colorSchemeHook = useColorScheme();
  const authData = useAuth();
  
  // IMPORTANT: Retourner null si pas encore côté client (web uniquement)
  // Cela garantit que serveur et client rendent la même chose (null)
  if (!isClient && Platform.OS === 'web') {
    return null;
  }

  const theme = (colorScheme === 'dark' ? DarkTheme : DefaultTheme);

  return (
    <ThemeProvider value={theme}>
      <Stack>
        {/* ... */}
      </Stack>
      {/* StatusBar rendu seulement après isClient=true */}
      {isClient && <StatusBar style="auto" />}
    </ThemeProvider>
  );
}
```

### 3. Correction de `StatusBar` (`app/_layout.tsx`)

**Problème :** `StatusBar` peut causer des différences d'hydratation.

**Solution :** Rendre `StatusBar` conditionnellement seulement après que `isClient` soit `true`.

```typescript
{isClient && <StatusBar style="auto" />}
```

## 📋 Fichiers Modifiés

1. **`toki-app/lib/theme-context.tsx`**
   - Ajout de l'état `isClient`
   - Retour de `'light'` par défaut si `!isClient`

2. **`toki-app/app/_layout.tsx`**
   - Retour de `null` si `!isClient && Platform.OS === 'web'`
   - Rendu conditionnel de `StatusBar`

## 🎯 Principe Clé

**Pour éviter les erreurs d'hydratation React #418 :**

1. **Toujours déclarer TOUS les hooks AVANT tout `return` conditionnel** (règle React #418/#310)
2. **Utiliser un état `isClient`** pour les valeurs qui diffèrent entre serveur et client
3. **Retourner la même valeur (ex: `null`) au premier rendu** si on doit attendre le client
4. **Utiliser des valeurs stables** (ex: `'light'`) pour le premier rendu au lieu de valeurs dynamiques

## ✅ Vérification

Après déploiement de la version 1.0.74 :
- L'erreur #418 ne devrait plus apparaître dans la console
- L'application devrait se charger correctement sans erreurs d'hydratation
- Les fonctionnalités devraient fonctionner normalement

## 🔗 Références

- [React Error #418 - Documentation officielle](https://react.dev/errors/418)
- [Expo Router Static Rendering](https://docs.expo.dev/router/reference/static-rendering/)
- Pattern `isClient` pour éviter les erreurs d'hydratation sur web

## 📝 Notes Importantes

- Cette solution garantit que le rendu serveur et client sont identiques au premier rendu
- Le contenu réel s'affiche après que `isClient` soit `true` (généralement instantané)
- Cette approche est recommandée pour les applications Expo Router avec export statique web
