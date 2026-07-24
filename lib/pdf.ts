'use client';

async function pm() {
  const mod: any = await import('pdfmake/build/pdfmake');
  const pdfMake = mod.default || mod;
  const vf: any = await import('pdfmake/build/vfs_fonts');
  pdfMake.vfs = vf.default?.pdfMake?.vfs || vf.pdfMake?.vfs || vf.default?.vfs || vf.vfs;
  return pdfMake;
}

const styles = {
  h1: { fontSize: 18, bold: true, color: '#0A1628', margin: [0, 0, 0, 4] },
  h2: { fontSize: 13, bold: true, color: '#C3552D', margin: [0, 14, 0, 6] },
  th: { bold: true, fillColor: '#0A1628', color: '#F5F1E8', fontSize: 9 },
  small: { fontSize: 8, color: '#6B7280' },
};

const t = (body: any[][], widths: any[]) => ({
  table: { headerRows: 1, widths, body },
  layout: { hLineColor: '#E5E0D2', vLineColor: '#E5E0D2', hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
  margin: [0, 2, 0, 2],
});

const d = (s: string) => new Date(s).toLocaleDateString('ru-RU');

export async function userPdf(p: any, sessions: any[], sports: any[], grades: any[]) {
  const pdfMake = await pm();
  const avg = grades.length ? (grades.reduce((s, g) => s + g.grade, 0) / grades.length).toFixed(2) : '—';
  const best = sessions.length ? Math.max(...sessions.map((s) => s.total_points)) : 0;

  const sessionRows: any[] = [];
  sessions.forEach((s) => {
    sessionRows.push([{ text: d(s.created_at), bold: true }, { text: `${s.total_points} б.`, bold: true }, s.level_label]);
    (s.session_results || []).forEach((r: any) =>
      sessionRows.push([{ text: `   ${r.exercise_title}`, style: 'small' }, { text: `${r.points} б.`, style: 'small' }, { text: `результат: ${r.result}`, style: 'small' }])
    );
  });

  const dd: any = {
    content: [
      { text: 'ВоенФП — Личная карточка военнослужащего', style: 'h1' },
      { text: `Сформировано: ${new Date().toLocaleString('ru-RU')}`, style: 'small', margin: [0, 0, 0, 10] },
      t(
        [
          [{ text: 'ФИО', style: 'th' }, { text: 'Пол', style: 'th' }, { text: 'Возрастная категория', style: 'th' }, { text: 'Категория', style: 'th' }],
          [p.full_name || '—', p.gender, p.age_category, p.category],
        ],
        ['*', 'auto', '*', 'auto']
      ),
      t(
        [
          [{ text: 'Тарифный разряд', style: 'th' }, { text: 'Регистрация', style: 'th' }, { text: 'Лучший результат', style: 'th' }, { text: 'Успеваемость (ср. балл)', style: 'th' }],
          [p.tariff || '—', d(p.created_at), `${best} б.`, avg],
        ],
        ['*', 'auto', 'auto', 'auto']
      ),
      { text: 'Результаты сдачи ФП', style: 'h2' },
      sessions.length
        ? t([[{ text: 'Дата', style: 'th' }, { text: 'Баллы', style: 'th' }, { text: 'Уровень / детали', style: 'th' }], ...sessionRows], ['auto', 'auto', '*'])
        : { text: 'Нет результатов', style: 'small' },
      { text: 'Спортивные результаты', style: 'h2' },
      sports.length
        ? t(
            [
              [{ text: 'Дата', style: 'th' }, { text: 'Дисциплина', style: 'th' }, { text: 'Группа', style: 'th' }, { text: 'Баллы', style: 'th' }],
              ...sports.map((s) => [d(s.created_at), s.event_name, s.age_group || '—', `${s.total_points} б.`]),
            ],
            ['auto', '*', 'auto', 'auto']
          )
        : { text: 'Нет результатов', style: 'small' },
      { text: 'Журнал оценок', style: 'h2' },
      grades.length
        ? t(
            [
              [{ text: 'Дата', style: 'th' }, { text: 'Предмет', style: 'th' }, { text: 'Оценка', style: 'th' }, { text: 'Комментарий', style: 'th' }],
              ...grades.map((g) => [d(g.created_at), g.subject, String(g.grade), g.comment || '—']),
            ],
            ['auto', '*', 'auto', '*']
          )
        : { text: 'Нет оценок', style: 'small' },
    ],
    styles,
    defaultStyle: { fontSize: 10, color: '#1B2434' },
    pageMargins: [36, 36, 36, 36],
  };
  pdfMake.createPdf(dd).download(`ВоенФП_${(p.full_name || 'пользователь').replace(/\s+/g, '_')}.pdf`);
}

export async function allUsersPdf(rows: any[]) {
  const pdfMake = await pm();
  const dd: any = {
    content: [
      { text: 'ВоенФП — Сводный отчет по пользователям', style: 'h1' },
      { text: `Всего пользователей: ${rows.length} · Сформировано: ${new Date().toLocaleString('ru-RU')}`, style: 'small', margin: [0, 0, 0, 10] },
      t(
        [
          [
            { text: '№', style: 'th' }, { text: 'ФИО', style: 'th' }, { text: 'Пол', style: 'th' },
            { text: 'Возрастная категория', style: 'th' }, { text: 'Сдач ФП', style: 'th' },
            { text: 'Лучший результат', style: 'th' }, { text: 'Уровень', style: 'th' }, { text: 'Ср. оценка', style: 'th' },
          ],
          ...rows.map((r, i) => [String(i + 1), r.full_name || '—', r.gender, r.age_category, String(r.count), r.best ? `${r.best} б.` : '—', r.level || '—', r.avg || '—']),
        ],
        ['auto', '*', 'auto', '*', 'auto', 'auto', 'auto', 'auto']
      ),
    ],
    styles,
    defaultStyle: { fontSize: 9, color: '#1B2434' },
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 30],
  };
  pdfMake.createPdf(dd).download('ВоенФП_все_пользователи.pdf');
}
