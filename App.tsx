
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
  const { user, login, logout, isAuthenticated, authInitialized } = useAuth();
  const { getPlanForClient } = usePlans();
  const { integration, updateIntegration } = useSettings();

  // AUTH INITIALIZATION GATE:
  // Do not render anything until the auth state has been confirmed. This prevents
  // a flash of the login screen or a redirect loop on page load.
  if (!authInitialized) {
    return (
        <div className="flex items-center justify-center h-screen">
            <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
  }

  // A user is considered "authenticated" as an admin if a Square token exists.
  // This state is persisted in localStorage via the SettingsContext and fixes the redirect loop.
  const isSquareConnected = !!integration.squareAccessToken;

  // This is a transient flag, only true for the single page load after the OAuth redirect.
  const isPostSquareAuth = sessionStorage.getItem('square_oauth_complete') === 'true';

  useEffect(() => {
    // This effect runs only once, immediately after the OAuth redirect, to exchange the
    // temporary code for a permanent access token.
    if (isPostSquareAuth) {
      // BUG FIX: Immediately clear OAuth markers to prevent this block from running again on refresh.
      const code = sessionStorage.getItem('square_oauth_code');
      sessionStorage.removeItem('square_oauth_code');
      sessionStorage.removeItem('square_oauth_complete');

      async function exchangeCodeAndSyncData() {
        try {
          if (!code) {
            console.warn("Square OAuth sync started, but no auth code was found in session storage.");
            return;
          }

          // 1. Exchange OAuth code for access token
          const tokens = await SquareIntegrationService.exchangeCodeForToken(code, integration.environment || 'production');
          
          // 2. Update persistent integration settings with the new tokens.
          // This state update is critical, as it sets `isSquareConnected` to true for all subsequent renders.
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
          // The session storage flags are cleared upfront, so no further cleanup is needed on failure.
        }
      }
      exchangeCodeAndSyncData();
    }
  // This effect should only run once after the initial authentication flow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPostSquareAuth]);

  // AUTHENTICATION GATE:
  // The app is gated by the AuthProvider's loading state. Once loaded, this check prevents
  // a redirect to the login screen if the user has either a Supabase session (isAuthenticated)
  // or a persisted Square connection (isSquareConnected).
  if (!isAuthenticated && !isSquareConnected) {
      return <LoginScreen onLogin={login} />;
  }

  const renderDashboard = () => {
    // ROLE RESOLUTION:
    // A Supabase user's role takes precedence. If no Supabase user is logged in,
    // the presence of a Square connection implies an 'admin' role.
    const effectiveRole = user?.role || (isSquareConnected ? 'admin' : null);

    if (!effectiveRole) {
      // This state can occur briefly during logout. Returning null is safe because the
      // auth gate above will redirect to the login screen if no session is established.
      return null;
    }

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
