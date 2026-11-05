// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.4.8",
  "commit": "e0bd00a",
  "commitTime": "2026-11-05T11:22:58+08:00",
  "buildTime": "2026-11-05T03:33:23.737Z",
  "releaseNotes": "## v0.4.8\n\n新增成长记录：身高体重按日期记录，拉曲线看变化。\n\n### 功能\n\n- **成长记录**：历史页新增「📏 成长记录」卡片，可按日期记录身高（cm）和体重（kg）；显示最近一次数据、变化曲线（SVG 折线图，体重/身高可切换）、最近 5 条记录列表。同一天重复记录自动覆盖。\n- **为什么**：身高体重不是固定值，只在宝宝资料里存一个\"最近值\"看不到成长趋势；按日期记录 + 曲线图才能看出宝宝长得好不好。\n- **实现要点**：\n  - 新增 `growth` 表（`baby_id + day_key` 唯一，upsert 覆盖）；数据库缺列时降级保存并提示。\n  - 本地模式存 localStorage（`baby-tracker-growth`）。\n  - `GrowthChart` 用 SVG 画折线图，标注数据点数值和日期。\n  - 数据不足 2 条时提示\"再记录一次就能看到变化曲线\"。\n\n### 需要执行的 SQL（Supabase SQL Editor）\n\n```sql\ncreate table if not exists growth (\n  id uuid primary key default gen_random_uuid(),\n  family_id uuid not null references family(id) on delete cascade,\n  baby_id uuid not null references baby(id) on delete cascade,\n  day_key text not null,\n  weight_kg numeric,\n  height_cm numeric,\n  note text,\n  created_by text,\n  created_at timestamptz not null default now(),\n  unique (baby_id, day_key)\n);\nalter table growth enable row level security;\ncreate policy growth_select on growth for select using (is_family_member(family_id));\ncreate policy growth_write on growth for all using (is_family_member(family_id)) with check (is_family_member(family_id));\n```"
} as const
