import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SquareCallback() {
  const navigate = useNavigate();
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      setError('Missing authorization code from Square.');
      return;
    }

    // 🔒 CRITICAL: exchange code ONCE, then redirect away
    fetch('/api/square/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data?.message || 'Square login failed');
        }
        return res.json();
      })
      .then(() => {
        // ✅ SUCCESS — IMMEDIATELY LEAVE CALLBACK PAGE
        navigate('/', { replace: true });
      })
      .catch((err) => {
        console.error('Square OAuth callback failed:', err);
        setError(
          'Square login failed. Please return to the app and try connecting again.'
        );
      });
  }, [navigate]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Connecting Square…</h2>
      <p>Please wait. This may take a moment.</p>
      {error && (
        <p style={{ color: 'red', marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  );
}
