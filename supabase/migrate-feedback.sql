-- 反馈与建议：可重复执行
-- 在 Supabase SQL Editor 整段 Run

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  content text not null,
  contact text,
  created_by text,
  status text not null default 'pending' check (status in ('pending','done')),
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

-- 开发者判定：按主账号邮箱识别（先建函数，策略才可用）
create or replace function is_developer()
returns boolean
language sql
security definer
stable
as $$
  select lower(coalesce(
    (select email from auth.users where id = auth.uid()),
    ''
  )) = '1252568105@qq.com';
$$;

grant execute on function is_developer() to authenticated;

drop policy if exists feedback_insert on feedback;
drop policy if exists feedback_select on feedback;
drop policy if exists feedback_update on feedback;

-- 家人可提交
create policy feedback_insert on feedback
  for insert with check (is_family_member(family_id));

-- 仅开发者（主账号）可查看
create policy feedback_select on feedback
  for select using (is_developer());

-- 仅开发者可标记状态（如「已处理」）
create policy feedback_update on feedback
  for update using (is_developer())
  with check (is_developer());
