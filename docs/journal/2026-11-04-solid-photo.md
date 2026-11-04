# 2026-11-04 · 辅食拍照

**标签**：`ui` `solid` `photo` `event` `storage`

## 需求

记辅食时支持拍照，能看到每天吃了啥。

## 改动

- `src/lib/photo.ts`：`compressImage()` 用 Canvas 把相机/相册图片压到约 1280px JPEG（HTTP 入口可用，不用安全上下文 API）。
- `BabyEvent` / Supabase `event` 表：新增 `photoUrl` / `photo_url`（`schema.sql` 含 `alter table event add column if not exists photo_url text`）。
- 辅食表单：类型选择下方增加「拍照记录」区（拍照 / 重拍 / 移除）。
- 时间线：有照片时在条目下显示 72×72 缩略图。
- 保存确认弹窗：显示照片，方便确认拍的是不是这顿。

## 为什么

辅食只记文字（米粉、果泥）看不出实际吃了啥；有照片后回顾更直观，老人也能看懂。

## 约束 / 注意

- 家宽入口是 HTTP：只用 Canvas + File input，禁用 `crypto.randomUUID` / clipboard 等安全上下文 API。
- 本地模式照片直接存 `photo_url`（data URL）进 localStorage；云端模式若照片大会撑爆本地缓存——已压缩到 1280px / q0.82 控制体积。
- 云端需在 Supabase SQL Editor 执行 `schema.sql` 里的补列语句，否则插入会报未知字段。
