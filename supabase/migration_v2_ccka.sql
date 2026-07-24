-- ============================================
-- MIGRATION: ccka_kaz_video_friends_chat_core (applied)
-- ============================================

create extension if not exists pg_trgm;

-- ===== PROFILES: новые поля =====
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists language text not null default 'ru',
  add column if not exists birth_date date,
  add column if not exists sport text not null default '',
  add column if not exists city text not null default '',
  add column if not exists sport_rank text not null default '',
  add column if not exists bio text not null default '',
  add column if not exists consent_at timestamptz;

update public.profiles set role = 'athlete' where role = 'user';
alter table public.profiles alter column role set default 'athlete';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('athlete','coach','admin'));
alter table public.profiles drop constraint if exists profiles_language_check;
alter table public.profiles add constraint profiles_language_check check (language in ('kk','ru','en'));

create index if not exists profiles_full_name_trgm on public.profiles using gin (full_name gin_trgm_ops);

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role in ('admin','coach'));
$$;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);

create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then
    new.role := old.role;
    new.consent_at := coalesce(old.consent_at, new.consent_at);
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update before update on public.profiles
for each row execute function private.guard_profile_update();

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, language, consent_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    case when new.raw_user_meta_data->>'language' in ('kk','ru','en') then new.raw_user_meta_data->>'language' else 'ru' end,
    case when (new.raw_user_meta_data->>'consent')::boolean is true then now() else null end
  );
  return new;
end $$;

-- ===== ВЫПОЛНЕНИЯ УПРАЖНЕНИЙ =====
create table if not exists public.exercise_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  video_url text not null,
  status text not null default 'pending',
  admin_comment text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint completions_status_check check (status in ('pending','approved','rejected')),
  constraint completions_video_required check (length(trim(video_url)) > 3),
  constraint completions_reject_comment check (status <> 'rejected' or length(trim(coalesce(admin_comment,''))) >= 10)
);
create unique index if not exists completions_active_unique on public.exercise_completions(user_id, exercise_id) where status <> 'rejected';
create index if not exists completions_user_idx on public.exercise_completions(user_id);
create index if not exists completions_exercise_idx on public.exercise_completions(exercise_id);
create index if not exists completions_status_idx on public.exercise_completions(status, created_at desc);

create or replace function private.guard_completion() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'INSERT' then
    if not private.is_staff() then
      new.user_id := auth.uid();
      new.status := 'pending';
      new.admin_comment := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    return new;
  end if;
  new.user_id := old.user_id;
  new.exercise_id := old.exercise_id;
  new.video_url := old.video_url;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_completion on public.exercise_completions;
create trigger trg_guard_completion before insert or update on public.exercise_completions
for each row execute function private.guard_completion();

alter table public.exercise_completions enable row level security;
drop policy if exists "completions_select" on public.exercise_completions;
create policy "completions_select" on public.exercise_completions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
drop policy if exists "completions_insert" on public.exercise_completions;
create policy "completions_insert" on public.exercise_completions for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "completions_update" on public.exercise_completions;
create policy "completions_update" on public.exercise_completions for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
drop policy if exists "completions_delete" on public.exercise_completions;
create policy "completions_delete" on public.exercise_completions for delete to authenticated
  using ((user_id = (select auth.uid()) and status = 'pending') or (select private.is_staff()));

-- ===== ДРУЗЬЯ =====
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  blocked_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_status_check check (status in ('pending','accepted','declined','blocked')),
  constraint friendships_not_self check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_unique on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships(requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id, status);

alter table public.friendships enable row level security;
drop policy if exists "friendships_select" on public.friendships;
create policy "friendships_select" on public.friendships for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()) or (select private.is_staff()));

-- ===== ДИАЛОГИ И СООБЩЕНИЯ =====
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_1 uuid not null references public.profiles(id) on delete cascade,
  participant_2 uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_not_self check (participant_1 <> participant_2)
);
create unique index if not exists conversations_pair_unique on public.conversations (least(participant_1, participant_2), greatest(participant_1, participant_2));
create index if not exists conversations_p1_idx on public.conversations(participant_1, last_message_at desc);
create index if not exists conversations_p2_idx on public.conversations(participant_2, last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'text',
  content text not null default '',
  media_url text,
  duration numeric,
  file_name text,
  file_size bigint,
  waveform jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_type_check check (type in ('text','image','voice','file','video','video_note'))
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages(sender_id, created_at desc);
create index if not exists messages_unread_idx on public.messages(conversation_id) where not is_read;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select" on public.conversations;
create policy "conversations_select" on public.conversations for select to authenticated
  using (participant_1 = (select auth.uid()) or participant_2 = (select auth.uid()));

drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select to authenticated
  using (exists (select 1 from conversations c where c.id = conversation_id and (c.participant_1 = (select auth.uid()) or c.participant_2 = (select auth.uid()))));
drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- ===== АУДИТ =====
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_user_id uuid,
  reason text not null default '',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
create index if not exists audit_log_target_idx on public.audit_log(target_user_id);
alter table public.audit_log enable row level security;
drop policy if exists "audit_select_admin" on public.audit_log;
create policy "audit_select_admin" on public.audit_log for select to authenticated using ((select private.is_admin()));

-- ===== ИНДЕКСЫ НА СТАРЫЕ FK =====
create index if not exists sessions_user_idx on public.sessions(user_id, created_at desc);
create index if not exists session_results_session_idx on public.session_results(session_id);
create index if not exists session_results_exercise_idx on public.session_results(exercise_id);
create index if not exists sport_results_user_idx on public.sport_results(user_id, created_at desc);
create index if not exists sport_results_event_idx on public.sport_results(event_id);
create index if not exists grades_user_idx on public.grades(user_id, created_at desc);
create index if not exists exercises_category_idx on public.exercises(category_id, sort_order);

-- ===== REALTIME =====
do $$ begin alter publication supabase_realtime add table public.messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.conversations; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.friendships; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.exercise_completions; exception when others then null; end $$;

-- ============================================
-- MIGRATION: ccka_kaz_rpc_and_storage (applied)
-- ============================================

-- ===== RPC: ДРУЗЬЯ =====
create or replace function public.send_friend_request(p_user uuid)
returns public.friendships
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid(); v_row friendships;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user is null or p_user = v_uid then raise exception 'BAD_TARGET'; end if;
  if not exists(select 1 from profiles where id = p_user) then raise exception 'NOT_FOUND'; end if;
  if (select count(*) from friendships where requester_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'RATE_LIMIT';
  end if;
  select * into v_row from friendships
   where least(requester_id, addressee_id) = least(v_uid, p_user)
     and greatest(requester_id, addressee_id) = greatest(v_uid, p_user);
  if v_row.id is null then
    insert into friendships(requester_id, addressee_id, status) values (v_uid, p_user, 'pending') returning * into v_row;
    return v_row;
  end if;
  if v_row.status = 'blocked' then raise exception 'BLOCKED'; end if;
  if v_row.status = 'accepted' then raise exception 'ALREADY_FRIENDS'; end if;
  if v_row.status = 'pending' then
    if v_row.addressee_id = v_uid then
      update friendships set status = 'accepted', updated_at = now() where id = v_row.id returning * into v_row;
      return v_row;
    end if;
    raise exception 'ALREADY_SENT';
  end if;
  update friendships set requester_id = v_uid, addressee_id = p_user, status = 'pending', updated_at = now()
   where id = v_row.id returning * into v_row;
  return v_row;
end $$;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns public.friendships
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid(); v_row friendships;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from friendships where id = p_id;
  if v_row.id is null or v_row.addressee_id <> v_uid or v_row.status <> 'pending' then raise exception 'NOT_FOUND'; end if;
  update friendships set status = case when p_accept then 'accepted' else 'declined' end, updated_at = now()
   where id = p_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.cancel_friend_request(p_id uuid)
returns void
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from friendships where id = p_id and requester_id = v_uid and status = 'pending';
end $$;

create or replace function public.remove_friend(p_user uuid)
returns void
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from friendships
   where least(requester_id, addressee_id) = least(v_uid, p_user)
     and greatest(requester_id, addressee_id) = greatest(v_uid, p_user)
     and status in ('accepted','declined');
end $$;

create or replace function public.block_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid(); v_row friendships;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user is null or p_user = v_uid then raise exception 'BAD_TARGET'; end if;
  select * into v_row from friendships
   where least(requester_id, addressee_id) = least(v_uid, p_user)
     and greatest(requester_id, addressee_id) = greatest(v_uid, p_user);
  if v_row.id is null then
    insert into friendships(requester_id, addressee_id, status, blocked_by) values (v_uid, p_user, 'blocked', v_uid);
  else
    if v_row.status = 'blocked' and v_row.blocked_by <> v_uid then raise exception 'BLOCKED'; end if;
    update friendships set status = 'blocked', blocked_by = v_uid, updated_at = now() where id = v_row.id;
  end if;
end $$;

create or replace function public.unblock_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from friendships
   where least(requester_id, addressee_id) = least(v_uid, p_user)
     and greatest(requester_id, addressee_id) = greatest(v_uid, p_user)
     and status = 'blocked' and blocked_by = v_uid;
end $$;

-- ===== RPC: ЧАТ =====
create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_other is null or p_other = v_uid then raise exception 'BAD_TARGET'; end if;
  if not exists(select 1 from profiles where id = p_other) then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from friendships
             where least(requester_id, addressee_id) = least(v_uid, p_other)
               and greatest(requester_id, addressee_id) = greatest(v_uid, p_other)
               and status = 'blocked') then
    raise exception 'BLOCKED';
  end if;
  select id into v_id from conversations
   where least(participant_1, participant_2) = least(v_uid, p_other)
     and greatest(participant_1, participant_2) = greatest(v_uid, p_other);
  if v_id is null then
    insert into conversations(participant_1, participant_2) values (v_uid, p_other) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.send_message(
  p_conversation_id uuid,
  p_type text,
  p_content text default '',
  p_media_url text default null,
  p_duration numeric default null,
  p_file_name text default null,
  p_file_size bigint default null,
  p_waveform jsonb default null
) returns public.messages
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid(); v_conv conversations; v_msg messages; v_other uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_conv from conversations where id = p_conversation_id;
  if v_conv.id is null or (v_conv.participant_1 <> v_uid and v_conv.participant_2 <> v_uid) then raise exception 'NOT_PARTICIPANT'; end if;
  v_other := case when v_conv.participant_1 = v_uid then v_conv.participant_2 else v_conv.participant_1 end;
  if exists(select 1 from friendships
             where least(requester_id, addressee_id) = least(v_uid, v_other)
               and greatest(requester_id, addressee_id) = greatest(v_uid, v_other)
               and status = 'blocked') then
    raise exception 'BLOCKED';
  end if;
  if p_type is null or p_type not in ('text','image','voice','file','video','video_note') then raise exception 'BAD_TYPE'; end if;
  if p_type = 'text' and length(trim(coalesce(p_content,''))) = 0 then raise exception 'EMPTY'; end if;
  if length(coalesce(p_content,'')) > 4000 then raise exception 'TOO_LONG'; end if;
  if p_type <> 'text' and length(trim(coalesce(p_media_url,''))) < 4 then raise exception 'MEDIA_REQUIRED'; end if;
  if p_duration is not null and (p_duration < 0 or p_duration > 3600) then raise exception 'BAD_DURATION'; end if;
  if p_file_size is not null and p_file_size > 104857600 then raise exception 'FILE_TOO_BIG'; end if;
  if (select count(*) from messages where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 20 then
    raise exception 'RATE_LIMIT';
  end if;
  insert into messages(conversation_id, sender_id, type, content, media_url, duration, file_name, file_size, waveform)
  values (p_conversation_id, v_uid, p_type, coalesce(p_content,''), p_media_url, p_duration, p_file_name, p_file_size, p_waveform)
  returning * into v_msg;
  update conversations set last_message_at = v_msg.created_at where id = p_conversation_id;
  return v_msg;
end $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from conversations c where c.id = p_conversation_id and (c.participant_1 = v_uid or c.participant_2 = v_uid)) then
    raise exception 'NOT_PARTICIPANT';
  end if;
  update messages set is_read = true, read_at = now()
   where conversation_id = p_conversation_id and sender_id <> v_uid and not is_read;
end $$;

create or replace function public.get_dialogs()
returns table(
  conversation_id uuid,
  other_id uuid,
  other_name text,
  other_avatar text,
  last_message_at timestamptz,
  last_type text,
  last_content text,
  last_sender uuid,
  last_is_read boolean,
  unread_count bigint
)
language sql security definer set search_path = public, private as $$
  select
    c.id,
    case when c.participant_1 = auth.uid() then c.participant_2 else c.participant_1 end,
    p.full_name,
    p.avatar_url,
    c.last_message_at,
    lm.type,
    lm.content,
    lm.sender_id,
    lm.is_read,
    coalesce(u.cnt, 0)
  from conversations c
  join profiles p on p.id = case when c.participant_1 = auth.uid() then c.participant_2 else c.participant_1 end
  left join lateral (
    select m.type, m.content, m.sender_id, m.is_read
    from messages m where m.conversation_id = c.id
    order by m.created_at desc limit 1
  ) lm on true
  left join lateral (
    select count(*) as cnt from messages m
    where m.conversation_id = c.id and m.sender_id <> auth.uid() and not m.is_read
  ) u on true
  where auth.uid() in (c.participant_1, c.participant_2)
  order by c.last_message_at desc;
$$;

-- ===== RPC: ПРОВЕРКА ВИДЕО =====
create or replace function public.review_completion(p_id uuid, p_approve boolean, p_comment text default null)
returns public.exercise_completions
language plpgsql security definer set search_path = public, private as $$
declare v_uid uuid := auth.uid(); v_row exercise_completions;
begin
  if v_uid is null or not private.is_staff() then raise exception 'FORBIDDEN'; end if;
  select * into v_row from exercise_completions where id = p_id;
  if v_row.id is null then raise exception 'NOT_FOUND'; end if;
  if not p_approve and length(trim(coalesce(p_comment,''))) < 10 then raise exception 'COMMENT_REQUIRED'; end if;
  update exercise_completions
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_comment = case when p_approve then null else trim(p_comment) end,
         reviewed_by = v_uid,
         reviewed_at = now()
   where id = p_id
   returning * into v_row;
  insert into audit_log(admin_id, action, target_user_id, reason, meta)
  values (v_uid, case when p_approve then 'completion_approved' else 'completion_rejected' end,
          v_row.user_id, coalesce(p_comment,''), jsonb_build_object('completion_id', v_row.id, 'exercise_id', v_row.exercise_id));
  return v_row;
end $$;

revoke all on function public.send_friend_request(uuid) from anon;
revoke all on function public.respond_friend_request(uuid, boolean) from anon;
revoke all on function public.cancel_friend_request(uuid) from anon;
revoke all on function public.remove_friend(uuid) from anon;
revoke all on function public.block_user(uuid) from anon;
revoke all on function public.unblock_user(uuid) from anon;
revoke all on function public.get_or_create_conversation(uuid) from anon;
revoke all on function public.send_message(uuid, text, text, text, numeric, text, bigint, jsonb) from anon;
revoke all on function public.mark_conversation_read(uuid) from anon;
revoke all on function public.get_dialogs() from anon;
revoke all on function public.review_completion(uuid, boolean, text) from anon;

-- ===== STORAGE =====
insert into storage.buckets (id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('chat-media','chat-media', false, 52428800) on conflict (id) do nothing;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin()));

drop policy if exists "sub_select_own_or_admin" on storage.objects;
create policy "sub_select_own_or_admin" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_staff()));
drop policy if exists "sub_insert_own" on storage.objects;
create policy "sub_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "sub_delete_own_or_admin" on storage.objects;
create policy "sub_delete_own_or_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'submissions' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_staff()));

drop policy if exists "chat_media_select" on storage.objects;
create policy "chat_media_select" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (c.participant_1 = (select auth.uid()) or c.participant_2 = (select auth.uid()))
  ));
drop policy if exists "chat_media_insert" on storage.objects;
create policy "chat_media_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (c.participant_1 = (select auth.uid()) or c.participant_2 = (select auth.uid()))
    ));
drop policy if exists "chat_media_delete" on storage.objects;
create policy "chat_media_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[2] = (select auth.uid())::text);

-- ============================================
-- MIGRATION: cska_sport_events_realtime (applied)
-- ============================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sport_events'
  ) then
    alter publication supabase_realtime add table public.sport_events;
  end if;
end $$;
