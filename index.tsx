
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const isSquareCallback = window.location.pathname.startsWith('/square/callback');

if (isSquareCallback) {
  // On the callback route, we must not mount the full React app, as it can cause
  // race conditions and errors before the DOM is fully ready in the sandboxed
  // redirect context. This was the source of the "white screen" crash.
  // Instead, we perform the necessary session storage operations directly
  // and then immediately redirect to the root of the application. The full app will
  // bootstrap correctly on the subsequent page load.
  console.log('[Square OAuth] Callback route detected — delaying app bootstrap');
  
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const lastProcessedCode = sessionStorage.getItem('last_processed_square_code');

  // BUG FIX: Prevent re-processing a stale or duplicate authorization code.
  if (code && code === lastProcessedCode) {
    console.warn('[Square OAuth] Duplicate auth code detected. Ignoring and redirecting home.');
    window.location.replace('/');
  } else if (code) {
    sessionStorage.setItem('square_oauth_complete', 'true');
    sessionStorage.setItem('square_oauth_code', code);
    // Mark this code as processed to prevent reuse.
    sessionStorage.setItem('last_processed_square_code', code);
    window.location.replace('/');
  } else {
    console.error('[Square OAuth] Callback reached without an authorization code.');
    window.location.replace('/');
  }
  
} else {
  // Standard application bootstrap for all other routes.
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
