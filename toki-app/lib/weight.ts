import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeDate } from './stats';

export type WeightEntry = {
  date: string; // YYYY-MM-DD
  weightKg: number;
};

function getKey(userId: string) {
  return `feedtoki_weights_${userId}_v1`;
}

function getBaselineKey(userId: string) {
  return `feedtoki_weight_baseline_${userId}_v1`;
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

  // Set baseline if not already defined
  const baselineRaw = await AsyncStorage.getItem(getBaselineKey(userId));
  if (!baselineRaw) {
    await AsyncStorage.setItem(getBaselineKey(userId), JSON.stringify({ date: dateKey, weightKg: entry.weightKg }));
  }
}

export function toDisplay(weightKg: number, unit: 'kg' | 'lbs'): number {
  return unit === 'kg' ? Math.round(weightKg * 10) / 10 : Math.round((weightKg / 0.453592) * 10) / 10;
}

export function toKg(value: number, unit: 'kg' | 'lbs'): number {
  return unit === 'kg' ? value : value * 0.453592;
}

export async function loadBaseline(userId: string): Promise<WeightEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(getBaselineKey(userId));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (typeof obj?.weightKg !== 'number' || typeof obj?.date !== 'string') return null;
    return { date: normalizeDate(obj.date), weightKg: obj.weightKg };
  } catch {
    return null;
  }
}

export function getWeeklyAverageSeries(weights: WeightEntry[]): Array<{ weekStart: string; avgKg: number }> {
  const groups: Record<string, { sum: number; count: number }> = {};
  for (const w of weights) {
    const d = new Date(w.date);
    const day = d.getDay(); // 0=Sun, 1=Mon
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    const weekStartDate = new Date(d);
    weekStartDate.setDate(d.getDate() + diff);
    const key = normalizeDate(weekStartDate.toISOString());
    const g = groups[key] || { sum: 0, count: 0 };
    g.sum += w.weightKg;
    g.count += 1;
    groups[key] = g;
  }
  return Object.entries(groups)
    .map(([weekStart, g]) => ({ weekStart, avgKg: g.sum / g.count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
