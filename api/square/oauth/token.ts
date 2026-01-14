import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const code = body?.code;

    if (!code) {
      return res.status(400).json({ message: 'Missing OAuth code.' });
    }

    const clientId =
      process.env.SQUARE_APPLICATION_ID ||
      process.env.VITE_SQUARE_APPLICATION_ID ||
      process.env.VITE_SQUARE_CLIENT_ID;

    const clientSecret =
      process.env.SQUARE_APPLICATION_SECRET ||
      process.env.VITE_SQUARE_APPLICATION_SECRET ||
      process.env.VITE_SQUARE_CLIENT_SECRET;

    const redirectUri =
      process.env.SQUARE_REDIRECT_URI ||
      process.env.VITE_SQUARE_REDIRECT_URI;

    const env = (process.env.SQUARE_ENV || process.env.VITE_SQUARE_ENV || 'production').toLowerCase();

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        message: 'Missing Square OAuth server configuration (client id/secret/redirect uri).',
      });
    }

    const tokenUrl =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com/oauth2/token'
        : 'https://connect.squareup.com/oauth2/token';

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        message: tokenData?.error_description || tokenData?.error || 'Square token exchange failed.',
        details: tokenData,
      });
    }
    
    const { access_token, merchant_id } = tokenData;
    if (!access_token || !merchant_id) {
      return res.status(500).json({ message: 'Square response missing access_token or merchant_id.' });
    }

    const merchantUrl = env === 'sandbox' ? `https://connect.squareupsandbox.com/v2/merchants/${merchant_id}` : `https://connect.squareup.com/v2/merchants/${merchant_id}`;

    let business_name = 'Admin';
    try {
        const merchantResp = await fetch(merchantUrl, {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/json',
            },
        });

        if (merchantResp.ok) {
            const merchantData = await merchantResp.json();
            business_name = merchantData?.merchant?.business_name || business_name;
        }
    } catch (e) {
        console.error("Could not fetch merchant business name, proceeding with default.", e);
    }
    
    // Construct a unique, non-public email for the Supabase user
    const email = `${merchant_id}@square-oauth.blueprint`;

    return res.status(200).json({
      ...tokenData,
      email,
      business_name,
      merchant_id,
    });

  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'Square token exchange failed.' });
  }
}