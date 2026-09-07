import type { PermissionKey } from '@erp/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';

interface CurrentUser {
  id: string;
  fullName: string;
  isSuperAdmin: boolean;
  permissions: PermissionKey[];
  roles: string[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CurrentUser>('/auth/me')
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error(err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe?: boolean) => {
    const result = await api.post<CurrentUser>('/auth/login', { email, password, rememberMe });
    setUser(result);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: PermissionKey) => Boolean(user?.isSuperAdmin || user?.permissions.includes(permission)),
    [user],
  );

  const value = useMemo(() => ({ user, loading, login, logout, hasPermission }), [user, loading, login, logout, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
