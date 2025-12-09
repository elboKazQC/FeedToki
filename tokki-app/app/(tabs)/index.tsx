import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Entry = {
  id: string;
  date: string;
  label: string;
  category: 'sain' | 'ok' | 'cheat';
};

type Stats = {
  scorePct: number;
  label: string;
  level: 1 | 2 | 3;
};

const STORAGE_KEY = 'feedtoki_entries_v1';

// ---- Fonction utilitaire : stats sur 7 jours ----
function getLast7DaysStats(entries: Entry[]): Stats {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recent = entries.filter((e) => new Date(e.date) >= sevenDaysAgo);

  if (recent.length === 0) {
    return {
      scorePct: 0,
      label: 'Aucun suivi encore',
      level: 1,
    };
  }

  let points = 0;
  const maxPerEntry = 2;

  for (const e of recent) {
    if (e.category === 'sain') points += 2;
    else if (e.category === 'ok') points += 1;
  }

  const maxPoints = recent.length * maxPerEntry;
  const ratio = maxPoints > 0 ? points / maxPoints : 0;
  const scorePct = Math.round(ratio * 100);

  let label: string;
  let level: 1 | 2 | 3;

  if (ratio >= 0.7) {
    label = 'Excellent 👑';
    level = 3;
  } else if (ratio >= 0.4) {
    label = 'En progrès 💪';
    level = 2;
  } else {
    label = 'À améliorer 🐉';
    level = 1;
  }

  return { scorePct, label, level };
}

// ---- Composant principal ----
export default function App() {
  const [screen, setScreen] = useState<'home' | 'add' | 'ask'>('home');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isReady, setIsReady] = useState(false);

  // Charger les entrées au démarrage
  useEffect(() => {
    const load = async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed)) {
            setEntries(parsed as Entry[]);
          }
        }
      } catch (e) {
        console.log('Erreur chargement AsyncStorage', e);
      } finally {
        setIsReady(true);
      }
    };
    load();
  }, []);

  // Sauvegarder à chaque changement
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch (e) {
        console.log('Erreur sauvegarde AsyncStorage', e);
      }
    };
    if (isReady) {
      save();
    }
  }, [entries, isReady]);

  const handleAddEntry = (entry: Omit<Entry, 'id' | 'date'>) => {
    setEntries((prev) => [
      {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ]);
    setScreen('home');
  };

  const stats = getLast7DaysStats(entries);

  return (
    <View style={styles.container}>
      {screen === 'home' && (
        <HomeScreen
          entries={entries}
          onPressAdd={() => setScreen('add')}
          onPressAsk={() => setScreen('ask')}
          stats={stats}
        />
      )}

      {screen === 'add' && (
        <AddEntryScreen
          onCancel={() => setScreen('home')}
          onSave={handleAddEntry}
        />
      )}

      {screen === 'ask' && (
        <AskScreen
          entries={entries}
          onCancel={() => setScreen('home')}
          onConfirm={handleAddEntry}
        />
      )}

      <StatusBar style="light" />
    </View>
  );
}

// ---- Écran d'accueil ----
function HomeScreen({
  entries,
  onPressAdd,
  onPressAsk,
  stats,
}: {
  entries: Entry[];
  onPressAdd: () => void;
  onPressAsk: () => void;
  stats: Stats;
}) {
  const levelImages: Record<1 | 2 | 3, any> = {
    1: require('../../assets/images/feedtoki_lvl1.png'),
    2: require('../../assets/images/feedtoki_lvl2.png'),
    3: require('../../assets/images/feedtoki_lvl3.png'),
  };
  const imgSource = levelImages[stats.level] || levelImages[1];

  return (
    <View style={styles.inner}>
      <Text style={styles.logo}>FeedToki 🐉</Text>

      <View style={styles.dragonBox}>
        <Image source={imgSource} style={styles.dragonImage} resizeMode="contain" />
      </View>

      <Text style={styles.statsText}>
        7 derniers jours : {stats.label} ({stats.scorePct}%)
      </Text>

      <View style={styles.homeButtons}>
        <TouchableOpacity style={styles.buttonPrimary} onPress={onPressAdd}>
          <Text style={styles.buttonPrimaryText}>{"Ajouter ce que j'ai mangé"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.buttonSecondary} onPress={onPressAsk}>
          <Text style={styles.buttonSecondaryText}>Demander à FeedToki</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyBox}>
        <Text style={styles.historyTitle}>Dernières entrées</Text>
        {entries.length === 0 ? (
          <Text style={styles.historyEmpty}>{"Aucune entrée pour l'instant."}</Text>
        ) : (
          <FlatList
            data={entries.slice(0, 5)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Text style={styles.historyItem}>
                • [{item.category}] {item.label}
              </Text>
            )}
          />
        )}
      </View>
    </View>
  );
}

// ---- Écran ajout d'une consommation ----
function AddEntryScreen({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (entry: Omit<Entry, 'id' | 'date'>) => void;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<Entry['category']>('sain');

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({ label: label.trim(), category });
  };

  return (
    <View style={styles.inner}>
      <Text style={styles.logo}>Nouvelle consommation</Text>

      <TextInput
        style={styles.input}
        placeholder="Ex: poulet + légumes, poutine, bière..."
        placeholderTextColor="#6b7280"
        value={label}
        onChangeText={setLabel}
      />

      <Text style={styles.label}>Catégorie</Text>
      <CategoryChips category={category} setCategory={setCategory} />

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Annuler</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveText}>Enregistrer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---- Écran "Demander à FeedToki" ----
function AskScreen({
  entries,
  onCancel,
  onConfirm,
}: {
  entries: Entry[];
  onCancel: () => void;
  onConfirm: (entry: Omit<Entry, 'id' | 'date'>) => void;
}) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<Entry['category']>('sain');
  const [preview, setPreview] = useState<Stats | null>(null);

  const handleAsk = () => {
    if (!label.trim()) return;

    const hypotheticalEntry: Entry = {
      id: 'temp',
      date: new Date().toISOString(),
      label: label.trim(),
      category,
    };

    const newStats = getLast7DaysStats([hypotheticalEntry, ...entries]);
    setPreview(newStats);
  };

  const handleConfirm = () => {
    if (!label.trim()) return;
    onConfirm({ label: label.trim(), category });
  };

  const getAdviceText = () => {
    if (!preview) return 'Entre ce que tu veux manger, et demande à FeedToki 💭';

    if (preview.level === 3) {
      return 'FeedToki est fier de toi, ça passe 💚';
    }
    if (preview.level === 2) {
      return 'Ça passe, mais FeedToki te surveille 👀';
    }
    return 'FeedToki préférerait attendre un peu 😅';
  };

  return (
    <View style={styles.inner}>
      <Text style={styles.logo}>Demander à FeedToki</Text>

      <TextInput
        style={styles.input}
        placeholder="Ex: pizza, chips, shake protéiné..."
        placeholderTextColor="#6b7280"
        value={label}
        onChangeText={setLabel}
      />

      <Text style={styles.label}>Catégorie (selon ce que TU penses)</Text>
      <CategoryChips category={category} setCategory={setCategory} />

      <Text style={styles.adviceText}>{getAdviceText()}</Text>
      {preview && (
        <Text style={styles.previewStats}>
          Si tu manges ça : {preview.label} ({preview.scorePct}% sur 7 jours)
        </Text>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Retour</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.askBtn} onPress={handleAsk}>
          <Text style={styles.askText}>Demander à FeedToki</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { marginTop: 12, width: '100%' }]}
        onPress={handleConfirm}
      >
        <Text style={styles.saveText}>Manger et enregistrer</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---- Composant chips catégories réutilisable ----
function CategoryChips({
  category,
  setCategory,
}: {
  category: Entry['category'];
  setCategory: (cat: Entry['category']) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {['sain', 'ok', 'cheat'].map((cat) => (
        <TouchableOpacity
          key={cat}
          style={[
            styles.chip,
            category === cat && styles.chipSelected,
          ]}
          onPress={() => setCategory(cat as Entry['category'])}
        >
          <Text
            style={[
              styles.chipText,
              category === cat && styles.chipTextSelected,
            ]}
          >
            {cat === 'sain'
              ? '✅ Sain'
              : cat === 'ok'
              ? '🟡 Correct'
              : '🍟 Cheat'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 32,
    textAlign: 'center',
  },
  dragonBox: {
    width: 260,
    height: 260,
    borderRadius: 32,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },
  statsText: {
    color: '#e5e7eb',
    fontSize: 14,
    marginBottom: 16,
  },
  homeButtons: {
    width: '100%',
    gap: 8,
    marginBottom: 24,
  },
  buttonPrimary: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#022c22',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonSecondary: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#e5e7eb',
    fontSize: 15,
  },
  historyBox: {
    width: '100%',
    marginTop: 8,
  },
  historyTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 4,
  },
  historyEmpty: {
    color: '#6b7280',
    fontSize: 13,
  },
  historyItem: {
    color: '#d1d5db',
    fontSize: 14,
    marginVertical: 2,
  },
  input: {
    width: '100%',
    backgroundColor: '#020617',
    borderColor: '#4b5563',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f9fafb',
    marginBottom: 16,
  },
  label: {
    color: '#e5e7eb',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#22c55e33',
    borderColor: '#22c55e',
  },
  chipText: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#bbf7d0',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6b7280',
    alignItems: 'center',
  },
  cancelText: {
    color: '#e5e7eb',
  },
  saveBtn: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  saveText: {
    color: '#022c22',
    fontWeight: 'bold',
  },
  askBtn: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 6,
    borderRadius: 999,
    backgroundColor: '#0369a1',
    alignItems: 'center',
  },
  askText: {
    color: '#e0f2fe',
    fontWeight: 'bold',
  },
  adviceText: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  previewStats: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
});
