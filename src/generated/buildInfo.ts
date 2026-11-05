// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.6.1",
  "commit": "4d4b9f0",
  "commitTime": "2026-11-05T21:53:03+08:00",
  "buildTime": "2026-11-05T14:12:38.952Z",
  "releaseNotes": "## v0.6.1\n\n修复 4 个小 bug：成长保存、双人名、小结时间、同步状态。\n\n### 修复\n\n- **身高体重无法保存**：`saveGrowthRecord` 云端 upsert 带了 `updated_at` 字段但 growth 表没有这列，整个保存失败。去掉 `updated_at`，云端失败自动降级存本地。\n- **首页出现两个人名**：`eventSubtitle` 里加了 `createdBy`，时间线旁又单独显示了记录者名，导致重复。去掉 subtitle 里的 createdBy。\n- **每日小结显示生成时间**：标题旁显示「刚刚生成 · HH:mm」或「全家共享 · HH:mm」。\n- **同步状态**：首页顶部从永远显示「全家同步中」改为同步完成后显示「已同步」。\n- **为什么**：都是小问题但影响体验——成长保存失败是最严重的（用户会以为记录丢了）。"
} as const
