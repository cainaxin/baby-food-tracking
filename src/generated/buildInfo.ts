// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.4.0",
  "commit": "e6ba8aa",
  "commitTime": "2026-11-04T18:31:15+08:00",
  "buildTime": "2026-11-04T15:38:30.580Z",
  "releaseNotes": "## v0.4.0\n\n外出超时提醒、宝宝个人信息、AI 每日小结。\n\n### 功能\n\n- **外出超时提醒**：外出超过 3 小时（睡觉超过 12 小时）还没填结束时间时，首页顶部出现红色醒目横幅，一键跳去补时间。外出统计改为不跨天（只算开始当天，截断到 24:00）。\n- **宝宝个人信息**：添加/编辑宝宝时可填生日、性别、体重、身高；首页宝宝卡片显示月龄（如「3 个月」）、性别、体重、身高。\n- **AI 每日小结**：首页「每日小结」卡片，点「生成小结」后根据当天记录（奶量、睡眠、外出、尿布、辅食 + 宝宝月龄/体重）给出总结和建议，鼓励做得好的部分。AI 调用 DeepSeek（deepseek-chat，最便宜），key 存在 Supabase Edge Function 服务端环境变量里，前端永远看不到 key；未部署 EF 时降级为本地统计文字。\n- **为什么**：外出/睡觉忘关导致统计不准；只有文字记录看不出宝宝成长情况；老人需要简单易懂的每日建议。\n- **实现要点**：\n  - 外出 `outingMinutesOnDay` 改为只算开始那天并截断到 24:00；\n  - `findStaleSpans` 扫描未关闭的外出/睡觉，超阈值时首页显示 `alert-banner`；\n  - `Baby` 增加 `birthDate/gender/weightKg/heightCm`，`formatMonthAge` 算月龄；数据库列缺失时自动降级不写入；\n  - AI 走 `supabase/functions/daily-summary/`（Deno），前端 `fetchDailySummary` 调用 EF；未部署或失败时用 `fallbackSummary` 本地文案。"
} as const
