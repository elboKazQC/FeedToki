import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeDate } from './stats';

export type WeightEntry = {
  date: string; // YYYY-MM-DD
  weightKg: number;
};

function getKey(userId: string) {
  return `feedtoki_weights_${userId}_v1`;
}

export async function loadWeights(userId: string): Promise<WeightEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(getKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e: any) => e && typeof e.weightKg === 'number' && typeof e.date === 'string')
      .map((e: any) => ({ date: normalizeDate(e.date), weightKg: e.weightKg }))
      .sort((a: WeightEntry, b: WeightEntry) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export async function saveWeight(userId: string, entry: WeightEntry): Promise<void> {
  const list = await loadWeights(userId);
  const dateKey = normalizeDate(entry.date);
  const next = list.filter((e) => e.date !== dateKey).concat({ date: dateKey, weightKg: entry.weightKg })
    .sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(getKey(userId), JSON.stringify(next));
}

export function toDisplay(weightKg: number, unit: 'kg' | 'lbs'): number {
  return unit === 'kg' ? Math.round(weightKg * 10) / 10 : Math.round((weightKg / 0.453592) * 10) / 10;
}

export function toKg(value: number, unit: 'kg' | 'lbs'): number {
  return unit === 'kg' ? value : value * 0.453592;
}
