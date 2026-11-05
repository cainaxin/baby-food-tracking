// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.7.3",
  "commit": "b26784a",
  "commitTime": "2026-11-05T22:55:46+08:00",
  "buildTime": "2026-11-05T14:58:45.956Z",
  "releaseNotes": "## v0.7.3\n\n修复月龄计算偏低的 bug（如 3月5日出生 11月5日应为 8 个月却显示少一个月）。\n\n### 修复\n\n- **月龄算错**：`new Date(\"2026-03-05\")` 按 UTC 午夜解析，中国时区（UTC+8）下日期偏移了一天，导致月龄少一个月。改为手动解析 `YYYY-MM-DD` 字符串为本地年月日再算，不受时区影响。`formatMonthAge` 和 `getMonthAgeFromDate` 都修了。\n- **为什么**：JS 的 `new Date(\"YYYY-MM-DD\")` 是 UTC 解析的著名坑，东八区下日期减 1，月初出生的宝宝最容易算错。"
} as const
