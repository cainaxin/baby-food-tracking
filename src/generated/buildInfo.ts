// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.4.6",
  "commit": "37dad53",
  "commitTime": "2026-11-05T00:41:48+08:00",
  "buildTime": "2026-11-04T16:46:02.002Z",
  "releaseNotes": "## v0.4.6\n\n修复宝宝性别/体重/身高无法编辑保存的问题。\n\n### 修复\n\n- **宝宝信息保存失败**：保存时带上 `gender/weight_kg/height_cm` 等新字段，但数据库还没加列，整个保存被拒绝。现在改为**降级重试**——带新字段失败时自动去掉新字段只保存基本资料（名字/头像/生日），并 toast 提示\"性别/体重/身高未存上：数据库需补字段\"。\n- **为什么**：和 v0.3.0 的 `photo_url` 同类问题——数据库 schema 变更和前端代码必须解耦，缺列时要降级而不是全挂。\n- **根治方案**：Supabase SQL Editor 执行建列语句后即可正常保存全部信息（见下）。\n\n### 需要执行的 SQL（Supabase SQL Editor）\n\n```sql\nalter table baby add column if not exists gender text;\nalter table baby add column if not exists weight_kg numeric;\nalter table baby add column if not exists height_cm numeric;\n```"
} as const
