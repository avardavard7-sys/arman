'use client';
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { sb } from '@/lib/supabase';
import { Modal, Field, Empty } from '@/components/ui';

const HINT = `[
 {"name":"Стрельба ПМ-3","options":[{"label":"20 очков","points":20},{"label":"30 очков","points":100}]},
 {"name":"Бег 3 км","options":[{"label":"14:00","points":20},{"label":"11:30","points":100}]}
]`;

export default function Sport() {
  const [events, setEvents] = useState<any[]>([]);
  const [modal, setModal] = useState<any>(null);

  const load = () => sb.from('sport_events').select('*').order('sort_order').then(({ data }) => setEvents(data || []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    let disciplines, disciplinesKz = null;
    try { disciplines = JSON.parse(modal.disciplinesText); } catch { return alert('Некорректный JSON дисциплин'); }
    const kzText = String(modal.disciplinesKzText || '').trim();
    if (kzText) {
      try { disciplinesKz = JSON.parse(kzText); } catch { return alert('Некорректный JSON дисциплин (казахский)'); }
    }
    const groups = String(modal.groupsText || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const groupsKz = String(modal.groupsKzText || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const row = {
      name: modal.name,
      name_kz: (modal.name_kz || '').trim() || null,
      info: modal.info || '',
      info_kz: (modal.info_kz || '').trim() || null,
      disciplines,
      disciplines_kz: disciplinesKz,
      age_groups: groups,
      age_groups_kz: groupsKz.length ? groupsKz : null,
      sort_order: +modal.sort_order || 0,
      is_active: !!modal.is_active,
    };
    if (!row.name) return alert('Укажите название');
    const r = modal.id
      ? await sb.from('sport_events').update(row).eq('id', modal.id)
      : await sb.from('sport_events').insert(row);
    if (r.error) return alert('Ошибка: ' + r.error.message);
    setModal(null); load();
  };

  const del = async (e: any) => {
    if (!confirm(`Удалить «${e.name}»?`)) return;
    const r = await sb.from('sport_events').delete().eq('id', e.id);
    if (r.error) return alert('Ошибка: ' + r.error.message);
    load();
  };

  const open = (e: any) => setModal({
    ...e,
    name_kz: e.name_kz || '',
    info_kz: e.info_kz || '',
    disciplinesText: JSON.stringify(e.disciplines, null, 1),
    disciplinesKzText: e.disciplines_kz ? JSON.stringify(e.disciplines_kz, null, 1) : '',
    groupsText: (e.age_groups || []).join(', '),
    groupsKzText: (e.age_groups_kz || []).join(', '),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="h1">Спорт</h1>
        <button className="btn" onClick={() => setModal({ name: '', name_kz: '', info: '', info_kz: '', disciplinesText: HINT, disciplinesKzText: '', groupsText: 'До 30 лет, 30 - 40 лет, Свыше 40 лет', groupsKzText: '', sort_order: events.length + 1, is_active: true })}><Plus size={15} /> Дисциплина</button>
      </div>
      {events.length === 0 ? <Empty text="Нет дисциплин" /> : (
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className={`card p-5 flex items-center justify-between ${!e.is_active ? 'opacity-50' : ''}`}>
              <div>
                <div className="font-extrabold">{e.name}{e.name_kz ? <span className="text-ink/40 font-semibold"> · {e.name_kz}</span> : null}</div>
                <div className="text-xs text-ink/50 mt-1">{(e.disciplines || []).map((d: any) => d.name).join(' · ')}</div>
              </div>
              <div className="flex gap-3">
                <button className="text-ink/40 hover:text-ink" onClick={() => open(e)}><Pencil size={17} /></button>
                <button className="text-ink/40 hover:text-terra" onClick={() => del(e)}><Trash2 size={17} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} title={modal?.id ? 'Дисциплина' : 'Новая дисциплина'} onClose={() => setModal(null)} wide>
        {modal && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Название (рус)"><input className="input" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field>
              <Field label="Атауы (каз, опционально)"><input className="input" value={modal.name_kz} onChange={(e) => setModal({ ...modal, name_kz: e.target.value })} /></Field>
            </div>
            <Field label="Описание (кнопка i в приложении)"><textarea className="input min-h-[70px]" value={modal.info} onChange={(e) => setModal({ ...modal, info: e.target.value })} /></Field>
            <Field label="Сипаттама (каз, опционально)"><textarea className="input min-h-[70px]" value={modal.info_kz} onChange={(e) => setModal({ ...modal, info_kz: e.target.value })} /></Field>
            <Field label="Возрастные группы (через запятую)"><input className="input" value={modal.groupsText} onChange={(e) => setModal({ ...modal, groupsText: e.target.value })} /></Field>
            <Field label="Жас топтары (каз, через запятую, опционально)"><input className="input" value={modal.groupsKzText} onChange={(e) => setModal({ ...modal, groupsKzText: e.target.value })} /></Field>
            <Field label="Дисциплины и варианты результатов (JSON)">
              <textarea className="input min-h-[180px] font-mono text-xs" value={modal.disciplinesText} onChange={(e) => setModal({ ...modal, disciplinesText: e.target.value })} />
            </Field>
            <Field label="Пәндер (каз, JSON, опционально — пусто = показывать русский)">
              <textarea className="input min-h-[120px] font-mono text-xs" value={modal.disciplinesKzText} onChange={(e) => setModal({ ...modal, disciplinesKzText: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4 items-center">
              <Field label="Порядок"><input className="input" type="number" value={modal.sort_order} onChange={(e) => setModal({ ...modal, sort_order: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm font-semibold mt-4"><input type="checkbox" checked={!!modal.is_active} onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} /> Показывать в приложении</label>
            </div>
            <button className="btn w-full mt-2" onClick={save}>Сохранить</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
