// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.9.2",
  "commit": "eb93cec",
  "commitTime": "2026-11-12T23:58:43+08:00",
  "buildTime": "2026-11-12T16:13:35.197Z",
  "releaseNotes": "## v0.9.2\n\n「我的 → 关于」新增常驻「下载 APK」按钮，安卓手机打开网页就能直接下载安装包。\n\n### 新增\n\n- **下载 APK 按钮**：「关于」页常驻一个大按钮，点击直接下载最新 APK，不用先点「检查更新」。链接固定指向 Release 的 `baby-food-tracker-latest.apk`，永远是最新的。\n- **Release 自动别名**：发版脚本在上传版本号 APK 的同时，额外上传一份 `latest` 别名资产，保证固定链接始终可用。\n- **为什么**：之前只有发现新版本才出现下载链接，家人第一次装 APK 还是要去 GitHub 找，很不方便。现在网页上就有明确入口。"
} as const
