// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.5.4",
  "commit": "cc52848",
  "commitTime": "2026-11-05T13:44:24+08:00",
  "buildTime": "2026-11-05T09:58:52.581Z",
  "releaseNotes": "## v0.5.4\n\n修复历史页「昨天」按钮点击后不高亮的问题。\n\n### 修复\n\n- **「昨天」不高亮**：「今天」按钮有 `active` 高亮判断，「昨天」漏了，点了不显示选中态。补上判断，和「今天」一致。\n- **为什么**：两个按钮应该行为一致，漏了一行判断。"
} as const
