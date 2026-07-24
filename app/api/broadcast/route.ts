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
    if (prof?.role !== 'admin') return Response.json({ error: 'Только для администраторов' }, { status: 403 });

    const { title, body, image_url, video_url } = await req.json();
    if (!title || !body) return Response.json({ error: 'Пустое сообщение' }, { status: 400 });

    const { data: tokens } = await admin.from('push_tokens').select('expo_token');
    const msgs = (tokens || [])
      .filter((t) => t.expo_token?.startsWith('ExponentPushToken'))
      .map((t) => ({ to: t.expo_token, sound: 'default', title, body, data: { image_url, video_url } }));

    let sent = 0;
    for (let i = 0; i < msgs.length; i += 99) {
      const chunk = msgs.slice(i, i + 99);
      const r = await fetch('https://exp.host/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (r.ok) sent += chunk.length;
    }

    await admin.from('broadcasts').insert({ title, body, image_url: image_url || null, video_url: video_url || null, sent_count: sent });
    return Response.json({ ok: true, sent, total: msgs.length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
