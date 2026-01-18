import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  authInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;

      if (!mounted) return;

      if (!sessionUser) {
        setUser(null);
        setAuthInitialized(true);
        return;
      }

      const { role, business_name } = sessionUser.user_metadata || {};

      if (role !== 'admin') {
        setUser(null);
        setAuthInitialized(true);
        return;
      }

      setUser({
        id: sessionUser.id,
        name: business_name || 'Admin',
        role: 'admin',
        email: sessionUser.email,
        isMock: false,
      });
      setAuthInitialized(true);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      initAuth();
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (role: UserRole) => {
    // Mock login is only for non-admin roles now.
    // Admin login MUST go through the real Square OAuth flow.
    if (role === 'stylist') {
       setUser({
        id: 'stylist-mock',
        name: 'Stylist',
        role: 'stylist',
        isMock: true,
      });
      setAuthInitialized(true);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
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
