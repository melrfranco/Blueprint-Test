
import React, { useEffect } from 'react';
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
import { SquareIntegrationService } from './services/squareIntegration';

const AppContent: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const { getPlanForClient } = usePlans();
  const { integration, updateIntegration } = useSettings();

  // The 'square_oauth_complete' flag is set in index.tsx before redirect.
  // We check it here after the app has loaded on the root path.
  const squareAuthed = sessionStorage.getItem('square_oauth_complete') === 'true';

  useEffect(() => {
    // This effect now runs safely after the redirect, once the main app is mounted.
    if (squareAuthed) {
      // BUG FIX: Immediately clear OAuth markers to prevent an infinite loop on refresh.
      // The code is captured into a local constant for a single, one-time use.
      const code = sessionStorage.getItem('square_oauth_code');
      sessionStorage.removeItem('square_oauth_code');
      sessionStorage.removeItem('square_oauth_complete');

      async function syncSquareCustomers() {
        try {
          if (!code) {
            console.warn("Square OAuth sync started, but no auth code was found in session storage.");
            return;
          }

          // 1. Exchange OAuth code for access token
          const tokens = await SquareIntegrationService.exchangeCodeForToken(code, integration.environment || 'production');
          
          // 2. Update persistent integration settings with the new tokens
          updateIntegration({
            ...integration,
            squareAccessToken: tokens.accessToken,
            squareRefreshToken: tokens.refreshToken,
            squareMerchantId: tokens.merchantId
          });

          // 3. Fetch live customers from Square API
          const squareCustomers = await SquareIntegrationService.fetchCustomers(tokens.accessToken, integration.environment || 'production');

          // 4. Persist Square customers to the application's database
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
              } else {
                  console.log(`Successfully synced ${squareCustomers.length} customers from Square to database.`);
              }
          }

          // Store in localStorage for immediate frontend selector availability
          localStorage.setItem(
            'square_customers',
            JSON.stringify(squareCustomers)
          );
          
        } catch (e) {
          console.error('Failed to sync Square customers:', e);
          // Keys are already cleared upfront, so no further cleanup is needed on failure.
        }
      }
      syncSquareCustomers();
    }
  // This effect should only run once after the initial authentication flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareAuthed]);

  if (!isAuthenticated && !squareAuthed) {
      return <LoginScreen onLogin={login} />;
  }

  const renderDashboard = () => {
    // Square-auth users are treated as ADMIN role if no other user is logged in
    const effectiveRole = user?.role || (squareAuthed ? 'admin' : null);

    if (!effectiveRole) return null;

    switch (effectiveRole) {
      case 'stylist':
        return <StylistDashboard 
                  onLogout={logout} 
               />;
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
        return <div>Unknown role</div>;
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
  // Basic check for connection config existence
  const isDbConnected = !!supabase;
  
  // The routing for '/square/callback' has been moved to index.tsx to prevent
  // the React app from mounting on that route, which was causing a crash.
  
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
