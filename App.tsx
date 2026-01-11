
import React, { useEffect, useState } from 'react';
import type { GeneratedPlan, UserRole } from './types';
import { CURRENT_CLIENT } from './data/mockData';
import RoleSwitcher from './components/RoleSwitcher';
import StylistDashboard from './components/StylistDashboard';
import ClientDashboard from './components/ClientDashboard';
import AdminDashboard from './components/AdminDashboard';
import SetupScreen from './components/SetupScreen';
import LoginScreen from './components/LoginScreen';
import { supabase } from './lib/supabase';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider, usePlans } from './contexts/PlanContext';
import './styles/accessibility.css';
import SquareCallback from './components/SquareCallback';
import { SquareIntegrationService } from './services/squareIntegration';

const AppContent: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const { getPlanForClient } = usePlans();
  const { integration, updateIntegration } = useSettings();
  
  // Track explicitly selected role to support post-login selection screen
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const squareAuthed = sessionStorage.getItem('square_oauth_complete') === 'true';
  const hasCode = !!sessionStorage.getItem('square_oauth_code');

  useEffect(() => {
    if (hasCode) {
      async function syncSquareCustomers() {
        try {
          const code = sessionStorage.getItem('square_oauth_code');
          if (!code) return;

          // 1. Exchange OAuth code for access token via Server-side endpoint
          const tokens = await SquareIntegrationService.exchangeCodeForToken(code, integration.environment || 'production');
          
          // 2. Update persistent integration settings
          updateIntegration({
            ...integration,
            squareAccessToken: tokens.accessToken,
            squareRefreshToken: tokens.refreshToken,
            squareMerchantId: tokens.merchantId
          });

          // 3. Fetch live customers from Square API
          const squareCustomers = await SquareIntegrationService.fetchCustomers(tokens.accessToken, integration.environment || 'production');

          // 4. Persist Square customers to database
          if (supabase && squareCustomers.length > 0) {
              const upsertData = squareCustomers.map(c => ({
                  external_id: c.id,
                  name: c.name,
                  email: c.email,
                  phone: c.phone,
                  avatar_url: c.avatarUrl,
                  source: 'square'
              }));

              const { error } = await supabase
                .from('clients')
                .upsert(upsertData, { onConflict: 'external_id' });
              
              if (error) {
                  console.error('Failed to persist Square customers to database:', error);
              }
          }

          localStorage.setItem('square_customers', JSON.stringify(squareCustomers));
          sessionStorage.setItem('square_oauth_complete', 'true');
        } catch (e) {
          console.error('Failed to sync Square customers:', e);
        } finally {
          sessionStorage.removeItem('square_oauth_code');
        }
      }
      syncSquareCustomers();
    }
  }, [hasCode, integration, updateIntegration]);

  // If not authenticated via Supabase AND not authenticated via Square, show login
  if (!isAuthenticated && !squareAuthed && !hasCode) {
    return <LoginScreen onLogin={login} onSelectRole={setSelectedRole} />;
  }

  // If authenticated but NO role is selected, show LoginScreen (Landing Mode)
  if (!selectedRole) {
    return <LoginScreen onLogin={login} onSelectRole={setSelectedRole} />;
  }

  const renderDashboard = () => {
    const effectiveRole = selectedRole;

    if (!effectiveRole) return null;

    switch (effectiveRole) {
      case 'stylist':
        return <StylistDashboard onLogout={logout} />;
      case 'client':
        const myPlan = user?.clientData ? getPlanForClient(user.clientData.id) : null;
        return <ClientDashboard 
                  client={(user?.clientData || (user?.isMock ? CURRENT_CLIENT : null)) as any} 
                  plan={myPlan} 
                  role="client" 
               />;
      case 'admin':
        return <AdminDashboard role="admin" />;
      default:
        return (
          <div className="p-8 text-center">
            <h2 className="text-xl font-black">Unknown role: {effectiveRole}</h2>
            <button onClick={logout} className="mt-4 text-brand-primary font-black underline">Sign Out</button>
          </div>
        );
    }
  };

  return (
    <div className="bg-brand-bg min-h-screen">
      <div className="max-w-md mx-auto bg-white shadow-lg min-h-screen relative pb-12">
        {renderDashboard()}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // ROUTING FIX: Handle callback immediately to prevent context-related crashes
  if (window.location.pathname === '/square/callback') {
    return <SquareCallback />;
  }

  const isDbConnected = !!supabase;
  return (
    <SettingsProvider>
        <AuthProvider>
            <PlanProvider>
                {!isDbConnected ? <SetupScreen /> : <AppContent />}
            </PlanProvider>
        </AuthProvider>
    </SettingsProvider>
  );
};

export default App;
