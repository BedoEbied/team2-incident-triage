import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createTokenStorage } from './tokenStore';

export type { TokenStorage } from './tokenStore';

/**
 * expo-secure-store has no web implementation (no OS keychain to back it).
 * Native builds always use SecureStore; `expo start --web` falls back to
 * localStorage purely so the app is previewable in a browser during
 * development. This never runs on iOS/Android.
 */
const webAdapter = {
  getItem: async (key: string) => window.localStorage.getItem(key),
  setItem: async (key: string, value: string) => window.localStorage.setItem(key, value),
  deleteItem: async (key: string) => window.localStorage.removeItem(key)
};

export const tokenStorage = createTokenStorage(
  Platform.OS === 'web'
    ? webAdapter
    : {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        deleteItem: (key) => SecureStore.deleteItemAsync(key)
      }
);
