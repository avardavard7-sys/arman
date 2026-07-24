'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { Modal, Field, Upload, Empty } from '@/components/ui';

export default function Help() {
  const [items, setItems] = useState<any[]>([]);
  const [modal, setModal] = useState<any>(null);

  const load = () => sb.from('help_articles').select('*').order('sort_order').then(({ data }) => setItems(data || []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!modal.title) return alert('Укажите заголовок');
    const row = { title: modal.title, body: modal.body || '', image_url: modal.image_url || null, video_url: modal.video_url || null, sort_order: +modal.sort_order || 0 };
    if (modal.id) await sb.from('help_articles').update(row).eq('id', modal.id);
    else await sb.from('help_articles').insert(row);
    setModal(null); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="h1">Справка</h1>
        <button className="btn" onClick={() => setModal({ title: '', body: '', sort_order: items.length + 1 })}><Plus size={15} /> Статья</button>
      </div>
      <p className="text-sm text-ink/50 mb-6">Эти статьи открываются по кнопке «Справка» вверху панели — инструкции, как выполнять действия. Можно писать текст, добавлять картинки и видео.</p>
      {items.length === 0 ? <Empty text="Статей пока нет" /> : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="card p-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="font-extrabold">{a.sort_order}. {a.title}</div>
                <div className="text-sm text-ink/60 mt-1.5 whitespace-pre-wrap">{a.body}</div>
                <div className="flex gap-3 mt-2">
                  {a.image_url && <img src={a.image_url} className="h-16 rounded-lg" alt="" />}
                  {a.video_url && <video src={a.video_url} className="h-16 rounded-lg" />}
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <button className="text-ink/40 hover:text-ink" onClick={() => setModal({ ...a })}><Pencil size={17} /></button>
                <button className="text-ink/40 hover:text-terra" onClick={async () => { if (confirm('Удалить статью?')) { await sb.from('help_articles').delete().eq('id', a.id); load(); } }}><Trash2 size={17} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!modal} title={modal?.id ? 'Статья справки' : 'Новая статья'} onClose={() => setModal(null)}>
        {modal && (
          <div>
            <Field label="Заголовок"><input className="input" value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} /></Field>
            <Field label="Инструкция"><textarea className="input min-h-[140px]" value={modal.body} onChange={(e) => setModal({ ...modal, body: e.target.value })} /></Field>
            <Upload label="Картинка-объяснение" value={modal.image_url} onChange={(v: string) => setModal({ ...modal, image_url: v })} accept="image/*" />
            <Upload label="Видео-объяснение" value={modal.video_url} onChange={(v: string) => setModal({ ...modal, video_url: v })} accept="video/*" />
            <Field label="Порядок"><input className="input" type="number" value={modal.sort_order} onChange={(e) => setModal({ ...modal, sort_order: e.target.value })} /></Field>
            <button className="btn w-full" onClick={save}>Сохранить</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
