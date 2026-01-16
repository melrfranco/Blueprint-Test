import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    const authHeader = req.headers['authorization'] as string | undefined;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (
      !bearer ||
      !process.env.VITE_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(401).json({
        error: 'Missing Supabase authentication for Square team request.',
      });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(bearer);

    const userId = userData?.user?.id;

    if (userErr || !userId) {
      return res.status(401).json({ error: 'Invalid Supabase user.' });
    }

    const { data: ms } = await supabaseAdmin
      .from('merchant_settings')
      .select('square_access_token')
      .eq('supabase_user_id', userId)
      .maybeSingle();

    const squareAccessToken = ms?.square_access_token;

    if (!squareAccessToken) {
      return res.status(401).json({
        error: 'Square not connected for this account.',
      });
    }

    const squareRes = await fetch(
      'https://connect.squareup.com/v2/team-members/search',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-20',
        },
        body: JSON.stringify({
          query: {
            filter: {
              status: 'ACTIVE',
            },
          },
        }),
      }
    );

    const json = await squareRes.json();

    if (!squareRes.ok) {
      return res.status(squareRes.status).json(json);
    }

    return res.status(200).json(json);
  } catch (err: any) {
    console.error('Error in /api/square/team:', err);
    return res.status(500).json({ error: err.message });
  }
}