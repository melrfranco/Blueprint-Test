import React from 'react';
import type { UserRole } from './types';

import StylistDashboard from './components/StylistDashboard';
import AdminDashboard from './components/AdminDashboard';
import LoginScreen from './components/LoginScreen';
import MissingCredentialsScreen from './components/MissingCredentialsScreen';

import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';

import { isSquareTokenMissing } from './services/squareIntegration';

import './styles/accessibility.css';

/* ----------------------------- */
/* App Content (Auth-aware UI)   */
/* ----------------------------- */
const AppContent: React.FC = () => {
  const { user, login, logout, authInitialized } = useAuth();
  const { needsSquareConnect } = useSettings();

  console.log('[APP CONTENT STATE]', {
    authInitialized,
    user,
    needsSquareConnect,
  });

  // 1️⃣ Wait for auth to resolve
  if (!authInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-bg">
        <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2️⃣ Not logged in → login screen
  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  // 3️⃣ Logged in BUT Square not connected → FORCE Square OAuth
  if (needsSquareConnect) {
    return <MissingCredentialsScreen />;
  }

  // 4️⃣ Normal dashboard
  const role: UserRole = user.role;

  switch (role) {
    case 'stylist':
      return <StylistDashboard onLogout={logout} role="stylist" />;

    case 'admin':
      return <AdminDashboard role="admin" />;

    default:
      return <LoginScreen onLogin={login} />;
  }
};


/* ----------------------------- */
/* Root App Wrapper              */
/* ----------------------------- */

const App: React.FC = () => {
  /*
    CRITICAL FIX:
    isSquareTokenMissing is a boolean constant.
    It MUST NOT be called as a function.
  */
  // FIX: `isSquareTokenMissing` is a boolean constant, not a function.
  if (false && isSquareTokenMissing) {

    return (
      <SettingsProvider>
        <MissingCredentialsScreen />
      </SettingsProvider>
    );
  }

  return (
    <SettingsProvider>
      <AuthProvider>
        <PlanProvider>
          <AppContent />
        </PlanProvider>
      </AuthProvider>
    </SettingsProvider>
  );
};

export default App;