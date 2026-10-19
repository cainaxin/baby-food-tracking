-- 宝宝日记 · 可重复执行的数据库脚本
-- 在 Supabase SQL Editor 整段 Run（失败后可再 Run）
-- 覆盖：建表（若无）、权限、建家/入家函数

-- ========== 表 ==========
create table if not exists family (
  id uuid primary key default gen_random_uuid(),
  name text not null default '我们的家',
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists family_member (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '家人',
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table if not exists baby (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  name text not null,
  avatar_color text not null default '#0A84FF',
  avatar_url text,
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  baby_id uuid not null references baby(id) on delete cascade,
  type text not null check (type in ('milk','solid','sleep','wake','outing','bath_swim')),
  start_at timestamptz not null,
  end_at timestamptz,
  amount_ml integer check (amount_ml is null or (amount_ml >= 0 and amount_ml <= 2000)),
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_baby_start_idx on event (baby_id, start_at desc);
create index if not exists baby_family_idx on baby (family_id);

-- ========== 函数 ==========
create or replace function is_family_member(fid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from family_member
    where family_id = fid and user_id = auth.uid()
  );
$$;

create or replace function public.create_family_for_user(
  p_name text default '我们的家',
  p_display_name text default '家人'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid;
  v_invite text;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  select fm.family_id into v_family_id
  from family_member fm
  where fm.user_id = v_uid
  order by fm.created_at desc
  limit 1;

  if v_family_id is not null then
    select f.invite_code into v_invite from family f where f.id = v_family_id;
    return json_build_object('family_id', v_family_id, 'invite_code', v_invite);
  end if;

  v_invite := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.family (name, invite_code)
  values (coalesce(p_name, '我们的家'), v_invite)
  returning id into v_family_id;

  insert into public.family_member (family_id, user_id, display_name, role)
  values (v_family_id, v_uid, coalesce(p_display_name, '家人'), 'admin');

  return json_build_object('family_id', v_family_id, 'invite_code', v_invite);
end;
$$;

create or replace function public.join_family_for_user(
  p_invite_code text,
  p_display_name text default '家人'
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_family_id uuid;
  v_invite text;
begin
  if v_uid is null then
    raise exception 'unauthenticated';
  end if;

  v_invite := upper(trim(coalesce(p_invite_code, '')));
  if v_invite = '' then
    raise exception 'invite_required';
  end if;

  select id into v_family_id from family where invite_code = v_invite;
  if v_family_id is null then
    raise exception 'invite_invalid';
  end if;

  delete from public.family_member
  where user_id = v_uid and family_id <> v_family_id;

  insert into public.family_member (family_id, user_id, display_name, role)
  values (v_family_id, v_uid, coalesce(p_display_name, '家人'), 'member')
  on conflict (family_id, user_id)
  do update set display_name = excluded.display_name;

  return json_build_object('family_id', v_family_id, 'invite_code', v_invite);
end;
$$;

grant execute on function public.create_family_for_user(text, text) to authenticated;
grant execute on function public.join_family_for_user(text, text) to authenticated;

-- ========== RLS（先 drop 再 create，可重复执行） ==========
alter table family enable row level security;
alter table family_member enable row level security;
alter table baby enable row level security;
alter table event enable row level security;

drop policy if exists family_select on family;
drop policy if exists family_insert on family;
drop policy if exists family_update on family;
create policy family_select on family
  for select using (is_family_member(id));
create policy family_insert on family
  for insert with check (auth.uid() is not null);
create policy family_update on family
  for update using (is_family_member(id))
  with check (is_family_member(id));

drop policy if exists member_select on family_member;
drop policy if exists member_insert on family_member;
drop policy if exists member_update on family_member;
create policy member_select on family_member
  for select using (user_id = auth.uid() or is_family_member(family_id));
create policy member_insert on family_member
  for insert with check (user_id = auth.uid());
create policy member_update on family_member
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists baby_select on baby;
drop policy if exists baby_write on baby;
create policy baby_select on baby
  for select using (is_family_member(family_id));
create policy baby_write on baby
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

drop policy if exists event_select on event;
drop policy if exists event_write on event;
create policy event_select on event
  for select using (is_family_member(family_id));
create policy event_write on event
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- Storage 头像桶
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatar_read on storage.objects;
drop policy if exists avatar_insert on storage.objects;
drop policy if exists avatar_update on storage.objects;
create policy avatar_read on storage.objects
  for select using (bucket_id = 'avatars');
create policy avatar_insert on storage.objects
  for insert with check (bucket_id = 'avatars');
create policy avatar_update on storage.objects
  for update using (bucket_id = 'avatars');
