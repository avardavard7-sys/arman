'use client';
import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { Field, Upload } from '@/components/ui';
import { fmtDT } from '@/lib/useAdmin';

export default function Broadcast() {
  const [f, setF] = useState({ title: '', body: '', image_url: '', video_url: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => sb.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(30).then(({ data }) => setHistory(data || []));
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!f.title || !f.body) return alert('Заполните заголовок и текст');
    if (!confirm('Отправить push-уведомление ВСЕМ пользователям?')) return;
    setBusy(true); setMsg('');
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(f),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg('Ошибка: ' + (j.error || res.status));
    setMsg(`Отправлено: ${j.sent} из ${j.total} устройств`);
    setF({ title: '', body: '', image_url: '', video_url: '' });
    load();
  };

  return (
    <div>
      <h1 className="h1 mb-6">Рассылка push-уведомлений</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <Field label="Заголовок"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Сообщение"><textarea className="input min-h-[120px]" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <Upload label="Картинка (необязательно)" value={f.image_url} onChange={(v: string) => setF({ ...f, image_url: v })} accept="image/*" />
          <Upload label="Видео (необязательно)" value={f.video_url} onChange={(v: string) => setF({ ...f, video_url: v })} accept="video/*" />
          <button className="btn-terra w-full" onClick={send} disabled={busy}><Send size={15} /> {busy ? 'Отправка…' : 'Отправить всем'}</button>
          {msg && <div className="text-sm font-bold mt-3 text-navy">{msg}</div>}
        </div>
        <div>
          <h2 className="font-extrabold mb-3">История рассылок</h2>
          <div className="space-y-2">
            {history.length === 0 && <div className="card p-5 text-sm text-ink/40">Рассылок пока не было</div>}
            {history.map((b) => (
              <div key={b.id} className="card px-4 py-3 text-sm">
                <div className="flex justify-between"><span className="font-bold">{b.title}</span><span className="text-xs text-ink/40">{fmtDT(b.created_at)}</span></div>
                <div className="text-xs text-ink/60 mt-1">{b.body}</div>
                <div className="text-xs text-terra font-bold mt-1">Доставлено на {b.sent_count} устройств</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
