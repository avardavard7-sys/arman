'use client';
import { useEffect, useState } from 'react';
import { X, HelpCircle } from 'lucide-react';
import { sb } from '@/lib/supabase';

export default function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (open) sb.from('help_articles').select('*').order('sort_order').then(({ data }) => setItems(data || []));
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-sand bg-white px-3 py-2 text-sm font-semibold hover:bg-sand/50" title="Справка">
        <HelpCircle size={17} className="text-terra" /> Справка
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-navy/40" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-paper shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-navy text-paper px-5 py-4 flex items-center justify-between">
              <div className="font-extrabold tracking-wide">Справка · Как выполнить действия</div>
              <button onClick={() => setOpen(false)}><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {items.length === 0 && <div className="text-sm text-ink/50">Раздел справки пуст. Добавьте статьи в разделе «Справка».</div>}
              {items.map((a) => (
                <div key={a.id} className="card p-4">
                  <div className="font-bold mb-1.5">{a.title}</div>
                  {a.image_url && <img src={a.image_url} className="rounded-lg mb-2 w-full" alt="" />}
                  {a.video_url && <video src={a.video_url} controls className="rounded-lg mb-2 w-full" />}
                  <div className="text-sm text-ink/70 whitespace-pre-wrap leading-relaxed">{a.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
