// Wrapper pour SafeAreaView avec fallback pour le web (Safari mobile)
import React from 'react';
import { View, Platform, ViewProps } from 'react-native';

// Type pour les props de SafeAreaView
type SafeAreaViewProps = ViewProps & {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  children?: React.ReactNode;
};

// Essayer d'importer SafeAreaView, avec fallback si échec
let SafeAreaViewComponent: React.ComponentType<SafeAreaViewProps> | null = null;

try {
  // Essayer d'importer SafeAreaView
  const SafeAreaContext = require('react-native-safe-area-context');
  if (SafeAreaContext && SafeAreaContext.SafeAreaView) {
    SafeAreaViewComponent = SafeAreaContext.SafeAreaView;
  }
} catch (error) {
  // Si l'import échoue, SafeAreaViewComponent reste null
  console.warn('[SafeAreaViewWrapper] react-native-safe-area-context non disponible, utilisation du fallback View');
}

// Fallback : View simple pour le web
const FallbackSafeAreaView: React.FC<SafeAreaViewProps> = ({ style, children, edges, ...props }) => {
  return (
    <View style={style} {...props}>
      {children}
    </View>
  );
};

// Composant wrapper qui utilise SafeAreaView si disponible, sinon View
export const SafeAreaView: React.FC<SafeAreaViewProps> = (props) => {
  // Sur le web, utiliser toujours le fallback pour éviter les erreurs
  if (Platform.OS === 'web') {
    return <FallbackSafeAreaView {...props} />;
  }

  // Sur native, utiliser SafeAreaView si disponible
  if (SafeAreaViewComponent) {
    return <SafeAreaViewComponent {...props} />;
  }

  // Fallback si SafeAreaView n'est pas disponible
  return <FallbackSafeAreaView {...props} />;
};
