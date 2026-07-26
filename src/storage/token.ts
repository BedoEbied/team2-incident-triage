import * as SecureStore from 'expo-secure-store';
import { createTokenStorage } from './tokenStore';

export type { TokenStorage } from './tokenStore';

export const tokenStorage = createTokenStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key)
});
