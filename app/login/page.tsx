'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { sb } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setErr('');
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error || !data.user) { setBusy(false); return setErr('Неверный email или пароль'); }
    const { data: p } = await sb.from('profiles').select('role').eq('id', data.user.id).single();
    if (p?.role !== 'admin') { await sb.auth.signOut(); setBusy(false); return setErr('Доступ только для администраторов'); }
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <ShieldCheck className="text-gold" size={30} />
          </div>
          <div className="text-paper text-3xl font-extrabold tracking-[0.3em]">ВОЕНФП</div>
          <div className="text-paper/50 text-sm mt-1.5">Командный пункт · админ-панель</div>
        </div>
        <div className="card p-6">
          <label className="lbl">Email</label>
          <input className="input mb-4" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <label className="lbl">Пароль</label>
          <input className="input mb-4" type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          {err && <div className="text-terra text-sm font-semibold mb-3">{err}</div>}
          <button className="btn w-full" onClick={submit} disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
        </div>
      </div>
    </div>
  );
}
