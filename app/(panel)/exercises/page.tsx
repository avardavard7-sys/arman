'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { Modal, Field, Upload, Empty } from '@/components/ui';

const emptyEx = { number: '', title: '', description: '', unit_label: '', min_points: 26, sort_order: 0, is_active: true, image_url: '', video_url: '', scoring: [{ r: '', p: 0 }] };

export default function Exercises() {
  const [cats, setCats] = useState<any[]>([]);
  const [exs, setExs] = useState<any[]>([]);
  const [sel, setSel] = useState<string>('');
  const [catModal, setCatModal] = useState<any>(null);
  const [exModal, setExModal] = useState<any>(null);
  const [json, setJson] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const load = async () => {
    const [c, e] = await Promise.all([
      sb.from('categories').select('*').order('sort_order'),
      sb.from('exercises').select('*').order('sort_order'),
    ]);
    setCats(c.data || []);
    setExs(e.data || []);
    if (!sel && c.data?.length) setSel(c.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const saveCat = async () => {
    const row = { name: catModal.name, color: catModal.color, sort_order: +catModal.sort_order || 0, is_active: catModal.is_active ?? true };
    if (catModal.id) await sb.from('categories').update(row).eq('id', catModal.id);
    else await sb.from('categories').insert(row);
    setCatModal(null); load();
  };

  const delCat = async (c: any) => {
    if (!confirm(`Удалить категорию «${c.name}» вместе с упражнениями?`)) return;
    await sb.from('categories').delete().eq('id', c.id); load();
  };

  const openEx = (ex?: any) => {
    const e = ex ? { ...ex, scoring: [...(ex.scoring || [])] } : { ...emptyEx, scoring: [{ r: '', p: 0 }] };
    setExModal(e); setJson(false); setJsonText(JSON.stringify(e.scoring, null, 1));
  };

  const saveEx = async () => {
    let scoring = exModal.scoring;
    if (json) {
      try { scoring = JSON.parse(jsonText); } catch { return alert('Некорректный JSON таблицы баллов'); }
    }
    scoring = (scoring || []).filter((s: any) => String(s.r).trim() !== '').map((s: any) => ({ r: String(s.r), p: +s.p || 0 }));
    if (!exModal.title) return alert('Укажите название');
    const row = {
      category_id: sel, number: +exModal.number || null, title: exModal.title, description: exModal.description || '',
      unit_label: exModal.unit_label || '', min_points: +exModal.min_points || 0, sort_order: +exModal.sort_order || 0,
      is_active: !!exModal.is_active, image_url: exModal.image_url || null, video_url: exModal.video_url || null, scoring,
    };
    if (exModal.id) await sb.from('exercises').update(row).eq('id', exModal.id);
    else await sb.from('exercises').insert(row);
    setExModal(null); load();
  };

  const delEx = async (e: any) => {
    if (!confirm(`Удалить упражнение «${e.title}»?`)) return;
    await sb.from('exercises').delete().eq('id', e.id); load();
  };

  const list = exs.filter((e) => e.category_id === sel);
  const setSc = (i: number, k: string, v: any) =>
    setExModal((m: any) => ({ ...m, scoring: m.scoring.map((s: any, si: number) => (si === i ? { ...s, [k]: v } : s)) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="h1">Упражнения</h1>
        <button className="btn-ghost" onClick={() => setCatModal({ name: '', color: '#5B8DEF', sort_order: cats.length + 1 })}><Plus size={15} /> Категория</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {cats.map((c) => (
          <div key={c.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer text-sm font-semibold ${sel === c.id ? 'bg-navy text-paper border-navy' : 'bg-white border-sand hover:bg-sand/40'}`} onClick={() => setSel(c.id)}>
            <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
            {c.name}{!c.is_active && ' (скрыта)'}
            {sel === c.id && (
              <span className="flex gap-1.5 ml-1">
                <Pencil size={13} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setCatModal({ ...c }); }} />
                <Trash2 size={13} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); delCat(c); }} />
              </span>
            )}
          </div>
        ))}
      </div>

      <button className="btn mb-4" onClick={() => openEx()} disabled={!sel}><Plus size={15} /> Упражнение</button>

      {list.length === 0 ? <Empty text="В категории пока нет упражнений" /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((e) => (
            <div key={e.id} className={`card p-4 ${!e.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-extrabold">№{e.number} · {e.title}</div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-ink/40 hover:text-ink" onClick={() => openEx(e)}><Pencil size={16} /></button>
                  <button className="text-ink/40 hover:text-terra" onClick={() => delEx(e)}><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="text-xs text-ink/50 mt-2">Шагов шкалы: {(e.scoring || []).length} · Порог: {e.min_points} б.{e.unit_label ? ` · ед: ${e.unit_label}` : ''}</div>
              {e.description && <div className="text-xs text-ink/60 mt-2 line-clamp-2">{e.description}</div>}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!catModal} title={catModal?.id ? 'Категория' : 'Новая категория'} onClose={() => setCatModal(null)}>
        <Field label="Название"><input className="input" value={catModal?.name || ''} onChange={(e) => setCatModal({ ...catModal, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Цвет карточек">
            <div className="flex flex-wrap gap-2 mb-2">
              {['#5B8DEF','#00AFCA','#7C6BC4','#DB2777','#DC2626','#EA580C','#D97706','#16A34A','#0D9488','#C3552D','#475569','#101B2D'].map((c) => (
                <button key={c} type="button" onClick={() => setCatModal({ ...catModal, color: c })}
                  className={`w-8 h-8 rounded-lg transition ${((catModal?.color || '') + '').toLowerCase() === c.toLowerCase() ? 'ring-2 ring-ink scale-110' : 'hover:scale-110'}`}
                  style={{ background: c }} title={c} />
              ))}
            </div>
            <input type="color" className="input h-11 p-1" value={catModal?.color || '#5B8DEF'} onChange={(e) => setCatModal({ ...catModal, color: e.target.value })} />
          </Field>
          <Field label="Порядок"><input className="input" type="number" value={catModal?.sort_order ?? 0} onChange={(e) => setCatModal({ ...catModal, sort_order: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold mb-4"><input type="checkbox" checked={catModal?.is_active ?? true} onChange={(e) => setCatModal({ ...catModal, is_active: e.target.checked })} /> Показывать в приложении</label>
        <button className="btn w-full" onClick={saveCat}>Сохранить</button>
      </Modal>

      <Modal open={!!exModal} title={exModal?.id ? 'Упражнение' : 'Новое упражнение'} onClose={() => setExModal(null)} wide>
        {exModal && (
          <div>
            <div className="grid grid-cols-4 gap-4">
              <Field label="№"><input className="input" type="number" value={exModal.number ?? ''} onChange={(e) => setExModal({ ...exModal, number: e.target.value })} /></Field>
              <div className="col-span-3"><Field label="Название"><input className="input" value={exModal.title} onChange={(e) => setExModal({ ...exModal, title: e.target.value })} /></Field></div>
            </div>
            <Field label="Описание (порядок выполнения — кнопка i в приложении)">
              <textarea className="input min-h-[90px]" value={exModal.description} onChange={(e) => setExModal({ ...exModal, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Ед. измерения"><input className="input" placeholder="раз / с / мин" value={exModal.unit_label} onChange={(e) => setExModal({ ...exModal, unit_label: e.target.value })} /></Field>
              <Field label="Пороговый минимум (баллы)"><input className="input" type="number" value={exModal.min_points} onChange={(e) => setExModal({ ...exModal, min_points: e.target.value })} /></Field>
              <Field label="Порядок"><input className="input" type="number" value={exModal.sort_order} onChange={(e) => setExModal({ ...exModal, sort_order: e.target.value })} /></Field>
            </div>
            <Upload label="Картинка (для описания)" value={exModal.image_url} onChange={(v: string) => setExModal({ ...exModal, image_url: v })} accept="image/*" />
            <Upload label="Видео" value={exModal.video_url} onChange={(v: string) => setExModal({ ...exModal, video_url: v })} accept="video/*" />

            <div className="flex items-center justify-between mt-2 mb-2">
              <label className="lbl mb-0">Таблица баллов (результат → баллы)</label>
              <button className="text-xs font-bold text-terra" onClick={() => { if (!json) setJsonText(JSON.stringify(exModal.scoring, null, 1)); setJson(!json); }}>
                {json ? 'Редактор строк' : 'JSON-режим'}
              </button>
            </div>
            {json ? (
              <textarea className="input min-h-[160px] font-mono text-xs" value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
            ) : (
              <div className="max-h-60 overflow-y-auto border border-sand rounded-xl p-3 space-y-2">
                {exModal.scoring.map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className="input" placeholder="Результат (напр. 8,8)" value={s.r} onChange={(e) => setSc(i, 'r', e.target.value)} />
                    <input className="input w-28" type="number" placeholder="Баллы" value={s.p} onChange={(e) => setSc(i, 'p', e.target.value)} />
                    <button className="text-ink/40 hover:text-terra" onClick={() => setExModal({ ...exModal, scoring: exModal.scoring.filter((_: any, xi: number) => xi !== i) })}><Trash2 size={15} /></button>
                  </div>
                ))}
                <button className="btn-ghost w-full" onClick={() => setExModal({ ...exModal, scoring: [...exModal.scoring, { r: '', p: 0 }] })}><Plus size={14} /> Строка</button>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm font-semibold my-4"><input type="checkbox" checked={!!exModal.is_active} onChange={(e) => setExModal({ ...exModal, is_active: e.target.checked })} /> Показывать в приложении</label>
            <button className="btn w-full" onClick={saveEx}>Сохранить — появится в приложении мгновенно</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
