// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.4.2",
  "commit": "31cfcd1",
  "commitTime": "2026-11-05T00:23:45+08:00",
  "buildTime": "2026-11-04T16:27:18.716Z",
  "releaseNotes": "## v0.4.2\n\n修复每日小结没走 AI、只显示本地降级文案的问题。\n\n### 修复\n\n- **小结未调用 AI**：前端用 `supabase.functions.invoke()` 调 Edge Function 失败（静默降级为本地模板文案），改为直接 `fetch` 调用 EF 接口（与验证通过的方式一致），并把错误打进 console 便于排查。\n- **为什么**：`invoke()` 在 HTTP 入口或某些环境下可能失败，而失败被 `catch` 吞掉后用户看到的是本地统计文案，误以为是 AI 生成的。\n- **实现要点**：`summary.ts` 改用 `fetch(`${supabaseUrl}/functions/v1/daily-summary`)`；`supabase.ts` 导出 `supabaseUrl` / `supabaseAnonKey`。"
} as const
