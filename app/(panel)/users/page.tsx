'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, FileDown } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { fmtDate } from '@/lib/useAdmin';
import { allUsersPdf } from '@/lib/pdf';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [u, s, g] = await Promise.all([
        sb.from('profiles').select('*').order('created_at', { ascending: false }),
        sb.from('sessions').select('user_id,total_points,level_label'),
        sb.from('grades').select('user_id,grade'),
      ]);
      setUsers(u.data || []); setSessions(s.data || []); setGrades(g.data || []);
    })();
  }, []);

  const rows = useMemo(() => {
    const byUser: any = {};
    sessions.forEach((s) => {
      const b = byUser[s.user_id] || { best: 0, level: '', count: 0 };
      b.count++;
      if (s.total_points >= b.best) { b.best = s.total_points; b.level = s.level_label; }
      byUser[s.user_id] = b;
    });
    const gByUser: any = {};
    grades.forEach((g) => { (gByUser[g.user_id] ||= []).push(g.grade); });
    return users
      .map((u) => {
        const b = byUser[u.id] || { best: 0, level: '', count: 0 };
        const gl = gByUser[u.id] || [];
        return { ...u, ...b, avg: gl.length ? (gl.reduce((a: number, x: number) => a + x, 0) / gl.length).toFixed(1) : '' };
      })
      .filter((u) => !q || (u.full_name || '').toLowerCase().includes(q.toLowerCase()));
  }, [users, sessions, grades, q]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="h1">Пользователи <span className="text-ink/40 text-lg">· {rows.length}</span></h1>
        <button className="btn-terra" disabled={busy} onClick={async () => { setBusy(true); await allUsersPdf(rows); setBusy(false); }}>
          <FileDown size={16} /> Скачать всех в PDF
        </button>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search size={16} className="absolute left-3.5 top-3 text-ink/35" />
        <input className="input pl-10" placeholder="Поиск по ФИО…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto -mx-1 px-1"><table className="w-full text-sm">
          <thead>
            <tr className="bg-navy text-paper text-left text-xs uppercase tracking-wider">
              <th className="px-5 py-3">ФИО</th><th className="px-3 py-3">Пол</th><th className="px-3 py-3">Возрастная категория</th>
              <th className="px-3 py-3">Сдач</th><th className="px-3 py-3">Лучший</th><th className="px-3 py-3">Ср. оценка</th><th className="px-3 py-3">Регистрация</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-sand/30">
                <td className="px-5 py-3">
                  <Link href={`/users/${u.id}`} className="font-bold text-navy hover:text-terra">{u.full_name || 'Без имени'}</Link>
                  {u.role === 'admin' && <span className="ml-2 text-[10px] font-bold bg-gold/20 text-gold px-1.5 py-0.5 rounded">ADMIN</span>}
                </td>
                <td className="px-3 py-3 text-ink/60">{u.gender}</td>
                <td className="px-3 py-3 text-ink/60">{u.age_category}</td>
                <td className="px-3 py-3">{u.count || '—'}</td>
                <td className="px-3 py-3 font-bold">{u.best ? `${u.best} б.` : '—'}</td>
                <td className="px-3 py-3">{u.avg || '—'}</td>
                <td className="px-3 py-3 text-ink/60">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-ink/40">Пользователи не найдены</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
