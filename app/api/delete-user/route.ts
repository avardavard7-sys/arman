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

    const { user_id, reason } = await req.json();
    if (!user_id) return Response.json({ error: 'user_id обязателен' }, { status: 400 });
    if (user_id === user.id) return Response.json({ error: 'Нельзя удалить собственный аккаунт из панели' }, { status: 400 });

    const { data: target } = await admin.from('profiles').select('full_name').eq('id', user_id).single();

    await admin.from('audit_log').insert({
      admin_id: user.id,
      action: 'account_admin_delete',
      target_user_id: user_id,
      reason: reason || null,
      meta: { full_name: target?.full_name || null },
    });

    const wipeFolder = async (bucket: string, prefix: string) => {
      try {
        const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        if (files?.length) {
          await admin.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`));
        }
      } catch {}
    };

    await wipeFolder('submissions', user_id);
    await wipeFolder('avatars', user_id);

    try {
      const { data: convs } = await admin
        .from('conversations')
        .select('id')
        .or(`participant_1.eq.${user_id},participant_2.eq.${user_id}`);
      for (const c of convs || []) {
        await wipeFolder('chat-media', `${c.id}/${user_id}`);
      }
    } catch {}

    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
