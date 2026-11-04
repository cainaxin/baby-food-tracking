// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.4.4",
  "commit": "3e5437e",
  "commitTime": "2026-11-05T00:32:35+08:00",
  "buildTime": "2026-11-04T16:37:53.739Z",
  "releaseNotes": "## v0.4.4\n\n修复宝宝生日/月龄/体重/身高保存后丢失的 bug；优化「问一问」排版。\n\n### 修复\n\n- **宝宝信息更新不上去**：`loadData()` 查询 baby 表时 `select` 字段漏了 `birth_date, gender, weight_kg, height_cm`，导致保存成功后刷新就丢。改为 `select('*')` 全字段查询。\n- **为什么**：加字段时只改了 insert/update 的写入，忘了改查询的 select 列表；写进去了但读不出来，看起来像\"没保存\"。\n\n### 优化\n\n- **问一问排版**：输入框占满一行（按钮从文字\"问\"改为圆形箭头图标），快捷问题按钮更紧凑、点击有蓝色反馈。"
} as const
