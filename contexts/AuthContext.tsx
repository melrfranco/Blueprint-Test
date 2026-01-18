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

  useEffect(() => {
    if (!supabase) {
      setAuthInitialized(true);
      return;
    }

    let active = true;

    const resolveUserFromSession = (session: any) => {
      if (!active) return;

      const authUser = session?.user;

      if (!authUser) {
        setUser(null);
        setAuthInitialized(true);
        return;
      }

      const { role, business_name } = authUser.user_metadata || {};

      if (role === 'admin') {
        setUser({
          id: authUser.id,
          name: business_name || 'Admin',
          role: 'admin',
          email: authUser.email,
          isMock: false,
        });
      } else {
        setUser(null);
      }

      setAuthInitialized(true);
    };

    // ✅ IMPORTANT: initialize immediately (prevents infinite loading loop)
    supabase.auth.getSession().then(({ data }) => {
      resolveUserFromSession(data.session);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        resolveUserFromSession(session);
      });

    return () => {
      active = false;
      subscription?.unsubscribe();
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
    if (supabase) {
      const { error } = await (supabase.auth as any).signOut();
      if (error) console.error('Error signing out:', error);
    }
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
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
