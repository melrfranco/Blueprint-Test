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
        message: 'Missing Supabase authentication.',
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
      return res.status(401).json({ message: 'Invalid Supabase user.' });
    }

    const { data: ms } = await supabaseAdmin
      .from('merchant_settings')
      .select('square_access_token')
      .eq('supabase_user_id', userId)
      .maybeSingle();

    const squareAccessToken = ms?.square_access_token;

    if (!squareAccessToken) {
      return res.status(401).json({
        message: 'Square not connected for this account.',
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

    const squareJson = await squareRes.json();

    if (!squareRes.ok) {
      return res.status(squareRes.status).json(squareJson);
    }

    const customers = squareJson?.customers || [];

    if (customers.length === 0) {
      return res.status(200).json({ inserted: 0 });
    }

    const rows = customers.map((c: any) => ({
      name: [c.given_name, c.family_name].filter(Boolean).join(' ') || 'Client',
      email: c.email_address || null,
      phone: c.phone_number || null,
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent([c.given_name, c.family_name].filter(Boolean).join(' ') || 'C')}&background=random`,
      external_id: c.id,
    }));

    const { error: upsertErr } = await supabaseAdmin
      .from('clients')
      .upsert(rows, { onConflict: 'external_id' });

    if (upsertErr) {
      return res.status(500).json({ message: upsertErr.message });
    }

    return res.status(200).json({
      inserted: rows.length,
    });
  } catch (e: any) {
    console.error('Square clients sync error:', e);
    return res.status(500).json({ message: e.message });
  }
}