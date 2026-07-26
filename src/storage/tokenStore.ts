const TOKEN_KEY = 'team2.jwt';

export interface SecureTokenPort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export interface TokenStorage {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

export function createTokenStorage(port: SecureTokenPort): TokenStorage {
  return {
    getToken: () => port.getItem(TOKEN_KEY),
    setToken: (token) => port.setItem(TOKEN_KEY, token),
    clearToken: () => port.deleteItem(TOKEN_KEY)
  };
}
