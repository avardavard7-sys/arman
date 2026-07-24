'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScrollText, RefreshCw } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { fmtDT } from '@/lib/useAdmin';

const ACTION_LABEL: Record<string, { t: string; cls: string }> = {
  completion_approved: { t: 'Видео принято', cls: 'bg-green-100 text-green-700' },
  completion_rejected: { t: 'Видео отклонено', cls: 'bg-red-100 text-red-700' },
  account_self_delete: { t: 'Самоудаление аккаунта', cls: 'bg-amber-100 text-amber-700' },
  account_admin_delete: { t: 'Аккаунт удалён админом', cls: 'bg-red-100 text-red-700' },
};

export default function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300);
    const list = data || [];
    setRows(list);
    const ids = Array.from(new Set(list.flatMap((r: any) => [r.admin_id, r.target_user_id]).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await sb.from('profiles').select('id, full_name').in('id', ids);
      setNames(Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name])));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="h1 flex items-center gap-2"><ScrollText size={24} /> Аудит действий</h1>
        <button className="btn-ghost" onClick={load}><RefreshCw size={15} /> Обновить</button>
      </div>
      {loading ? (
        <div className="text-ink/40">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-ink/40">Журнал пуст</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const a = ACTION_LABEL[r.action] || { t: r.action, cls: 'bg-sand text-ink/70' };
            return (
              <div key={r.id} className="card px-4 py-3 flex items-center gap-4 text-sm">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${a.cls}`}>{a.t}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {names[r.admin_id] || 'Система'}
                    {r.target_user_id && (
                      <>
                        {' → '}
                        <Link href={`/users/${r.target_user_id}`} className="text-terra hover:underline">
                          {names[r.target_user_id] || r.target_user_id.slice(0, 8)}
                        </Link>
                      </>
                    )}
                  </div>
                  {r.reason && <div className="text-xs text-ink/50 truncate mt-0.5">{r.reason}</div>}
                </div>
                <div className="text-xs text-ink/40 whitespace-nowrap">{fmtDT(r.created_at)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
