// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.6.0",
  "commit": "4244850",
  "commitTime": "2026-11-05T21:48:49+08:00",
  "buildTime": "2026-11-05T13:52:51.535Z",
  "releaseNotes": "## v0.6.0\n\n头像全家同步：所有人可见。\n\n### 功能\n\n- **头像云端同步**：用户头像存 Supabase `family_member.avatar_url`，全家手机都能看到彼此的头像（上传到 storage 存公开 URL，同时写入 `avatar_url` 列）。云端存储失败自动降级本地，不阻断保存。\n- **头像轻量化**：头像压缩到 96×96（约 3-5KB），不给云端存储增加压力。\n- **为什么**：之前头像只存 localStorage，家人之间看不到；全家共享记录也该共享头像。\n- **实现要点**：`getSessionUser` 读 `avatar_url`；`updateProfile` 同时写云端 `family_member.avatar_url` 和本地缓存；缺列时降级。\n\n### 需要执行的 SQL（Supabase SQL Editor）\n\n```sql\nalter table family_member add column if not exists avatar_url text;\n```"
} as const
