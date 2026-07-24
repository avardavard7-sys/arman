'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb } from './supabase';

export function useAdmin() {
  const router = useRouter();
  const [state, set] = useState<{ loading: boolean; user: any }>({ loading: true, user: null });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return router.replace('/login');
      const { data: p } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if (p?.role !== 'admin') { await sb.auth.signOut(); return router.replace('/login'); }
      set({ loading: false, user: p });
    })();
  }, []);

  return state;
}

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDT = (d: string) =>
  new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
