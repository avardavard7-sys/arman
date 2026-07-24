'use client';
import { X } from 'lucide-react';
import { useState } from 'react';
import { sb } from '@/lib/supabase';

export function Modal({ open, title, onClose, children, wide }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-6 mt-10`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: any) {
  return (
    <div className="mb-4">
      <label className="lbl">{label}</label>
      {children}
    </div>
  );
}

export function Upload({ label, value, onChange, accept }: any) {
  const [busy, setBusy] = useState(false);
  const pick = async (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const path = `${Date.now()}-${f.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await sb.storage.from('media').upload(path, f);
    if (!error) {
      const { data } = sb.storage.from('media').getPublicUrl(path);
      onChange(data.publicUrl);
    } else alert('Ошибка загрузки: ' + error.message);
    setBusy(false);
    e.target.value = '';
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input className="input flex-1" placeholder="URL или загрузите файл" value={value || ''} onChange={(e) => onChange(e.target.value)} />
        <label className="btn-ghost cursor-pointer whitespace-nowrap">
          {busy ? 'Загрузка…' : 'Файл'}
          <input type="file" accept={accept} className="hidden" onChange={pick} disabled={busy} />
        </label>
        {value && <button className="text-terra text-sm font-semibold" onClick={() => onChange('')}>×</button>}
      </div>
      {value && accept?.startsWith('image') && <img src={value} className="mt-2 h-20 rounded-lg object-cover" alt="" />}
    </Field>
  );
}

export function Empty({ text }: any) {
  return <div className="card p-10 text-center text-ink/40 text-sm">{text}</div>;
}
