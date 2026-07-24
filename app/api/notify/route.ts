import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!token) return Response.json({ error: 'Нет авторизации' }, { status: 401 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return Response.json({ error: 'Нет авторизации' }, { status: 401 });
    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'admin' && prof?.role !== 'coach')
      return Response.json({ error: 'Только для администраторов' }, { status: 403 });

    const { user_id, title, body, data } = await req.json();
    if (!user_id || !title || !body) return Response.json({ error: 'user_id, title и body обязательны' }, { status: 400 });

    const { data: tokens } = await admin.from('push_tokens').select('expo_token').eq('user_id', user_id);
    const msgs = (tokens || [])
      .filter((t) => t.expo_token?.startsWith('ExponentPushToken'))
      .map((t) => ({ to: t.expo_token, sound: 'default', title, body, data: data || {} }));

    if (!msgs.length) return Response.json({ ok: true, sent: 0 });

    const r = await fetch('https://exp.host/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgs),
    });
    return Response.json({ ok: r.ok, sent: r.ok ? msgs.length : 0 });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
