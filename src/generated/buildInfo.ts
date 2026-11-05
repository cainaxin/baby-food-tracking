// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.5.9",
  "commit": "c1f1d9c",
  "commitTime": "2026-11-05T21:38:22+08:00",
  "buildTime": "2026-11-05T13:48:40.156Z",
  "releaseNotes": "## v0.5.9\n\n修复头像保存失败和不居中的问题。\n\n### 修复\n\n- **头像拍完保存不了**：`updateProfile` 里云端上传头像失败时没有 try/catch，整个保存被中断。现在云端上传失败自动降级为本地存储，头像一定存得上。\n- **头像不居中**：设置页头像 div 的内联样式 `position: relative` 覆盖了 `.avatar` 的 `display: grid` 居中；`.avatar img` 缺 `display: block`。已修复居中。\n- **为什么**：头像用的是 data URL，上传 Supabase storage 可能失败（网络/大小限制），失败不能阻断保存；CSS 居中被内联样式覆盖。"
} as const
