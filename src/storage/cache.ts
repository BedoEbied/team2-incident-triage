import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Incident } from '@/api/types';

const INCIDENT_CACHE_KEY = 'team2.incidents.cache';

export async function cacheIncidentList(items: Incident[]): Promise<void> {
  await AsyncStorage.setItem(INCIDENT_CACHE_KEY, JSON.stringify(items));
}

export async function readCachedIncidentList(): Promise<Incident[]> {
  const raw = await AsyncStorage.getItem(INCIDENT_CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Incident[];
  } catch {
    return [];
  }
}
