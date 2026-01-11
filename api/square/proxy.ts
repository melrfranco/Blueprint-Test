
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { path, method = 'GET', accessToken, body } = req.body;

  if (!accessToken || typeof accessToken !== 'string') {
    return res.status(401).json({ message: 'Access token is required.' });
  }

  if (!path || typeof path !== 'string' || !path.startsWith('/v2/')) {
    return res.status(400).json({ message: 'A valid Square API v2 path is required.' });
  }

  const { SQUARE_ENV: env = 'production' } = process.env;

  const baseUrl = env === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

  const targetUrl = `${baseUrl}${path}`;

  try {
    const squareResponse = await fetch(targetUrl, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Square-Version': '2023-10-20',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseBody = await squareResponse.text();
    res.setHeader('Content-Type', squareResponse.headers.get('Content-Type') || 'application/json');
    
    return res.status(squareResponse.status).send(responseBody);

  } catch (error) {
    console.error('Error proxying request to Square:', error);
    return res.status(500).json({ message: 'An internal error occurred while proxying the request.' });
  }
}
