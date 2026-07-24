'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { Modal, Field, Upload, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/useAdmin';

export default function News() {
  const [items, setItems] = useState<any[]>([]);
  const [modal, setModal] = useState<any>(null);

  const load = () => sb.from('news').select('*').order('created_at', { ascending: false }).then(({ data }) => setItems(data || []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!modal.title) return alert('Укажите заголовок');
    const row = { title: modal.title, body: modal.body || '', image_url: modal.image_url || null, video_url: modal.video_url || null };
    if (modal.id) await sb.from('news').update(row).eq('id', modal.id);
    else await sb.from('news').insert(row);
    setModal(null); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="h1">Новости</h1>
        <button className="btn" onClick={() => setModal({ title: '', body: '' })}><Plus size={15} /> Новость</button>
      </div>
      {items.length === 0 ? <Empty text="Новостей пока нет" /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((n) => (
            <div key={n.id} className="card overflow-hidden flex flex-col">
              {n.image_url && <img src={n.image_url} className="h-36 w-full object-cover" alt="" />}
              <div className="p-4 flex-1">
                <div className="text-xs text-ink/40 font-bold mb-1">{fmtDate(n.created_at)}</div>
                <div className="font-extrabold">{n.title}</div>
                {n.body && <div className="text-xs text-ink/60 mt-1.5 line-clamp-3">{n.body}</div>}
              </div>
              <div className="px-4 pb-4 flex gap-3">
                <button className="text-ink/40 hover:text-ink" onClick={() => setModal({ ...n })}><Pencil size={16} /></button>
                <button className="text-ink/40 hover:text-terra" onClick={async () => { if (confirm('Удалить новость?')) { await sb.from('news').delete().eq('id', n.id); load(); } }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!modal} title={modal?.id ? 'Новость' : 'Новая новость'} onClose={() => setModal(null)}>
        {modal && (
          <div>
            <Field label="Заголовок"><input className="input" value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} /></Field>
            <Field label="Текст"><textarea className="input min-h-[120px]" value={modal.body} onChange={(e) => setModal({ ...modal, body: e.target.value })} /></Field>
            <Upload label="Картинка" value={modal.image_url} onChange={(v: string) => setModal({ ...modal, image_url: v })} accept="image/*" />
            <Upload label="Видео" value={modal.video_url} onChange={(v: string) => setModal({ ...modal, video_url: v })} accept="video/*" />
            <button className="btn w-full" onClick={save}>Опубликовать — появится в приложении мгновенно</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
