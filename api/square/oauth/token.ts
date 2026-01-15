import { createClient } from '@supabase/supabase-js';

const squareFetch = async (
  url: string,
  accessToken: string,
  init: RequestInit = {}
) => {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2023-10-20',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.errors?.[0]?.detail || 'Square API error');
  }
  return json;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const code =
      req.body?.code ??
      (typeof req.query?.code === 'string' ? req.query.code : undefined);

    if (!code) {
      return res.status(400).json({ message: 'Missing OAuth code' });
    }

    const env = (process.env.VITE_SQUARE_ENV || 'production').toLowerCase();
    const baseUrl =
      env === 'sandbox'
        ? 'https://connect.squareupsandbox.com'
        : 'https://connect.squareup.com';

    /* =======================
       1. OAuth token exchange
       ======================= */

    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.VITE_SQUARE_APPLICATION_ID,
        client_secret: process.env.VITE_SQUARE_APPLICATION_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.VITE_SQUARE_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Square OAuth failed:', tokenData);
      return res.status(401).json({
        message: 'Failed to exchange Square OAuth token',
        square_error: tokenData,
      });
    }

    const { access_token, merchant_id } = tokenData;

    /* =======================
       2. Merchant info
       ======================= */

    const merchantResp = await squareFetch(
      `${baseUrl}/v2/merchants/${merchant_id}`,
      access_token
    );

    const business_name =
      merchantResp?.merchant?.business_name ?? 'Admin';

    /* =======================
       3. Supabase admin client
       ======================= */

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const email = `${merchant_id}@square-oauth.blueprint`;
    const password = merchant_id;

    let { data: { user }, error } =
      await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const signUp = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'admin', merchant_id, business_name },
        },
      });
      if (signUp.error) throw signUp.error;
      user = signUp.data.user;
    }

    if (!user) throw new Error('Supabase auth failed');

    /* =======================
       4. TEAM SYNC (server-side)
       ======================= */

    const teamData = await squareFetch(
      `${baseUrl}/v2/team-members/search`,
      access_token,
      {
        method: 'POST',
        body: JSON.stringify({
          query: { filter: { status: 'ACTIVE' } },
        }),
      }
    );

    if (teamData.team_members?.length) {
      await supabase
        .from('square_team_members')
        .upsert(
          teamData.team_members.map((m: any) => ({
            supabase_user_id: user.id,
            square_team_member_id: m.id,
            name: `${m.given_name ?? ''} ${m.family_name ?? ''}`.trim(),
            email: m.email_address ?? null,
            role: m.is_owner ? 'Owner' : 'Team Member',
          })),
          { onConflict: 'square_team_member_id' }
        );
    }

    /* =======================
       5. CUSTOMER SYNC (server-side)
       ======================= */

    let cursor: string | undefined;

    do {
      const customers = await squareFetch(
        `${baseUrl}/v2/customers${cursor ? `?cursor=${cursor}` : ''}`,
        access_token
      );

      if (customers.customers?.length) {
        await supabase
          .from('clients')
          .upsert(
            customers.customers.map((c: any) => ({
              external_id: c.id,
              name:
                `${c.given_name ?? ''} ${c.family_name ?? ''}`.trim() ||
                c.email_address ||
                'Unnamed Client',
              email: c.email_address ?? null,
              phone: c.phone_number ?? null,
              source: 'square',
            })),
            { onConflict: 'external_id' }
          );
      }

      cursor = customers.cursor;
    } while (cursor);

    /* =======================
       6. Done
       ======================= */

    return res.status(200).json({
      merchant_id,
      business_name,
      access_token, // Added to ensure frontend can use it if needed for direct calls
    });

  } catch (err: any) {
    console.error('Square OAuth / Sync error:', err);
    return res.status(500).json({ message: err.message });
  }
}
