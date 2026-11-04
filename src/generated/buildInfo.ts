// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.3.1",
  "commit": "a581ba4",
  "commitTime": "2026-11-04T12:23:19+08:00",
  "buildTime": "2026-11-04T10:31:08.317Z",
  "releaseNotes": "## v0.3.1\n\n修复 v0.3.0 所有记录保存报错的问题。\n\n### 修复\n\n- **所有记录保存失败**：v0.3.0 的 `saveEvent` 往**每条记录**的 body 里都带 `photo_url` 字段，但 Supabase 数据库还没执行 `alter table ... add column photo_url`，导致所有类型（吃奶、睡觉等）都被数据库拒绝（`Could not find the 'photo_url' column`）。\n- **原因**：代码假设数据库字段已存在，但实际用户侧的 Supabase 还没跑迁移 SQL；每次保存都触发了这个错误。\n- **实现要点**：\n  - `photo_url` 只在**真有照片**时才写入 body，普通记录不再带这个字段；\n  - 带照片的保存若因缺列报错，自动降级（去 `photo_url` 重试）保住记录本身，toast 提示\"照片没存上\"；\n  - 根治方案仍在 Supabase SQL Editor 执行 `alter table event add column if not exists photo_url text;`（见 `supabase/schema.sql`）。"
} as const
