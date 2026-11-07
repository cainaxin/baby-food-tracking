// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.8.0",
  "commit": "d5de782",
  "commitTime": "2026-11-07T16:02:03+08:00",
  "buildTime": "2026-11-07T08:09:07.591Z",
  "releaseNotes": "## v0.8.0\n\n安卓 APK 安装包（Capacitor 原生壳），与网页版并行可用、数据同源。\n\n### 新增\n\n- **安卓 APK**：Capacitor 8 原生壳，`npm run android:apk` 一键构建 debug 安装包。包名 `com.babyday.tracker`，应用名「宝宝日记」，启动图标沿用 PWA 蓝白图标。\n- **返回键**：安卓系统返回键依次关闭弹层 → 回首页 → 退出 App，不会误退。\n- **数据同源**：APK 与网页版共用同一套 Supabase 云端数据，哪边记录全家都可见；本地模式数据各自独立（WebView 存储隔离）。\n- **为什么**：老人手机装浏览器 PWA 有门槛，直接装 APK 更稳，不依赖浏览器缓存与地址栏。\n\n### 与网页版的关系\n\n- 网页版（PWA / OpenWrt 部署）**不受影响**，继续走原有 `npm run build` 与发版流程。\n- 原生构建走 `BUILD_NATIVE=1`，**不注入 Service Worker**，避免 APK 更新后旧缓存挡住新界面。"
} as const
