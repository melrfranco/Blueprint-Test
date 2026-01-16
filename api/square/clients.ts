import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  try {
    let squareAccessToken: string | undefined =
      (req.headers['x-square-access-token'] as string | undefined) ||
      (req.headers['x-square-access-token'.toLowerCase()] as string | undefined);

    const authHeader = req.headers['authorization'] as string | undefined;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (
      !process.env.VITE_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({ message: 'Supabase config missing.' });
    }

    const supabaseAdmin = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let supabaseUserId: string | null = null;

    if (bearer) {
      const { data: userData } = await supabaseAdmin.auth.getUser(bearer);
      supabaseUserId = userData?.user?.id ?? null;

      if (!squareAccessToken && supabaseUserId) {
        const { data: ms } = await supabaseAdmin
          .from('merchant_settings')
          .select('square_access_token')
          .eq('supabase_user_id', supabaseUserId)
          .maybeSingle();

        squareAccessToken = ms?.square_access_token;
      }
    }

    if (!squareAccessToken || !supabaseUserId) {
      return res.status(401).json({
        message: 'Missing Square connection or user context.',
      });
    }

    const squareRes = await fetch(
      'https://connect.squareup.com/v2/customers',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${squareAccessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-10-20',
        },
      }
    );

    const json = await squareRes.json();
    if (!squareRes.ok) {
      return res.status(squareRes.status).json(json);
    }

    const customers = json.customers || [];

    const rows = customers.map((c: any) => ({
      supabase_user_id: supabaseUserId,
      name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
      email: c.email_address || null,
      phone: c.phone_number || null,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent([c.given_name, c.family_name].filter(Boolean).join(' ') || 'C')}&background=random`,
      external_id: c.id,
    }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin
        .from('clients')
        .upsert(rows, { onConflict: 'external_id' });

      if (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    return res.status(200).json({
      inserted: rows.length,
    });
  } catch (e: any) {
    console.error('Square clients sync error:', e);
    return res.status(500).json({ message: e.message });
  }
}