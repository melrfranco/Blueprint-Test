import React, { useState } from 'react';
import type { UserRole } from '../types';
import { clearSupabaseConfig } from '../lib/supabase';
import { useSettings } from '../contexts/SettingsContext';
import { SettingsIcon, RefreshIcon } from './icons';
import { ensureAccessibleColor } from '../utils/ensureAccessibleColor';

interface LoginScreenProps {
  onLogin: (role: UserRole, id?: string) => void;
}

/**
 * PRO-ONLY BUILD:
 * - NO client UI
 * - NO portal selector
 * - ONLY Square OAuth login for admin/pro access
 */
const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { stylists, branding } = useSettings();

  const safeAccentColor = ensureAccessibleColor(branding.accentColor, '#FFFFFF', '#1E3A8A');

  const handleSquareLogin = () => {
    setAuthError(null);

    const clientId = process.env.VITE_SQUARE_APPLICATION_ID;
    const redirectUri = process.env.VITE_SQUARE_REDIRECT_URI;

    if (!clientId) {
      setAuthError('Square login is unavailable. The application ID is missing.');
      return;
    }
    if (!redirectUri) {
      setAuthError('Square login is unavailable. The redirect URI is missing.');
      return;
    }

    // IMPORTANT:
    // - space-delimited
    // - encoded via encodeURIComponent
    // - includes EMPLOYEES_READ (NOT TEAM_MEMBERS_READ)
    const scopes = [
      'CUSTOMERS_READ',
      'ITEMS_READ',
      'MERCHANT_PROFILE_READ',
      'EMPLOYEES_READ',
      'APPOINTMENTS_READ',
      'APPOINTMENTS_WRITE',
      'APPOINTMENTS_BUSINESS_SETTINGS_READ',
    ].join(' ');

    const authorizeBase = 'https://connect.squareup.com/oauth2/authorize';
    const state = crypto.randomUUID();

    const oauthUrl =
      `${authorizeBase}` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}`;

    window.location.assign(oauthUrl);
  };

  const headerStyle = {
    color: ensureAccessibleColor(branding.accentColor, '#F9FAFB', '#1E3A8A'),
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500"
      style={{ backgroundColor: branding.accentColor }}
    >
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden relative border-4 border-gray-950">
        <div className="bg-gray-50 p-10 text-center border-b-4 border-gray-100">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.salonName} Logo`}
              className="w-20 h-20 object-contain mx-auto mb-4"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-xl transform -rotate-3"
              style={{ backgroundColor: safeAccentColor }}
            >
              <SettingsIcon className="w-10 h-10 text-white" />
            </div>
          )}

          <h1 className="text-3xl font-black tracking-tighter" style={headerStyle}>
            Pro Access
          </h1>
          <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">
            Internal Management
          </p>
        </div>

        <div className="p-10">
          <button
            type="button"
            onClick={handleSquareLogin}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center space-x-3 border-b-4 border-blue-800 active:scale-95 transition-all text-lg disabled:opacity-60"
          >
            {isLoading ? <RefreshIcon className="w-6 h-6 animate-spin" /> : <span>Log in with Square</span>}
          </button>

          {authError && (
            <p className="text-red-600 text-xs font-bold text-center p-3 mt-4 bg-red-50 rounded-lg">
              {authError}
            </p>
          )}

          <p className="text-center text-xs text-gray-500 mt-3 px-4">
            Admin/Pro accounts are authenticated via Square.
          </p>

          {/* Keep existing dev/pro troubleshooting shortcuts (pro-only). */}
          <details className="mt-8 text-gray-500">
            <summary className="text-xs font-black uppercase tracking-widest cursor-pointer text-center py-2">
              Advanced / Troubleshooting
            </summary>
            <div className="mt-4 pt-4 border-t-2 border-gray-100 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center mb-2">
                Dev Auto-Login
              </h3>

              {stylists.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() => onLogin('stylist', s.id)}
                  className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-50 hover:border-brand-accent transition-all bg-white text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-accent text-white flex items-center justify-center font-black text-sm">
                    {s.name[0]}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-black text-gray-950 leading-none">{s.name}</p>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.role}</p>
                  </div>
                </button>
              ))}

              <button
                onClick={() => onLogin('admin')}
                className="w-full group flex items-center p-4 rounded-2xl border-4 border-gray-950 bg-gray-950 text-white transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-sm">
                  A
                </div>
                <div className="ml-3">
                  <p className="text-sm font-black leading-none">System Admin (Manual)</p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Full Controller</p>
                </div>
              </button>
            </div>
          </details>

          <button
            onClick={clearSupabaseConfig}
            className="w-full text-center mt-10 text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-brand-accent transition-colors"
          >
            Reset System Database Config
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
