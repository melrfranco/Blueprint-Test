
import React, { useState } from 'react';
import type { UserRole } from '../types';
import { clearSupabaseConfig } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { UsersIcon, CheckCircleIcon, RefreshIcon, DocumentTextIcon, SettingsIcon, ChevronLeftIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface LoginScreenProps {
  onLogin: (role: UserRole, id?: string) => void;
  onSelectRole?: (role: UserRole) => void;
}

type AppMode = 'landing' | 'professional' | 'client';
type ClientAuthMode = 'signin' | 'signup';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onSelectRole }) => {
  const [appMode, setAppMode] = useState<AppMode>('landing');
  const [clientAuthMode, setClientAuthMode] = useState<ClientAuthMode>('signin');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const { stylists, branding } = useSettings();
  const { signInClient, signUpClient, isAuthenticated } = useAuth();
  const squareAuthed = sessionStorage.getItem('square_oauth_complete') === 'true';

  const handleClientAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
        if (clientAuthMode === 'signup') {
            const { data, error } = await signUpClient({ 
                email, 
                password,
                options: { data: { role: 'client' } } 
            });
            if (error) throw error;
            if (data.user && !data.session) {
                setAuthMessage("Success! Please check your email to confirm your account.");
            }
        } else {
            const { error } = await signInClient({ email, password });
            if (error) throw error;
            // Successful sign-in will be handled by the onAuthStateChange listener
        }
    } catch (err: any) {
        setAuthError(err.message || 'An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleDevClientLogin = async () => {
    setIsLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
        await onLogin('client');
        onSelectRole?.('client');
    } catch (err: any) {
        setAuthError(`Dev login failed: ${err.message}. Ensure at least one client exists in the database.`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleRoleSelection = (role: UserRole, id?: string) => {
      if (role === 'stylist' && id) {
          onLogin('stylist', id);
          onSelectRole?.('stylist');
      } else if (role === 'admin') {
          onLogin('admin');
          onSelectRole?.('admin');
      } else if (role === 'client') {
          onSelectRole?.('client');
      }
  };
  
  const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#1E3A8A');
  const safePrimaryColor = ensureAccessibleColor(branding.primaryColor, '#FFFFFF', '#BE123C');
  
  const handleSquareLogin = () => {
    // Robust access to environment variables from multiple possible sources
    const clientId = process.env.VITE_SQUARE_APPLICATION_ID || (import.meta as any).env?.VITE_SQUARE_APPLICATION_ID;
    const redirectUri = process.env.VITE_SQUARE_REDIRECT_URI || (import.meta as any).env?.VITE_SQUARE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      setAuthError(
        'Square login is unavailable. Environment variables are missing at runtime. ' +
        'Please ensure VITE_SQUARE_APPLICATION_ID and VITE_SQUARE_REDIRECT_URI are configured.'
      );
      return;
    }

    // LOCKED, VALID SCOPES ONLY (Minimizes authorization errors)
    const scopes = [
      'CUSTOMERS_READ',
      'CUSTOMERS_WRITE',
      'APPOINTMENTS_READ',
      'APPOINTMENTS_WRITE',
      'ITEMS_READ',
      'EMPLOYEES_READ',
      'MERCHANT_PROFILE_READ'
    ].join(' ');

    const state = crypto.randomUUID();

    const oauthUrl =
      'https://connect.squareup.com/oauth2/authorize' +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    window.location.href = oauthUrl;
  };

  if (appMode === 'landing') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="text-center mb-10">
                {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={`${branding.salonName} Logo`} className="w-24 h-24 object-contain mx-auto mb-4" />
                ) : (
                    <div className="w-20 h-20 bg-brand-accent rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl transform -rotate-3">
                        <span className="text-white font-bold text-4xl">{branding.salonName?.[0] || 'S'}</span>
                    </div>
                )}
                <h1 className="text-3xl font-bold text-gray-900 tracking-tighter">{branding.salonName}</h1>
                <p className="text-gray-500 mt-2 font-medium">Select your application portal</p>
                {(isAuthenticated || squareAuthed) && (
                    <div className="mt-4 px-4 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-black uppercase tracking-widest inline-block">
                        Already Authenticated
                    </div>
                )}
            </div>

            <div className="w-full max-w-md space-y-4">
                <button 
                    onClick={() => setAppMode('professional')}
                    className="w-full bg-white p-6 rounded-[32px] shadow-lg border-4 border-transparent hover:border-brand-accent transition-all group text-left flex items-center"
                >
                    <div className="bg-brand-accent/10 p-4 rounded-2xl mr-5 group-hover:bg-brand-accent group-hover:text-white transition-colors" style={{ color: safeAccentColor }}>
                        <SettingsIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-950 leading-none">Professional App</h3>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Stylists & Admins</p>
                    </div>
                </button>

                <button 
                    onClick={() => {
                        if (isAuthenticated) handleRoleSelection('client');
                        else setAppMode('client');
                    }}
                    className="w-full bg-white p-6 rounded-[32px] shadow-lg border-4 border-transparent hover:border-brand-primary transition-all group text-left flex items-center"
                >
                    <div className="bg-brand-primary/10 p-4 rounded-2xl mr-5 group-hover:bg-brand-primary group-hover:text-white transition-colors" style={{ color: safePrimaryColor }}>
                        <UsersIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-950 leading-none">Client Portal</h3>
                        <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Customer Roadmaps</p>
                    </div>
                </button>
            </div>
            
            <p className="mt-12 text-gray-400 text-[10px] font-black uppercase tracking-widest">v1.5.1 • Enterprise Core</p>
        </div>
      );
  }

  const headerStyle = {
      color: ensureAccessibleColor(
          appMode === 'professional' ? branding.accentColor : branding.primaryColor,
          '#F9FAFB', 
          appMode === 'professional' ? '#1E3A8A' : '#BE123C'
      )
  };
  
  const buttonStyle = {
      backgroundColor: branding.primaryColor,
      color: ensureAccessibleColor('#FFFFFF', branding.primaryColor, '#1F2937')
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500`} style={{ backgroundColor: appMode === 'professional' ? branding.accentColor : branding.primaryColor}}>
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 border-gray-950">
        
        <button onClick={() => setAppMode('landing')} className="absolute top-6 left-6 text-gray-400 hover:text-gray-800 transition-colors z-10">
            <ChevronLeftIcon className="w-7 h-7" />
        </button>

        <div className="bg-gray-50 p-10 text-center border-b-4 border-gray-100">
            {appMode === 'client' && branding.logoUrl && (
                 <img src={branding.logoUrl} alt={`${branding.salonName} Logo`} className="w-20 h-20 object-contain mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-black tracking-tighter" style={headerStyle}>
                {appMode === 'professional' ? 'Pro Access' : branding.salonName}
            </h1>
            <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">
                {appMode === 'professional' ? 'Select Professional Profile' : 'Customer Account Login'}
            </p>
        </div>

        <div className="p-10">
            {appMode === 'professional' ? (
                <div className="space-y-4">
                    {stylists.map(s => (
                        <button 
                            key={s.id} 
                            onClick={() => handleRoleSelection('stylist', s.id)}
                            className="w-full p-4 border-2 border-gray-100 rounded-2xl flex items-center hover:border-brand-accent transition-all group"
                        >
                            <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent font-black mr-4 group-hover:bg-brand-accent group-hover:text-white transition-colors">
                                {s.name[0]}
                            </div>
                            <div className="text-left">
                                <p className="font-black text-gray-900 leading-none">{s.name}</p>
                                <p className="text-[10px] text-gray-400 font-black uppercase mt-1">{s.role}</p>
                            </div>
                        </button>
                    ))}
                    <div className="pt-4 border-t-2 border-gray-50">
                        <button 
                            onClick={() => handleRoleSelection('admin')}
                            className="w-full p-4 bg-gray-950 text-white rounded-2xl font-black text-sm flex items-center justify-center space-x-2 active:scale-95 transition-all"
                        >
                            <SettingsIcon className="w-4 h-4" />
                            <span>ADMIN ACCESS</span>
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleClientAuth} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none font-bold text-gray-900 focus:border-brand-primary transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Password</label>
                        <input 
                            type="password" 
                            required 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none font-bold text-gray-900 focus:border-brand-primary transition-all"
                        />
                    </div>

                    {authError && <p className="text-red-500 text-xs font-bold text-center">{authError}</p>}
                    {authMessage && <p className="text-green-600 text-xs font-bold text-center">{authMessage}</p>}

                    <div className="space-y-3 pt-2">
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full font-black py-4 rounded-2xl shadow-xl flex items-center justify-center space-x-2 active:scale-95 transition-all border-b-4 border-black/20"
                            style={buttonStyle}
                        >
                            {isLoading ? <RefreshIcon className="w-5 h-5 animate-spin" /> : <span>{clientAuthMode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}</span>}
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => setClientAuthMode(clientAuthMode === 'signin' ? 'signup' : 'signin')}
                            className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-900"
                        >
                            {clientAuthMode === 'signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </button>
                    </div>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                        <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest"><span className="bg-white px-2 text-gray-400">Or Developer Access</span></div>
                    </div>

                    <button 
                        type="button"
                        onClick={handleDevClientLogin}
                        className="w-full p-4 border-2 border-dashed border-gray-200 rounded-2xl font-black text-xs text-gray-400 hover:border-brand-primary hover:text-brand-primary transition-all"
                    >
                        LOGIN AS SAMPLE CLIENT
                    </button>
                </form>
            )}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center space-y-4">
        <button 
            onClick={handleSquareLogin}
            className="flex items-center space-x-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 text-white font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all"
        >
            <RefreshIcon className="w-4 h-4" />
            <span>Sync via Square</span>
        </button>
        <button 
            onClick={clearSupabaseConfig}
            className="text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
        >
            Reset Database Configuration
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;
