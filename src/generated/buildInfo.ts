// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.4.1",
  "commit": "11d9a7a",
  "commitTime": "2026-11-05T00:00:34+08:00",
  "buildTime": "2026-11-04T16:09:29.415Z",
  "releaseNotes": "## v0.4.1\n\n每日小结体验优化：排版更好看、全家共享、历史日期也能生成。\n\n### 功能\n\n- **小结排版优化**：内容分段展示，列表项带圆点标记，卡片更清爽；标题旁显示「已生成」徽章。\n- **全家共享**：生成一次后自动缓存（云端 `daily_summary` 表 / 本地 localStorage），家人打开就能看，不用重复调 AI 花钱；点「重新生成」可刷新。\n- **历史日期支持**：历史页切换到某天也能生成/查看该天小结，标题显示「X 月 X 日 · 每日小结」。\n- **为什么**：原版排版单调、每人打开都要重新生成浪费 API 额度、历史日期没法看小结。\n- **实现要点**：`daily_summary` 表按 `(baby_id, day_key)` 唯一缓存；`fetchDailySummary` 先查缓存再调 AI；Edge Function 不变。"
} as const
