import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getAccessToken, onAccessTokenChanged, setAccessToken } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (identifier: { email: string } | { phone: string }, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterPayload {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  preferredCurrency?: 'USD' | 'CDF';
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadCurrentUser() {
  const { data } = await api.get<User>('/users/me');
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const establishSession = useCallback(async (token: string) => {
    setAccessToken(token);
    try {
      const currentUser = await loadCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setAccessToken(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .post<{ accessToken: string }>('/auth/refresh')
      .then(({ data }) => establishSession(data.accessToken))
      .catch(() => {
        if (active) {
          setAccessToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [establishSession]);

  useEffect(() => {
    const unsubscribe = onAccessTokenChanged((token) => {
      if (!token) setUser(null);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(
    async (identifier: { email: string } | { phone: string }, password: string) => {
      const { data } = await api.post<{ accessToken: string }>('/auth/login', {
        ...identifier,
        password,
      });
      await establishSession(data.accessToken);
    },
    [establishSession],
  );

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) return;
    const currentUser = await loadCurrentUser();
    setUser(currentUser);
  }, []);

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { data } = await api.post<{ accessToken: string }>('/auth/register', payload);
      await establishSession(data.accessToken);
    },
    [establishSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans un AuthProvider.');
  return context;
}
