'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Dumbbell, Newspaper, Activity } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { fmtDT } from '@/lib/useAdmin';

export default function Dashboard() {
  const [st, setSt] = useState<any>({});
  const [last, setLast] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [u, e, n, s] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }),
        sb.from('exercises').select('id', { count: 'exact', head: true }),
        sb.from('news').select('id', { count: 'exact', head: true }),
        sb.from('sessions').select('id', { count: 'exact', head: true }),
      ]);
      setSt({ users: u.count, ex: e.count, news: n.count, sessions: s.count });
      const { data } = await sb.from('sessions').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(8);
      setLast(data || []);
    })();
  }, []);

  const Card = ({ icon: Icon, label, value, href }: any) => (
    <Link href={href} className="card p-5 flex items-center gap-4 hover:shadow-md transition">
      <div className="w-11 h-11 rounded-xl bg-navy flex items-center justify-center"><Icon size={20} className="text-gold" /></div>
      <div>
        <div className="text-2xl font-extrabold leading-none">{value ?? '—'}</div>
        <div className="text-xs text-ink/50 font-semibold mt-1">{label}</div>
      </div>
    </Link>
  );

  return (
    <div>
      <h1 className="h1 mb-6">Дашборд</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card icon={Users} label="Пользователей" value={st.users} href="/users" />
        <Card icon={Activity} label="Сдач ФП" value={st.sessions} href="/rating" />
        <Card icon={Dumbbell} label="Упражнений" value={st.ex} href="/exercises" />
        <Card icon={Newspaper} label="Новостей" value={st.news} href="/news" />
      </div>
      <h2 className="font-extrabold mb-3">Последние сдачи ФП</h2>
      <div className="card divide-y divide-sand">
        {last.length === 0 && <div className="p-6 text-sm text-ink/40">Пока нет сдач</div>}
        {last.map((s) => (
          <div key={s.id} className="px-5 py-3.5 flex items-center justify-between text-sm">
            <div className="font-semibold">{s.profiles?.full_name || 'Пользователь'}</div>
            <div className="text-ink/50">{fmtDT(s.created_at)}</div>
            <div className="font-bold">{s.total_points} б. · <span className="text-terra">{s.level_label}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
