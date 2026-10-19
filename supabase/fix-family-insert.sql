-- 宝宝日记 · 建家/入家函数 + 权限修复
-- 在 Supabase SQL Editor 整段执行（可重复运行）

-- 1) 确保 family 可创建
drop policy if exists family_insert on family;
create policy family_insert on family
  for insert with check (auth.uid() is not null);

drop policy if exists family_update on family;
create policy family_update on family
  for update using (
    exists (
      select 1 from family_member fm
      where fm.family_id = family.id and fm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from family_member fm
      where fm.family_id = family.id and fm.user_id = auth.uid()
    )
  );

drop policy if exists member_insert on family_member;
create policy member_insert on family_member
  for insert with check (user_id = auth.uid());

drop policy if exists member_update on family_member;
create policy member_update on family_member
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2) 建家函数（SECURITY DEFINER，登录用户调用）
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

-- 3) 入家函数
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

  insert into public.family_member (family_id, user_id, display_name, role)
  values (v_family_id, v_uid, coalesce(p_display_name, '家人'), 'member')
  on conflict (family_id, user_id)
  do update set display_name = excluded.display_name;

  return json_build_object('family_id', v_family_id, 'invite_code', v_invite);
end;
$$;

grant execute on function public.create_family_for_user(text, text) to authenticated;
grant execute on function public.join_family_for_user(text, text) to authenticated;
