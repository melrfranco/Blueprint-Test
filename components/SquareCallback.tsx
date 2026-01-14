import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const SquareCallback = () => {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('Completing Square login…');

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorParam = params.get('error_description') || params.get('error');

        if (errorParam) {
          setError(decodeURIComponent(errorParam));
          return;
        }

        if (!code) {
          setError('Missing OAuth code from Square.');
          return;
        }
        
        setMessage('Exchanging credentials with Square...');
        const res = await fetch('/api/square/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (!res.ok || !data?.access_token) {
          setError(data?.message || 'Failed to exchange Square OAuth token.');
          return;
        }

        localStorage.setItem('square_access_token', data.access_token);
        
        const { email, password, merchant_id, business_name } = {
            email: data.email,
            password: data.merchant_id, // Use merchant_id as a stable password
            merchant_id: data.merchant_id,
            business_name: data.business_name
        };

        if (!supabase) {
            setError("Database connection is not configured.");
            return;
        }
        
        if (!email || !password || !merchant_id) {
            setError("Required details (email, merchant_id) not received from server. Cannot complete sign-in.");
            return;
        }

        setMessage('Securing your session...');
        // Try to sign in first, as this is the most common case
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (signInError) {
            // If sign-in fails because user doesn't exist, try to sign up
            if (signInError.message.includes('Invalid login credentials')) {
                setMessage('Creating your secure account...');
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            role: 'admin',
                            merchant_id,
                            business_name: business_name || 'Admin',
                        }
                    }
                });

                if (signUpError) {
                    // If sign-up also fails, show an error
                    setError(`Account creation failed: ${signUpError.message}`);
                    return;
                }
            } else {
                // If sign-in fails for another reason, show an error
                setError(`Sign-in failed: ${signInError.message}`);
                return;
            }
        }
        
        // At this point, the user is signed in, and the onAuthStateChange listener will do the rest.
        setMessage('Redirecting to your dashboard...');
        window.location.replace('/');

      } catch (e: any) {
        setError(e?.message || 'Square OAuth failed.');
      }
    };

    run();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
        <div className="bg-white p-6 rounded-2xl border-4 border-red-600 text-center max-w-sm w-full shadow-lg">
          <h1 className="font-black mb-2 text-red-800">Square Login Failed</h1>
          <p className="text-sm font-bold text-gray-700">{error}</p>
          <a href="/" className="mt-4 inline-block text-xs font-bold text-gray-500 underline">Return to App</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-sans">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-sm font-bold text-gray-700">
          {message}
        </div>
      </div>
    </div>
  );
};

export default SquareCallback;