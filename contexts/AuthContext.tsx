
import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { User, UserRole, Stylist, Client } from '../types';
import { useSettings } from './SettingsContext';

interface AuthContextType {
    user: User | null;
    login: (role: UserRole, specificId?: string | number) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const { stylists, clients } = useSettings();

    const login = (role: UserRole, specificId?: string | number) => {
        let newUser: User | null = null;

        if (role === 'stylist' || role === 'admin') {
            if (role === 'admin') {
                newUser = {
                    id: 'admin',
                    name: 'System Administrator',
                    role: 'admin'
                };
            } else {
                const stylist = specificId 
                    ? stylists.find(s => s.id === specificId) 
                    : stylists[0];
                
                if (stylist) {
                    newUser = {
                        id: stylist.id,
                        name: stylist.name,
                        role: 'stylist',
                        stylistData: stylist
                    };
                }
            }
        } else if (role === 'client') {
            // CRITICAL: Pull from the live clients list (Square + Mock) instead of hardcoded mock data
            const client = specificId 
                ? clients.find(c => c.id === specificId) 
                : clients[0];

            if (client) {
                newUser = {
                    id: client.id,
                    name: client.name,
                    role: 'client',
                    clientData: client
                };
            }
        }

        setUser(newUser);
    };

    const logout = () => {
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
