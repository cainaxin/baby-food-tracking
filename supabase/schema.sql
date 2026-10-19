-- 宝宝日记 · Supabase schema（P2 云同步）
-- 在 Supabase SQL Editor 中执行。当前应用为本地优先，此文件供接入时使用。

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

-- RLS：仅家庭成员可访问
alter table family enable row level security;
alter table family_member enable row level security;
alter table baby enable row level security;
alter table event enable row level security;

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

create policy family_select on family
  for select using (is_family_member(id));

create policy family_insert on family
  for insert with check (auth.uid() is not null);

create policy family_update on family
  for update using (is_family_member(id))
  with check (is_family_member(id));

create policy member_select on family_member
  for select using (is_family_member(family_id));

create policy member_insert on family_member
  for insert with check (user_id = auth.uid());

create policy member_update on family_member
  for update using (user_id = auth.uid() or is_family_member(family_id))
  with check (user_id = auth.uid() or is_family_member(family_id));

create policy baby_select on baby
  for select using (is_family_member(family_id));

create policy baby_write on baby
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

create policy event_select on event
  for select using (is_family_member(family_id));

create policy event_write on event
  for all using (is_family_member(family_id))
  with check (is_family_member(family_id));

-- Realtime（Supabase Dashboard → Database → Replication 中开启 event / baby）
-- create publication supabase_realtime for table event, baby;

-- Storage：头像桶（Dashboard → Storage → New bucket）
--   name: avatars  Public: ON（或关闭公开并用 signed URL）
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatar_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatar_insert on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy avatar_update on storage.objects
  for update using (bucket_id = 'avatars');
