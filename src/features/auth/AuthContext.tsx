import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { User } from '@/api/types';
import { apiClient } from '@/api/client';
import type { TokenStorage } from '@/storage/token';

type AuthContextValue = {
  isRestoring: boolean;
  token: string | null;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  storage: TokenStorage;
}>;

export function AuthProvider({ children, storage }: AuthProviderProps) {
  const [isRestoring, setIsRestoring] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    storage
      .getToken()
      .then((storedToken) => {
        if (active) {
          setToken(storedToken);
        }
      })
      .catch(() => {
        if (active) {
          setToken(null);
        }
      })
      .finally(() => {
        if (active) {
          setIsRestoring(false);
        }
      });

    return () => {
      active = false;
    };
  }, [storage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isRestoring,
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
    [isRestoring, storage, token, user]
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
