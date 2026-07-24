'use client';
import { useEffect, useState } from 'react';
import { Palette, Check, RotateCcw } from 'lucide-react';
import { sb } from '@/lib/supabase';

const DEFAULT_ACCENT = '#00AFCA';
const PRESETS = [
  '#00AFCA', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C',
  '#D97706', '#16A34A', '#0D9488', '#0891B2', '#475569', '#C3552D',
];
const HEX = /^#[0-9A-Fa-f]{6}$/;

export default function Settings() {
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [saved, setSaved] = useState(DEFAULT_ACCENT);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    sb.from('app_settings').select('value').eq('key', 'theme').maybeSingle().then(({ data }) => {
      const a = (data?.value as any)?.accent;
      if (a && HEX.test(a)) { setAccent(a); setSaved(a); }
    });
  }, []);

  const save = async () => {
    if (!HEX.test(accent)) return alert('Некорректный цвет. Формат: #RRGGBB');
    setBusy(true);
    const { error } = await sb.from('app_settings').upsert({ key: 'theme', value: { accent } }, { onConflict: 'key' });
    setBusy(false);
    if (error) return alert('Ошибка: ' + error.message);
    setSaved(accent);
    setOk(true);
    setTimeout(() => setOk(false), 2500);
  };

  const dirty = accent !== saved;

  return (
    <div>
      <h1 className="h1 flex items-center gap-2 mb-2"><Palette size={24} /> Настройки</h1>
      <p className="text-sm text-ink/50 mb-8">Основной цвет приложения. Сохранение мгновенно меняет дизайн у всех пользователей — кнопки, вкладки, чат, бейджи.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        <div className="card p-6">
          <div className="lbl mb-3">Готовые цвета</div>
          <div className="grid grid-cols-6 gap-3 mb-6">
            {PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => setAccent(c)}
                className={`h-12 rounded-xl transition ring-offset-2 ${accent.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-ink scale-105' : 'hover:scale-105'}`}
                style={{ background: c }}
                title={c}
              >
                {accent.toLowerCase() === c.toLowerCase() && <Check size={18} className="mx-auto text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <div className="lbl mb-2">Свой цвет</div>
          <div className="flex items-center gap-3">
            <input type="color" className="h-12 w-16 rounded-xl border border-sand cursor-pointer p-1 bg-white"
              value={HEX.test(accent) ? accent : DEFAULT_ACCENT}
              onChange={(e) => setAccent(e.target.value.toUpperCase())} />
            <input className="input flex-1 font-mono" value={accent} maxLength={7}
              onChange={(e) => setAccent(e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value)} />
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button className="btn flex-1 justify-center disabled:opacity-40" disabled={busy || !dirty} onClick={save}>
              {busy ? 'Сохранение…' : ok ? '✓ Применено у всех' : 'Сохранить и применить'}
            </button>
            <button className="btn-ghost" title="Вернуть стандартный" onClick={() => setAccent(DEFAULT_ACCENT)}>
              <RotateCcw size={15} /> Сброс
            </button>
          </div>
          {dirty && <div className="text-xs text-amber-700 mt-3">Изменения ещё не сохранены</div>}
        </div>

        <div className="card p-6">
          <div className="lbl mb-3">Как будет выглядеть в приложении</div>
          <div className="mx-auto w-[290px] rounded-[34px] border-[10px] border-navy bg-[#F5F3EE] overflow-hidden shadow-xl">
            <div className="px-5 pt-5 pb-3">
              <div className="text-[19px] font-black text-[#101B2D]">Чаты</div>
            </div>
            <div className="px-4 space-y-2.5 pb-3">
              {[['Айдар Серик', 'Готов к тренировке 💪', 2], ['Тренер Ерлан', 'Видео принято ✅', 0]].map(([n, m, u]: any) => (
                <div key={n} className="flex items-center gap-2.5 bg-white rounded-2xl p-2.5">
                  <div className="w-10 h-10 rounded-full grid place-items-center text-white text-xs font-black" style={{ background: accent }}>{String(n).slice(0, 1)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-extrabold text-[#101B2D] truncate">{n}</div>
                    <div className="text-[11px] text-[#6B7280] truncate">{m}</div>
                  </div>
                  {u > 0 && <div className="min-w-[20px] h-5 px-1.5 rounded-full grid place-items-center text-[10px] font-black text-white" style={{ background: accent }}>{u}</div>}
                </div>
              ))}
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-md px-3 py-2 text-[11.5px] text-white" style={{ background: accent }}>
                  Завтра сдаю подтягивания!
                </div>
              </div>
              <button className="w-full rounded-xl py-2.5 text-[12px] font-extrabold text-white" style={{ background: accent }}>
                Записать видео
              </button>
            </div>
            <div className="flex justify-around border-t border-[#E6E1D6] bg-[#FCFBF8] py-2">
              {['ФП', 'Спорт', 'Чаты', 'Ещё'].map((t, i) => (
                <div key={t} className="text-[10px] font-bold" style={{ color: i === 2 ? accent : '#8A8F98' }}>{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
