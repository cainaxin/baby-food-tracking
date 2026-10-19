-- 扩展事件类型：换尿布 diaper、喝水 water
-- 可重复执行；线上已有库请在 SQL Editor 跑一遍本文件

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'event'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%type%';

  if cname is not null then
    execute format('alter table event drop constraint %I', cname);
  end if;
end $$;

alter table event add constraint event_type_check
  check (type in ('milk','solid','water','diaper','sleep','wake','outing','bath_swim'));
