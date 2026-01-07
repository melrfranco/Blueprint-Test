
import React, { useEffect } from 'react';

const SquareCallback: React.FC = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    console.log('Square OAuth callback received:', { code, state });

    // Token exchange will be implemented next
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
        <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-6"></div>
            <h1 className="text-2xl font-bold text-gray-800">Connecting to Square…</h1>
            <p className="text-gray-600 mt-2">Please wait.</p>
        </div>
    </div>
  );
};

export default SquareCallback;
