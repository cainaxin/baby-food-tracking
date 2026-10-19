-- 开启家庭实时同步（可重复执行）
-- 需要在 Supabase SQL Editor 执行；否则家人改了记录，本机只能手动刷新

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.event;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.baby;
exception
  when duplicate_object then null;
end $$;

-- 更新/删除时也带完整旧行，方便客户端处理
alter table public.event replica identity full;
alter table public.baby replica identity full;
