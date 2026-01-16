import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    let squareAccessToken: string | undefined =
      (req.headers['x-square-access-token'] as string | undefined) ||
      (req.headers['x-square-access-token'.toLowerCase()] as string | undefined);

    if (!squareAccessToken) {
      const authHeader = req.headers['authorization'] as string | undefined;
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

      if (
        bearer &&
        process.env.VITE_SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        const supabaseAdmin = createClient(
          process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: userData } = await supabaseAdmin.auth.getUser(bearer);
        const userId = userData?.user?.id;

        if (userId) {
          const { data: ms } = await supabaseAdmin
            .from('merchant_settings')
            .select('square_access_token')
            .eq('supabase_user_id', userId)
            .maybeSingle();

          squareAccessToken = ms?.square_access_token;
        }
      }
    }

    if (!squareAccessToken) {
      return res.status(401).json({ message: 'Square access token missing.' });
    }

    const squareRes = await fetch('https://connect.squareup.com/v2/customers', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${squareAccessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2023-10-20',
      },
    });

    const json = await squareRes.json();
    if (!squareRes.ok) return res.status(squareRes.status).json(json);

    const customers = json.customers || [];

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const rows = customers.map((c: any) => ({
      name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
      email: c.email_address || null,
      phone: c.phone_number || null,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent([c.given_name, c.family_name].filter(Boolean).join(' ') || 'C')}&background=random`,
      external_id: c.id,
    }));

    if (rows.length > 0) {
      await supabaseAdmin
        .from('clients')
        .upsert(rows, { onConflict: 'external_id' });
    }

    return res.status(200).json({ inserted: rows.length });
  } catch (e: any) {
    console.error('Square clients sync error:', e);
    return res.status(500).json({ message: e.message });
  }
}