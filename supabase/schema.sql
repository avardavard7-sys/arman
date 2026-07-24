-- ============================================================
-- ВоенФП — полная схема Supabase (выполнить целиком в SQL Editor)
-- ============================================================

-- ПРОФИЛИ -----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  gender text not null default 'Мужской',
  age_category text not null default '1 возрастная группа (до 25 лет)',
  exercise_count int not null default 3,
  category text not null default '1 категория',
  tariff text not null default 'Не выбран',
  rank text not null default '',
  unit text not null default '',
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- КАТЕГОРИИ И УПРАЖНЕНИЯ -------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#5B8DEF',
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  number int,
  title text not null,
  description text not null default '',
  unit_label text not null default '',
  scoring jsonb not null default '[]',      -- [{"r":"8,8","p":32}, ...]
  min_points int not null default 26,
  image_url text,
  video_url text,
  gender text not null default 'all',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- РЕЗУЛЬТАТЫ СДАЧИ ФП ----------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  total_points int not null default 0,
  level_label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_title text not null default '',
  result text not null default '',
  points int not null default 0
);

-- ВОЕННЫЙ СПОРТ ----------------------------------------------
create table if not exists public.sport_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  info text not null default '',
  disciplines jsonb not null default '[]',  -- [{"name":"...","options":[{"label":"...","points":10}]}]
  age_groups jsonb not null default '["До 30 лет","30 - 40 лет","Свыше 40 лет"]',
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists public.sport_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event_id uuid references sport_events(id) on delete set null,
  event_name text not null default '',
  age_group text not null default '',
  data jsonb not null default '[]',
  total_points int not null default 0,
  created_at timestamptz not null default now()
);

-- НОВОСТИ / СПРАВКА / ЖУРНАЛ / PUSH / РАССЫЛКИ ---------------
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_url text,
  video_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_url text,
  video_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  grade int not null check (grade between 2 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  user_id uuid primary key references profiles(id) on delete cascade,
  expo_token text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  image_url text,
  video_url text,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

-- RLS ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.session_results enable row level security;
alter table public.sport_events enable row level security;
alter table public.sport_results enable row level security;
alter table public.news enable row level security;
alter table public.help_articles enable row level security;
alter table public.grades enable row level security;
alter table public.push_tokens enable row level security;
alter table public.broadcasts enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists "categories_read" on public.categories;
create policy "categories_read" on public.categories for select to authenticated using (true);
drop policy if exists "categories_admin" on public.categories;
create policy "categories_admin" on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "exercises_read" on public.exercises;
create policy "exercises_read" on public.exercises for select to authenticated using (true);
drop policy if exists "exercises_admin" on public.exercises;
create policy "exercises_admin" on public.exercises for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sessions_own" on public.sessions;
create policy "sessions_own" on public.sessions for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "session_results_own" on public.session_results;
create policy "session_results_own" on public.session_results for all
  using (exists(select 1 from sessions s where s.id = session_id and (s.user_id = auth.uid() or public.is_admin())))
  with check (exists(select 1 from sessions s where s.id = session_id and (s.user_id = auth.uid() or public.is_admin())));

drop policy if exists "sport_events_read" on public.sport_events;
create policy "sport_events_read" on public.sport_events for select to authenticated using (true);
drop policy if exists "sport_events_admin" on public.sport_events;
create policy "sport_events_admin" on public.sport_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sport_results_own" on public.sport_results;
create policy "sport_results_own" on public.sport_results for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "news_read" on public.news;
create policy "news_read" on public.news for select to authenticated using (true);
drop policy if exists "news_admin" on public.news;
create policy "news_admin" on public.news for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "help_read" on public.help_articles;
create policy "help_read" on public.help_articles for select to authenticated using (true);
drop policy if exists "help_admin" on public.help_articles;
create policy "help_admin" on public.help_articles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "grades_read" on public.grades;
create policy "grades_read" on public.grades for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "grades_admin" on public.grades;
create policy "grades_admin" on public.grades for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "push_own" on public.push_tokens;
create policy "push_own" on public.push_tokens for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "broadcasts_admin" on public.broadcasts;
create policy "broadcasts_admin" on public.broadcasts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings_read" on public.app_settings;
create policy "settings_read" on public.app_settings for select to authenticated using (true);
drop policy if exists "settings_admin" on public.app_settings;
create policy "settings_admin" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- STORAGE -----------------------------------------------------
insert into storage.buckets (id, name, public) values ('media','media', true)
on conflict (id) do nothing;

drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media_insert" on storage.objects;
create policy "media_insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_update" on storage.objects;
create policy "media_update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_delete" on storage.objects;
create policy "media_delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- REALTIME ----------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.exercises; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.categories; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.news; exception when others then null; end $$;

-- СИДЫ --------------------------------------------------------
insert into public.app_settings(key, value) values
('levels', '[{"min":230,"label":"Высший уровень"},{"min":190,"label":"1 категория"},{"min":160,"label":"2 категория"},{"min":130,"label":"3 категория"},{"min":0,"label":"Ниже 3 категории"}]')
on conflict (key) do nothing;

do $$
declare c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid;
begin
  if exists(select 1 from public.categories) then return; end if;

  insert into public.categories(name,color,sort_order) values ('Быстрота','#7C6BC4',1) returning id into c1;
  insert into public.categories(name,color,sort_order) values ('Сила','#3E8E8C',2) returning id into c2;
  insert into public.categories(name,color,sort_order) values ('Выносливость','#B4403A',3) returning id into c3;
  insert into public.categories(name,color,sort_order) values ('Ловкость','#DE9F3B',4) returning id into c4;
  insert into public.categories(name,color,sort_order) values ('Военно-прикладной навык','#8A7A63',5) returning id into c5;

  insert into public.exercises(category_id,number,title,description,unit_label,min_points,sort_order,scoring) values
  (c1,40,'Бег на 60 м','Выполняется с высокого старта по беговой дорожке или ровной площадке.','с',26,1,
   '[{"r":"10,4","p":26},{"r":"10,2","p":30},{"r":"10,0","p":34},{"r":"9,8","p":38},{"r":"9,6","p":42},{"r":"9,4","p":46},{"r":"9,2","p":50},{"r":"9,0","p":55},{"r":"8,8","p":60},{"r":"8,6","p":66},{"r":"8,4","p":72},{"r":"8,2","p":80},{"r":"8,0","p":90},{"r":"7,8","p":100}]'),
  (c1,41,'Бег на 100 м','Выполняется с высокого старта по беговой дорожке или ровной площадке.','с',26,2,
   '[{"r":"15,8","p":26},{"r":"15,4","p":32},{"r":"15,0","p":38},{"r":"14,6","p":44},{"r":"14,2","p":50},{"r":"13,8","p":58},{"r":"13,4","p":66},{"r":"13,0","p":76},{"r":"12,6","p":88},{"r":"12,2","p":100}]'),
  (c1,42,'Челночный бег 10x10 м','Выполняется на ровной площадке с размеченными линиями старта и поворота. Ширина линии старта и поворота входит в отрезок 10 м. По команде "МАРШ" пробежать 10 м, коснуться земли за линией поворота любой частью тела, повернуться кругом, пробежать таким образом еще девять отрезков по 10 м. Запрещается использовать в качестве опоры при повороте какие-либо естественные или искусственные предметы, неровности, выступающие над поверхностью дорожки.','с',26,3,
   '[{"r":"29,0","p":26},{"r":"28,6","p":32},{"r":"28,2","p":38},{"r":"27,8","p":44},{"r":"27,4","p":50},{"r":"27,0","p":58},{"r":"26,6","p":66},{"r":"26,2","p":74},{"r":"25,8","p":84},{"r":"25,4","p":92},{"r":"25,0","p":100}]'),
  (c2,1,'Сгибание и разгибание рук в упоре лежа','Упор лежа (ноги вместе, тело прямое), согнуть руки до касания грудью пола, разгибая руки, принять упор лежа. Упражнение выполняется без остановки. Для контроля касания разрешается использовать специальное техническое приспособление.','раз',26,1,
   '[{"r":"10","p":26},{"r":"15","p":32},{"r":"20","p":38},{"r":"25","p":44},{"r":"30","p":50},{"r":"35","p":55},{"r":"40","p":60},{"r":"45","p":66},{"r":"50","p":72},{"r":"55","p":78},{"r":"60","p":85},{"r":"65","p":92},{"r":"70","p":100}]'),
  (c2,4,'Подтягивание на перекладине','Вис хватом сверху; сгибая руки, подтянуться (подбородок выше грифа перекладины), разгибая руки, опуститься в вис. Положение виса фиксируется.','раз',26,2,
   '[{"r":"2","p":16},{"r":"3","p":22},{"r":"4","p":26},{"r":"5","p":30},{"r":"6","p":34},{"r":"8","p":42},{"r":"10","p":50},{"r":"12","p":58},{"r":"14","p":66},{"r":"16","p":74},{"r":"18","p":82},{"r":"20","p":90},{"r":"25","p":96},{"r":"30","p":100}]'),
  (c2,12,'Толчок двух гирь, вес 24 кг. До 70 кг','Стойка ноги врозь, гири в опущенных руках. Поднять гири на грудь, вытолкнуть вверх, зафиксировать. Засчитывается количество правильных толчков.','раз',26,3,
   '[{"r":"3","p":22},{"r":"4","p":26},{"r":"5","p":32},{"r":"6","p":36},{"r":"8","p":44},{"r":"10","p":52},{"r":"12","p":60},{"r":"14","p":68},{"r":"16","p":76},{"r":"18","p":84},{"r":"20","p":92},{"r":"24","p":100}]'),
  (c3,43,'Бег на 400 м','Выполняется по беговой дорожке стадиона с высокого старта.','мин',26,1,
   '[{"r":"1.44","p":26},{"r":"1.40","p":32},{"r":"1.36","p":40},{"r":"1.32","p":48},{"r":"1.28","p":56},{"r":"1.24","p":64},{"r":"1.20","p":74},{"r":"1.16","p":84},{"r":"1.12","p":94},{"r":"1.10","p":100}]'),
  (c3,45,'Бег на 1 км','Выполняется по беговой дорожке стадиона или пересеченной местности с общего старта.','мин',26,2,
   '[{"r":"4.20","p":26},{"r":"4.10","p":32},{"r":"4.00","p":40},{"r":"3.50","p":48},{"r":"3.40","p":58},{"r":"3.30","p":68},{"r":"3.20","p":80},{"r":"3.10","p":92},{"r":"3.05","p":100}]'),
  (c3,46,'Бег на 3 км','Выполняется по беговой дорожке стадиона или пересеченной местности с общего старта.','мин',26,3,
   '[{"r":"14.30","p":26},{"r":"14.00","p":32},{"r":"13.30","p":40},{"r":"13.00","p":50},{"r":"12.45","p":58},{"r":"12.30","p":66},{"r":"12.15","p":74},{"r":"12.00","p":82},{"r":"11.45","p":90},{"r":"11.30","p":100}]'),
  (c4,15,'Прыжок ноги врозь через козла в длину','Козел в длину, высота 125 см, мостик высотой 10-15 см. Разбег, толчок ног — прыжок ноги врозь с опорой руками. Оценивается техника выполнения.','оценка',40,1,
   '[{"r":"3","p":40},{"r":"4","p":55},{"r":"5","p":75}]'),
  (c4,16,'Прыжок ноги врозь через коня в длину','Конь в длину, высота 120 см, мостик высотой 10-15 см. Разбег, толчок ног — прыжок ноги врозь с опорой руками о дальнюю часть коня. Оценивается техника выполнения.','оценка',40,2,
   '[{"r":"3","p":40},{"r":"4","p":55},{"r":"5","p":75}]'),
  (c5,24,'Обороты на стационарном гимнастическом колесе','Выполняется на стационарном гимнастическом колесе. Засчитывается количество полных оборотов без остановки.','раз',26,1,
   '[{"r":"15","p":22},{"r":"20","p":26},{"r":"25","p":28},{"r":"30","p":28},{"r":"37","p":30},{"r":"45","p":36},{"r":"55","p":44},{"r":"65","p":52},{"r":"75","p":62},{"r":"85","p":72},{"r":"95","p":84},{"r":"100","p":100}]'),
  (c5,26,'Начальный комплекс приемов рукопашного боя (РБ-Н)','Выполняется комплекс приемов на 8 счетов. Оценивается техника и слитность выполнения приемов.','оценка',40,2,
   '[{"r":"3","p":40},{"r":"4","p":70},{"r":"5","p":100}]'),
  (c5,28,'Специальный комплекс приемов рукопашного боя (РБ-2)','Выполняется специальный комплекс приемов РБ-2. Оценивается техника и слитность выполнения приемов.','оценка',40,3,
   '[{"r":"3","p":40},{"r":"4","p":70},{"r":"5","p":100}]'),
  (c5,29,'Специальный комплекс приемов рукопашного боя (РБ-3)','Выполняется специальный комплекс приемов РБ-3. Оценивается техника и слитность выполнения приемов.','оценка',40,4,
   '[{"r":"3","p":40},{"r":"4","p":70},{"r":"5","p":100}]');

  insert into public.sport_events(name,info,sort_order,disciplines) values
  ('Летнее офицерское троеборье','Троеборье включает стрельбу из пистолета (ПМ-3), плавание на 300 м и бег на 3 км. Итоговый результат — сумма баллов по трем дисциплинам.',1,
   '[{"name":"Стрельба ПМ-3","options":[{"label":"20 очков","points":20},{"label":"22 очка","points":32},{"label":"24 очка","points":44},{"label":"26 очков","points":58},{"label":"28 очков","points":74},{"label":"30 очков","points":100}]},{"name":"Плавание 300 м","options":[{"label":"8:00","points":20},{"label":"7:30","points":35},{"label":"7:00","points":50},{"label":"6:30","points":65},{"label":"6:00","points":80},{"label":"5:30","points":100}]},{"name":"Бег 3 км","options":[{"label":"14:00","points":20},{"label":"13:30","points":35},{"label":"13:00","points":50},{"label":"12:30","points":65},{"label":"12:00","points":80},{"label":"11:30","points":100}]}]'),
  ('Зимнее офицерское троеборье','Троеборье включает стрельбу из пистолета (ПМ-3), плавание на 300 м и лыжную гонку на 10 км. Итоговый результат — сумма баллов по трем дисциплинам.',2,
   '[{"name":"Стрельба ПМ-3","options":[{"label":"20 очков","points":20},{"label":"22 очка","points":32},{"label":"24 очка","points":44},{"label":"26 очков","points":58},{"label":"28 очков","points":74},{"label":"30 очков","points":100}]},{"name":"Плавание 300 м","options":[{"label":"8:00","points":20},{"label":"7:30","points":35},{"label":"7:00","points":50},{"label":"6:30","points":65},{"label":"6:00","points":80},{"label":"5:30","points":100}]},{"name":"Лыжная гонка 10 км","options":[{"label":"60:00","points":20},{"label":"56:00","points":35},{"label":"52:00","points":50},{"label":"48:00","points":65},{"label":"44:00","points":80},{"label":"40:00","points":100}]}]');

  insert into public.help_articles(title,body,sort_order) values
  ('Как добавить упражнение','Откройте раздел «Упражнения», выберите категорию слева и нажмите «+ Упражнение». Заполните номер, название, описание и таблицу баллов (результат → баллы). После сохранения упражнение мгновенно появится в мобильном приложении.',1),
  ('Как отправить рассылку','Откройте раздел «Рассылка», введите заголовок и текст, при необходимости прикрепите картинку или видео и нажмите «Отправить всем». Push-уведомление придет всем пользователям, которые вошли в приложение хотя бы один раз.',2),
  ('Как выставить оценку','Откройте раздел «Журнал», найдите пользователя по ФИО, выберите его, укажите предмет/упражнение, оценку от 2 до 5 и комментарий. Средний балл (успеваемость) считается автоматически.',3);

  insert into public.news(title,body) values
  ('Добро пожаловать в ВоенФП','Приложение для учета результатов сдачи физической подготовки и военного спорта. Заполните настройки в профиле и сохраняйте свои результаты.');
end $$;

-- Назначение администратора (замените email):
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@mail.com');
