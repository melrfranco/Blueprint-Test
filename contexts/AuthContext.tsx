import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole, specificId?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  authInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // 🔴 IMPORTANT: App must NEVER block on auth
  useEffect(() => {
    let cancelled = false;

    // ✅ Always unblock the app
    setAuthInitialized(true);

    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;

        const authUser = data.session?.user;
        if (!authUser) return;

        const { role, business_name } = authUser.user_metadata || {};

        if (role === 'admin') {
          setUser({
            id: authUser.id,
            name: business_name || 'Admin',
            role: 'admin',
            email: authUser.email,
            isMock: false,
          });
        }
      })
      .catch(() => {
        // ❗ Ignore auth failures — app still loads
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (role: UserRole, specificId?: string) => {
    if (role === 'admin') {
      setUser({
        id: 'admin',
        name: 'System Administrator',
        role: 'admin',
        isMock: true,
      });
    }

    if (role === 'stylist') {
      setUser({
        id: specificId || 'stylist_mock',
        name: `Stylist ${specificId || ''}`.trim(),
        role: 'stylist',
        isMock: true,
      });
    }
  };

  const logout = async () => {
    try {
      await supabase?.auth.signOut();
    } catch {}
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        authInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
