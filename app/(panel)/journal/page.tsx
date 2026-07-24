'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Trash2 } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { fmtDate } from '@/lib/useAdmin';

export default function Journal() {
  const [users, setUsers] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [exs, setExs] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<any>(null);
  const [gf, setGf] = useState({ subject: '', grade: 5, comment: '' });

  const load = async () => {
    const [u, g, e] = await Promise.all([
      sb.from('profiles').select('id,full_name,age_category').order('full_name'),
      sb.from('grades').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      sb.from('exercises').select('number,title').order('number'),
    ]);
    setUsers(u.data || []); setGrades(g.data || []); setExs(e.data || []);
  };
  useEffect(() => { load(); }, []);

  const found = useMemo(
    () => (q ? users.filter((u) => (u.full_name || '').toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []),
    [q, users]
  );
  const userGrades = grades.filter((g) => g.user_id === sel?.id);
  const avg = userGrades.length ? (userGrades.reduce((s, g) => s + g.grade, 0) / userGrades.length).toFixed(2) : '—';

  const add = async () => {
    if (!sel) return alert('Выберите пользователя');
    if (!gf.subject) return alert('Укажите предмет/упражнение');
    await sb.from('grades').insert({ user_id: sel.id, ...gf });
    setGf({ subject: '', grade: 5, comment: '' }); load();
  };

  return (
    <div>
      <h1 className="h1 mb-6">Журнал успеваемости</h1>
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="card p-5">
            <label className="lbl">Пользователь</label>
            {sel ? (
              <div className="flex items-center justify-between bg-sand/50 rounded-xl px-4 py-3">
                <div><div className="font-bold">{sel.full_name}</div><div className="text-xs text-ink/50">Успеваемость: {avg}</div></div>
                <button className="text-sm font-bold text-terra" onClick={() => setSel(null)}>Сменить</button>
              </div>
            ) : (
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3 text-ink/35" />
                <input className="input pl-10" placeholder="Поиск по ФИО…" value={q} onChange={(e) => setQ(e.target.value)} />
                {found.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full card divide-y divide-sand overflow-hidden">
                    {found.map((u) => (
                      <button key={u.id} className="w-full text-left px-4 py-2.5 text-sm hover:bg-sand/40" onClick={() => { setSel(u); setQ(''); }}>
                        <span className="font-bold">{u.full_name || 'Без имени'}</span> <span className="text-ink/40 text-xs">· {u.age_category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5">
              <label className="lbl">Предмет / упражнение</label>
              <input className="input" list="exlist" value={gf.subject} onChange={(e) => setGf({ ...gf, subject: e.target.value })} placeholder="Например: №4 Подтягивание" />
              <datalist id="exlist">{exs.map((e, i) => <option key={i} value={`№${e.number} ${e.title}`} />)}</datalist>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[5, 4, 3, 2].map((g) => (
                  <button key={g} className={`rounded-xl py-2.5 font-extrabold border ${gf.grade === g ? 'bg-navy text-paper border-navy' : 'bg-white border-sand hover:bg-sand/40'}`} onClick={() => setGf({ ...gf, grade: g })}>{g}</button>
                ))}
              </div>
              <input className="input mt-3" placeholder="Комментарий" value={gf.comment} onChange={(e) => setGf({ ...gf, comment: e.target.value })} />
              <button className="btn w-full mt-3" onClick={add}><Plus size={15} /> Выставить оценку</button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-extrabold mb-3">{sel ? `Оценки: ${sel.full_name}` : 'Последние оценки'}</h2>
          <div className="space-y-2">
            {(sel ? userGrades : grades.slice(0, 20)).map((g) => (
              <div key={g.id} className="card px-4 py-3 flex items-center gap-3 text-sm">
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-extrabold shrink-0 ${g.grade >= 4 ? 'bg-green-100 text-green-700' : g.grade === 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{g.grade}</span>
                <div className="flex-1">
                  {!sel && <Link href={`/users/${g.user_id}`} className="font-bold text-navy hover:text-terra">{g.profiles?.full_name || '—'}</Link>}
                  <div className={sel ? 'font-bold' : 'text-xs text-ink/60'}>{g.subject}</div>
                  <div className="text-xs text-ink/50">{fmtDate(g.created_at)}{g.comment ? ` · ${g.comment}` : ''}</div>
                </div>
                <button className="text-ink/30 hover:text-terra" onClick={async () => { if (confirm('Удалить оценку?')) { await sb.from('grades').delete().eq('id', g.id); load(); } }}><Trash2 size={15} /></button>
              </div>
            ))}
            {(sel ? userGrades : grades).length === 0 && <div className="card p-5 text-sm text-ink/40">Оценок пока нет</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
