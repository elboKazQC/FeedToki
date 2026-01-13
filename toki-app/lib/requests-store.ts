import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export type StoredFoodRequest = {
  id: string;
  userId: string;
  userEmail: string;
  foodName: string;
  brand?: string;
  portion?: string;
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const REQUESTS_KEY = 'feedtoki_food_requests_v1';
const FILE_PATH = (FileSystem as any).documentDirectory
  ? (FileSystem as any).documentDirectory + 'food-requests.json'
  : null;

async function readFileRequests(): Promise<StoredFoodRequest[]> {
  try {
    if (!FILE_PATH) return [];
    const info = await FileSystem.getInfoAsync(FILE_PATH);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE_PATH);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeFileRequests(requests: StoredFoodRequest[]): Promise<void> {
  if (!FILE_PATH) return;
  const data = JSON.stringify(requests, null, 2);
  // Encoding option may not exist in some expo-file-system typings; omit it or use any cast
  await FileSystem.writeAsStringAsync(FILE_PATH, data as any);
}

export async function addFoodRequest(req: StoredFoodRequest): Promise<void> {
  // AsyncStorage read + append
  const existingRaw = await AsyncStorage.getItem(REQUESTS_KEY);
  const existing: StoredFoodRequest[] = existingRaw ? JSON.parse(existingRaw) : [];
  const merged = [...existing, req];
  await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(merged));

  // Also write to file on native platforms (web often lacks FS)
  if (Platform.OS !== 'web') {
    try {
      const fileExisting = await readFileRequests();
      const all = [...fileExisting, req];
      await writeFileRequests(all);
    } catch (_e) {
      // Ignore file errors; AsyncStorage already holds the data
    }
  }
}

export async function getAllFoodRequests(): Promise<StoredFoodRequest[]> {
  const fromStorageRaw = await AsyncStorage.getItem(REQUESTS_KEY);
  const fromStorage: StoredFoodRequest[] = fromStorageRaw ? JSON.parse(fromStorageRaw) : [];

  const fromFile = Platform.OS !== 'web' ? await readFileRequests() : [];

  // Merge by id
  const map = new Map<string, StoredFoodRequest>();
  for (const r of [...fromFile, ...fromStorage]) {
    map.set(r.id, r);
  }
  return Array.from(map.values());
}
