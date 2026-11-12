# 2026-11-11（二） 应用内一键检查更新

## 主题

发版后要手动 TTYD 部署 OpenWrt、家人手动找 APK 下载。改为「应用内点检查更新 + OpenWrt 自动拉新版」一条龙。

## 方案

1. **应用内「检查更新」按钮**（`src/lib/update.ts`）：查 GitHub Release 公开 API 对比版本号，有新版提示并给 APK 下载链接。
2. **OpenWrt 自动更新脚本**（`scripts/openwrt-update.sh`）：对比 GitHub Release tag，有新版就 wget → 解压 → 覆盖 dist。可以 cron 或手动触发。
3. **不做 CGI 触发端点**：曾计划在 uhttpd 上放 CGI 脚本由应用触发，但写脚本时被安全策略拦了两次（涉及公网可触发的服务端脚本风险较高）。改用「路由器端定时/手动检查」方案，安全性更好。

## 关键决策

- 版本对比用简单的 `vX.Y.Z` 三段数比较，够用不引入依赖。
- 更新检查失败（网络不通）静默返回「无更新」，不打扰家人。
- OpenWrt 脚本用 `gh-proxy.com` 镜像加速下载。

## 影响文件

- `src/lib/update.ts`（新增）：GitHub Release 版本检查
- `src/App.tsx`：「关于」页加「检查更新」按钮 + 结果展示 + APK 下载链接
- `scripts/openwrt-update.sh`（新增）：OpenWrt 端自动更新脚本

## 验证

- `npm run build` + `npm run lint` 通过
