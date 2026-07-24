'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileDown, Trash2, Plus, UserX } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { fmtDate, fmtDT } from '@/lib/useAdmin';
import { userPdf } from '@/lib/pdf';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sports, setSports] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [open, setOpen] = useState<string>('');
  const [gf, setGf] = useState({ subject: '', grade: 5, comment: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [pr, se, sp, gr] = await Promise.all([
      sb.from('profiles').select('*').eq('id', id).single(),
      sb.from('sessions').select('*, session_results(*)').eq('user_id', id).order('created_at', { ascending: false }),
      sb.from('sport_results').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      sb.from('grades').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    ]);
    setP(pr.data); setSessions(se.data || []); setSports(sp.data || []); setGrades(gr.data || []);
  };
  useEffect(() => { load(); }, [id]);

  if (!p) return <div className="text-ink/40">Загрузка…</div>;

  const avg = grades.length ? (grades.reduce((s, g) => s + g.grade, 0) / grades.length).toFixed(2) : '—';
  const best = sessions.length ? Math.max(...sessions.map((s) => s.total_points)) : 0;

  const addGrade = async () => {
    if (!gf.subject) return alert('Укажите предмет/упражнение');
    await sb.from('grades').insert({ user_id: id, subject: gf.subject, grade: gf.grade, comment: gf.comment });
    setGf({ subject: '', grade: 5, comment: '' }); load();
  };

  const Stat = ({ label, value }: any) => (
    <div className="card p-4"><div className="text-xl font-extrabold">{value}</div><div className="text-xs text-ink/50 font-semibold mt-0.5">{label}</div></div>
  );

  return (
    <div>
      <button className="flex items-center gap-1.5 text-sm font-bold text-ink/50 hover:text-ink mb-4" onClick={() => router.push('/users')}><ArrowLeft size={15} /> Все пользователи</button>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="h1">{p.full_name || 'Без имени'}</h1>
          <div className="text-sm text-ink/50 mt-1">{p.gender} · {p.age_category} · {p.category} · регистрация {fmtDate(p.created_at)}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-terra" disabled={busy} onClick={async () => { setBusy(true); await userPdf(p, sessions, sports, grades); setBusy(false); }}>
            <FileDown size={16} /> Скачать PDF
          </button>
          <button
            className="flex items-center gap-1.5 rounded-xl bg-red-600 text-white text-sm font-bold px-4 py-2.5 hover:bg-red-700 transition disabled:opacity-50"
            disabled={busy}
            onClick={async () => {
              const reason = prompt(`Удалить аккаунт «${p.full_name}» безвозвратно?\n\nБудут удалены: профиль, результаты, видео, сообщения, файлы.\nУкажите причину удаления (обязательно):`);
              if (reason === null) return;
              if (reason.trim().length < 5) return alert('Причина обязательна (минимум 5 символов)');
              if (!confirm('Последнее подтверждение: удалить аккаунт навсегда?')) return;
              setBusy(true);
              try {
                const { data: { session } } = await sb.auth.getSession();
                const r = await fetch('/api/delete-user', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                  body: JSON.stringify({ user_id: id, reason: reason.trim() }),
                });
                const j = await r.json();
                if (!r.ok || j.error) throw new Error(j.error || 'Ошибка');
                alert('Аккаунт удалён');
                router.replace('/users');
              } catch (e: any) {
                alert('Не удалось удалить: ' + e.message);
                setBusy(false);
              }
            }}
          >
            <UserX size={16} /> Удалить аккаунт
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Сдач ФП" value={sessions.length} />
        <Stat label="Лучший результат" value={best ? `${best} б.` : '—'} />
        <Stat label="Спортивных результатов" value={sports.length} />
        <Stat label="Успеваемость (ср. балл)" value={avg} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <h2 className="font-extrabold mb-3">Результаты сдачи ФП</h2>
          <div className="space-y-2">
            {sessions.length === 0 && <div className="card p-5 text-sm text-ink/40">Нет результатов</div>}
            {sessions.map((s) => (
              <div key={s.id} className="card">
                <button className="w-full px-4 py-3 flex items-center justify-between text-sm" onClick={() => setOpen(open === s.id ? '' : s.id)}>
                  <span className="font-bold">{fmtDT(s.created_at)}</span>
                  <span className="font-extrabold">{s.total_points} б. · <span className="text-terra">{s.level_label}</span></span>
                </button>
                {open === s.id && (
                  <div className="border-t border-sand px-4 py-3 space-y-1.5">
                    {(s.session_results || []).map((r: any) => (
                      <div key={r.id} className="flex justify-between text-xs text-ink/70">
                        <span>{r.exercise_title}</span><span className="font-bold">{r.result} → {r.points} б.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <h2 className="font-extrabold mb-3 mt-8">Спортивные результаты</h2>
          <div className="space-y-2">
            {sports.length === 0 && <div className="card p-5 text-sm text-ink/40">Нет результатов</div>}
            {sports.map((s) => (
              <div key={s.id} className="card px-4 py-3 text-sm">
                <div className="flex justify-between font-bold"><span>{s.event_name}</span><span>{s.total_points} б.</span></div>
                <div className="text-xs text-ink/50 mt-1">{fmtDate(s.created_at)}{s.age_group ? ` · ${s.age_group}` : ''} · {(s.data || []).map((d: any) => `${d.name}: ${d.label}`).join(' · ')}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-extrabold mb-3">Журнал оценок · успеваемость {avg}</h2>
          <div className="card p-4 mb-3">
            <div className="grid grid-cols-4 gap-2">
              <input className="input col-span-2" placeholder="Предмет / упражнение" value={gf.subject} onChange={(e) => setGf({ ...gf, subject: e.target.value })} />
              <select className="input" value={gf.grade} onChange={(e) => setGf({ ...gf, grade: +e.target.value })}>
                {[5, 4, 3, 2].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <button className="btn" onClick={addGrade}><Plus size={14} /> Оценка</button>
            </div>
            <input className="input mt-2" placeholder="Комментарий (необязательно)" value={gf.comment} onChange={(e) => setGf({ ...gf, comment: e.target.value })} />
          </div>
          <div className="space-y-2">
            {grades.map((g) => (
              <div key={g.id} className="card px-4 py-3 flex items-center gap-3 text-sm">
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-extrabold ${g.grade >= 4 ? 'bg-green-100 text-green-700' : g.grade === 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{g.grade}</span>
                <div className="flex-1">
                  <div className="font-bold">{g.subject}</div>
                  <div className="text-xs text-ink/50">{fmtDate(g.created_at)}{g.comment ? ` · ${g.comment}` : ''}</div>
                </div>
                <button className="text-ink/30 hover:text-terra" onClick={async () => { if (confirm('Удалить оценку?')) { await sb.from('grades').delete().eq('id', g.id); load(); } }}><Trash2 size={15} /></button>
              </div>
            ))}
            {grades.length === 0 && <div className="card p-5 text-sm text-ink/40">Оценок пока нет</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
