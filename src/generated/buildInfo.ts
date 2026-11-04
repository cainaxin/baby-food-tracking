// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.3.0",
  "commit": "c6d9f49",
  "commitTime": "2026-11-04T09:24:13+08:00",
  "buildTime": "2026-11-04T04:23:10.354Z",
  "releaseNotes": "## v0.3.0\n\n辅食可以拍照记录了，每天吃啥有图可看。\n\n### 功能\n\n- **辅食拍照**：记辅食时可拍一张食物照片（相机或相册）；照片会压到约 1280px JPEG 后保存，本地模式存浏览器、云端存 Supabase `photo_url`。时间线、保存确认弹窗里都能看到照片缩略图/大图，编辑时可重新拍或移除。\n- **为什么**：辅食只记「米粉、果泥」看不出到底吃了啥；有照片后每天回顾更直观，老人也能看懂。\n- **实现要点**：新增 `src/lib/photo.ts` 压缩图片（Canvas，HTTP 入口可用）；`BabyEvent` / `event` 表增加 `photo_url` 字段（`schema.sql` 含 `alter table` 补列语句）；拍照 UI 在辅食表单内，两步内完成「拍 → 保存」。"
} as const
