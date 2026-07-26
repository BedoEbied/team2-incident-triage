import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import type { User } from '@/api/types';
import { apiClient } from '@/api/client';
import type { TokenStorage } from '@/storage/token';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  initialToken: string | null;
  storage: TokenStorage;
}>;

export function AuthProvider({ children, initialToken, storage }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      async login(email, password) {
        const response = await apiClient.login(email, password);
        await storage.setToken(response.token);
        setToken(response.token);
        setUser(response.user);
      },
      async logout() {
        await storage.clearToken();
        setToken(null);
        setUser(null);
      }
    }),
    [storage, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
