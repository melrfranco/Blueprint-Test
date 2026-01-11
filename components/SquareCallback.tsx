
import { useEffect } from 'react';

export default function SquareCallback() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (code) {
        sessionStorage.setItem('square_oauth_code', code);
      }
      if (state) {
        sessionStorage.setItem('square_oauth_state', state);
      }
    } catch (e) {
      console.error('Square callback parse failed', e);
    } finally {
      window.location.replace('/');
    }
  }, []);

  return null;
}
