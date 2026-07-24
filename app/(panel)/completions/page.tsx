'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, X, Video, RefreshCw } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { fmtDT } from '@/lib/useAdmin';
import { Modal } from '@/components/ui';

const STATUS_TABS = [
  { k: 'pending', label: 'На проверке' },
  { k: 'approved', label: 'Принятые' },
  { k: 'rejected', label: 'Отклонённые' },
  { k: 'all', label: 'Все' },
];

const BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
const BADGE_T: Record<string, string> = { pending: '⏳ На проверке', approved: '✅ Принято', rejected: '❌ Отклонено' };

export default function CompletionsPage() {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [reject, setReject] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = sb
      .from('exercise_completions')
      .select('*, profiles!exercise_completions_user_id_fkey(id, full_name), exercises(id, number, title)')
      .order('created_at', { ascending: tab === 'pending' });
    if (tab !== 'all') q = q.eq('status', tab);
    const { data } = await q.limit(200);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tab]);

  useEffect(() => {
    (async () => {
      const missing = rows.filter((r) => !urls[r.id]);
      if (!missing.length) return;
      const next: Record<string, string> = {};
      await Promise.all(
        missing.map(async (r) => {
          const { data } = await sb.storage.from('submissions').createSignedUrl(r.video_url, 3600);
          if (data?.signedUrl) next[r.id] = data.signedUrl;
        })
      );
      setUrls((u) => ({ ...u, ...next }));
    })();
  }, [rows]);

  const notify = async (userId: string, title: string, body: string) => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: userId, title, body, data: { kind: 'completion' } }),
      });
    } catch {}
  };

  const approve = async (r: any) => {
    if (!confirm(`Принять видео: ${r.profiles?.full_name} · №${r.exercises?.number}?`)) return;
    setBusy(true);
    const { error } = await sb.rpc('review_completion', { p_id: r.id, p_approve: true, p_comment: null });
    setBusy(false);
    if (error) return alert('Ошибка: ' + error.message);
    notify(r.user_id, 'Упражнение принято ✅', `№${r.exercises?.number} · ${r.exercises?.title}`);
    load();
  };

  const doReject = async () => {
    if (comment.trim().length < 10) return;
    setBusy(true);
    const { error } = await sb.rpc('review_completion', { p_id: reject.id, p_approve: false, p_comment: comment.trim() });
    setBusy(false);
    if (error) return alert('Ошибка: ' + error.message);
    notify(reject.user_id, 'Упражнение не принято ❌', `№${reject.exercises?.number}: ${comment.trim().slice(0, 120)}`);
    setReject(null);
    setComment('');
    load();
  };

  const counts = useMemo(() => rows.length, [rows]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="h1 flex items-center gap-2"><Video size={24} /> Проверка видео</h1>
        <button className="btn-ghost" onClick={load}><RefreshCw size={15} /> Обновить</button>
      </div>
      <div className="flex gap-2 mb-6">
        {STATUS_TABS.map((s) => (
          <button
            key={s.k}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${tab === s.k ? 'bg-navy text-paper' : 'bg-sand text-ink/60 hover:text-ink'}`}
            onClick={() => setTab(s.k)}
          >
            {s.label}{tab === s.k ? ` · ${counts}` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-ink/40">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-ink/40">Нет записей</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {rows.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <Link href={`/users/${r.user_id}`} className="font-extrabold hover:text-terra">
                    {r.profiles?.full_name || '—'}
                  </Link>
                  <div className="text-sm text-ink/60 mt-0.5">
                    №{r.exercises?.number} · {r.exercises?.title}
                  </div>
                  <div className="text-xs text-ink/40 mt-1">{fmtDT(r.created_at)}</div>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${BADGE[r.status]}`}>
                  {BADGE_T[r.status]}
                </span>
              </div>
              {urls[r.id] ? (
                <video src={urls[r.id]} controls preload="metadata" className="w-full rounded-xl bg-navy/90 max-h-72" />
              ) : (
                <div className="w-full h-40 rounded-xl bg-sand animate-pulse" />
              )}
              {r.status === 'rejected' && r.admin_comment && (
                <div className="mt-3 text-sm bg-red-50 text-red-800 rounded-lg px-3 py-2">
                  <span className="font-bold">Комментарий:</span> {r.admin_comment}
                </div>
              )}
              {r.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <button className="btn flex-1 justify-center" disabled={busy} onClick={() => approve(r)}>
                    <Check size={15} /> Принять
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 text-white text-sm font-bold py-2.5 hover:bg-red-700 transition disabled:opacity-50"
                    disabled={busy}
                    onClick={() => { setReject(r); setComment(''); }}
                  >
                    <X size={15} /> Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!reject} title="Отклонить видео" onClose={() => setReject(null)}>
        <div className="text-sm text-ink/60 mb-3">
          {reject?.profiles?.full_name} · №{reject?.exercises?.number} {reject?.exercises?.title}
        </div>
        <label className="lbl">Комментарий для спортсмена (обязательно, минимум 10 символов)</label>
        <textarea
          className="input h-28 resize-none"
          placeholder="Почему видео не принято и что нужно исправить…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="text-xs mt-1 mb-4 text-ink/40">{comment.trim().length} / 10</div>
        <button
          className="w-full rounded-xl bg-red-600 text-white font-bold py-3 hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={comment.trim().length < 10 || busy}
          onClick={doReject}
        >
          Отклонить и уведомить
        </button>
      </Modal>
    </div>
  );
}
