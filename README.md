# CSKA KAZ — админ-панель (Next.js 14 → Vercel)

## 1. Supabase
1. Создай проект на supabase.com
2. SQL Editor → вставь целиком `supabase/schema.sql` → Run (создаст таблицы, RLS, storage `media` и стартовые данные)
3. Зарегистрируйся через мобильное приложение (или Authentication → Add user), затем в SQL Editor:
```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'ТВОЙ_EMAIL');
```
4. Authentication → Providers → Email → отключи "Confirm email"

## 2. Локальный запуск
```
cd cska-kaz-admin
npm install
copy .env.example .env.local   # и заполни ключи (Settings → API)
npm run dev
```
ANON KEY — legacy `eyJ...`. SERVICE_ROLE — тоже из Settings → API (нужен для рассылки push).

## 3. Деплой на Vercel
```
git init
git add .
git commit -m "ccka-kaz admin"
git branch -M main
git remote add origin https://github.com/USER/cska-kaz-admin.git
git push -u origin main --force
```
Затем vercel.com → Import → добавь Environment Variables:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → Deploy.

## Возможности
- **Упражнения**: категории + упражнения, таблица баллов (результат→баллы), порог, фото/видео описания — мгновенно в приложении (Realtime)
- **Военный спорт**: троеборья и дисциплины (JSON-редактор вариантов)
- **Пользователи**: поиск по ФИО, карточка со всеми достижениями, PDF по одному и PDF по всем
- **Рейтинг**: топ пользователей по лучшему результату
- **Журнал**: оценки 2–5, успеваемость (средний балл)
- **Новости**: текст + фото/видео, мгновенно в приложении
- **Рассылка**: push всем пользователям (Expo Push API)
- **Справка**: кнопка «Справка» вверху панели; статьи с текстом/фото/видео редактируются в разделе «Справка»
