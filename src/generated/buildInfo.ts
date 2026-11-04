// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.4.5",
  "commit": "03a2f91",
  "commitTime": "2026-11-05T00:40:15+08:00",
  "buildTime": "2026-11-04T16:41:39.604Z",
  "releaseNotes": "## v0.4.5\n\n紧急修复：更新后宝宝列表消失，要求重新添加宝宝。\n\n### 修复\n\n- **宝宝列表消失**：v0.4.4 把 baby 查询改成显式列名 `select('...gender,weight_kg,height_cm...')`，但数据库还没执行建列 SQL，整个查询报错导致 babies 为空。改回 `select('*')`，缺列也不影响读取。\n- **为什么**：数据库 schema 变更和前端代码必须解耦——`select('*')` 天然兼容缺列，显式列名在列不存在时会炸掉整个查询。\n- **禁止**：查询里写死新增字段名；一律 `select('*')` + `mapBaby` 做兜底。"
} as const
