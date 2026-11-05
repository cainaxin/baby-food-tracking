// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.5.6",
  "commit": "ac702ad",
  "commitTime": "2026-11-05T21:17:17+08:00",
  "buildTime": "2026-11-05T13:21:02.307Z",
  "releaseNotes": "## v0.5.6\n\nAI 上下文加上宝宝当前状态，不再给出不合时宜的建议。\n\n### 修复\n\n- **AI 不知道宝宝在干嘛**：宝宝正在睡觉时，AI 看到\"睡眠总时长只有 5 小时\"就建议\"快去睡觉\"，其实已经睡了。现在 `summarizeDay` 会检测未结束的睡觉/外出记录，在摘要里写明「当前状态：正在睡觉（已睡 X 小时）」，并明确告诉 AI「宝宝正在睡觉就别建议去睡」。\n- **为什么**：AI 只看统计数据不知道实时状态，会给出矛盾建议，老人看了反而困惑。\n- **实现要点**：`summarizeDay` 检测最近一条未结束的 sleep/outing；每日小结和问一问的提示词都加了「⚠️ 注意当前状态」规则。"
} as const
