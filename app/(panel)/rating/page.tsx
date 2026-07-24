'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { sb } from '@/lib/supabase';

export default function Rating() {
  const [users, setUsers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [u, s] = await Promise.all([
        sb.from('profiles').select('id,full_name,age_category,gender'),
        sb.from('sessions').select('user_id,total_points,level_label'),
      ]);
      setUsers(u.data || []); setSessions(s.data || []);
    })();
  }, []);

  const rows = useMemo(() => {
    const by: any = {};
    sessions.forEach((s) => {
      const b = by[s.user_id] || { best: 0, level: '', count: 0, sum: 0 };
      b.count++; b.sum += s.total_points;
      if (s.total_points >= b.best) { b.best = s.total_points; b.level = s.level_label; }
      by[s.user_id] = b;
    });
    return users
      .map((u) => ({ ...u, ...(by[u.id] || { best: 0, level: '', count: 0, sum: 0 }) }))
      .filter((u) => u.count > 0)
      .sort((a, b) => b.best - a.best || b.sum - a.sum);
  }, [users, sessions]);

  const medal = ['bg-gold text-navy', 'bg-ink/20 text-ink', 'bg-terra/80 text-white'];

  return (
    <div>
      <h1 className="h1 mb-6">Рейтинг · лучшие пользователи</h1>
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {rows.slice(0, 3).map((u, i) => (
          <Link key={u.id} href={`/users/${u.id}`} className="card p-5 hover:shadow-md transition relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-16 h-16 -mr-6 -mt-6 rotate-12 ${medal[i]} flex items-end justify-start pl-2 pb-1 font-extrabold`}>{i + 1}</div>
            <Trophy size={22} className={i === 0 ? 'text-gold' : 'text-ink/30'} />
            <div className="font-extrabold mt-3">{u.full_name || 'Без имени'}</div>
            <div className="text-xs text-ink/50 mt-1">{u.age_category}</div>
            <div className="text-2xl font-extrabold mt-3">{u.best} б.</div>
            <div className="text-xs text-terra font-bold">{u.level} · сдач: {u.count}</div>
          </Link>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto -mx-1 px-1"><table className="w-full text-sm">
          <thead><tr className="bg-navy text-paper text-left text-xs uppercase tracking-wider">
            <th className="px-5 py-3">#</th><th className="px-3 py-3">ФИО</th><th className="px-3 py-3">Лучший результат</th><th className="px-3 py-3">Уровень</th><th className="px-3 py-3">Всего сдач</th><th className="px-3 py-3">Сумма баллов</th>
          </tr></thead>
          <tbody className="divide-y divide-sand">
            {rows.map((u, i) => (
              <tr key={u.id} className="hover:bg-sand/30">
                <td className="px-5 py-3 font-extrabold text-ink/40">{i + 1}</td>
                <td className="px-3 py-3"><Link href={`/users/${u.id}`} className="font-bold text-navy hover:text-terra">{u.full_name || 'Без имени'}</Link></td>
                <td className="px-3 py-3 font-bold">{u.best} б.</td>
                <td className="px-3 py-3 text-terra font-semibold">{u.level}</td>
                <td className="px-3 py-3">{u.count}</td>
                <td className="px-3 py-3 text-ink/60">{u.sum}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-ink/40">Пока нет сдач ФП</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
