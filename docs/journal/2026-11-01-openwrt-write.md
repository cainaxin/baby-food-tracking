# 2026-11-01 · OpenWrt 入口能看不能改

**标签**：`bug` `openwrt` `http` `crypto` `secure-context` `write`

## 现象

- `http://nxhome.cloud:3006` 可打开、可登录、可查看历史记录。
- 点「记一笔 / 保存」界面无反应或记录写不进云端；刷新后数据没有变化。

## 原因

- 家宽入口是 **HTTP**（`http://nxhome.cloud:3006`），浏览器处于**非安全上下文**。
- `crypto.randomUUID()` **仅在 HTTPS / localhost 等安全上下文可用**（MDN：Secure context）。
- `handleSaveEvent` 里新建乐观记录时直接调用 `crypto.randomUUID()`，HTTP 下抛出
  `TypeError: crypto.randomUUID is not a function`。
- 异常发生在 `saveEvent` 之前，云端写入根本没发起，所以「能看不能改」。
- HTTPS 的 Vercel 站点不暴露此问题，仅家宽 HTTP 入口踩坑。

## 反思

- 家用自部署常常是 HTTP；**不能假设 `crypto.randomUUID` / `navigator.clipboard` 等安全上下文 API 一定存在**。
- 写入路径若在「乐观更新」阶段就抛错，用户几乎看不到失败原因；异常要吞掉并回落到兼容 ID。
- 代码里已有 `uid()`（`Date.now` + `Math.random`）在本地模式使用，却没复用到云端乐观 ID。

## 禁止事项

- **禁止**在可能以 HTTP 部署的前端里无保护地调用 `crypto.randomUUID()`、`navigator.clipboard`、`Notification`、`navigator.mediaDevices` 等安全上下文 API。
- 生成本地 ID 一律走 `src/lib/store.ts` 的 `uid()`（HTTP / HTTPS 都可用）。
- 改完前端后必须 `npm run build` 自测并更新 dist，避免 OpenWrt 上继续跑旧包。

## 修复

- `src/App.tsx`：乐观 ID 改用 `uid()`，不再依赖 `crypto.randomUUID`。
