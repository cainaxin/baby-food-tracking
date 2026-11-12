# 操作日志 INDEX

按主题检索失败案例、决策与环境信息。详细过程见当日文件。

## 如何使用

1. 新对话遇到类似问题 → 先查本 INDEX 的标签/关键词  
2. 打开对应日期文件，看「原因 / 反思 / 禁止事项」  
3. **每次改动、事故、关键决策**：写当日 journal，并在本表加一行  

## 索引

| 日期 | 主题 | 标签 | 结果 | 文件 |
|------|------|------|------|------|
| 2026-11-01 | OpenWrt 部署静态站（保留 Supabase） | deploy, openwrt, nginx, supabase | 成功（3006 可登录） | [2026-11-01](./2026-11-01.md) |
| 2026-11-01 | 主路由 Docker 端口映射导致全家断网 | **failure**, docker, iptables, firewall, outage, openwrt | 已恢复；禁止再犯 | [2026-11-01](./2026-11-01.md#事故主路由-docker--firewall-导致断网) |
| 2026-11-01 | 保存成功确认弹窗（展示记录 + 重新编辑） | ui, event, save | 已完成 | [2026-11-01](./2026-11-01.md) |
| 2026-11-01 | OpenWrt 入口能看不能改（HTTP 下 crypto.randomUUID） | bug, openwrt, http, crypto, secure-context, write | 已改用 uid() | [2026-11-01-openwrt-write](./2026-11-01-openwrt-write.md) |
| 2026-11-02 | 关于页改为「版本/更新内容」选项卡 | ui, about, changelog, tabs | 已完成 | [2026-11-02](./2026-11-02.md) |
| 2026-11-04 | 外出按时长统计（统计卡片 + 趋势曲线 + 明细） | ui, stats, outing, duration, trend | 已完成 | [2026-11-04](./2026-11-04.md) |
| 2026-11-04 | 辅食拍照记录（表单 + 时间线 + 确认弹窗） | ui, solid, photo, event, storage | 已完成 | [2026-11-04-solid-photo](./2026-11-04-solid-photo.md) |
| 2026-11-04 | **v0.3.0 所有记录保存失败**（photo_url 未迁移） | **failure**, bug, supabase, schema, photo, save | v0.3.1 热修 | [2026-11-04-v0.3.1-fix](./2026-11-04-v0.3.1-fix.md) |
| 2026-11-04 | v0.4.0 大版本：外出提醒/宝宝信息/AI 小结 | ui, outing, baby, ai, deepseek, security | 已完成 | [2026-11-04-v0.4.0](./2026-11-04-v0.4.0.md) |
| 2026-11-04 | v0.4.1 每日小结：排版/共享缓存/历史支持 | ui, summary, ai, cache | 已完成 | [2026-11-04-v0.4.1](./2026-11-04-v0.4.1.md) |
| 2026-11-07 | 安卓 APK（Capacitor 壳）与网页版并存 | android, capacitor, apk, native | 已完成 | [2026-11-07](./2026-11-07.md) |
| 2026-11-11 | 启动加速：缓存秒开 + 增量同步 | perf, cache, sync, incremental, realtime | 已完成 | [2026-11-11](./2026-11-11.md) |
| 2026-11-11 | 应用内一键检查更新 + OpenWrt 自动更新脚本 | update, release, apk, openwrt | 已完成 | [2026-11-11-app-update](./2026-11-11-app-update.md) |
| 2026-11-13 | 关于页常驻「下载 APK」按钮 + Release latest 别名资产 | ui, apk, download, release | 已完成 | [2026-11-13](./2026-11-13.md) |
| 2026-11-13 | 反馈与建议：家人提交 + 主账号 App 内查看 | feedback, supabase, rls, ui | 已完成 | [2026-11-13](./2026-11-13.md) |

## 环境速查

- **OpenWrt 下载 GitHub 资产用镜像**：`https://gh-proxy.com/https://github.com/...`（`mirror.ghproxy.com` / `ghfast.top` 常不可用）
- **发版走脚本**：`node scripts/release.mjs v0.4.5 "描述"`，别用 PowerShell `Invoke-RestMethod` 发 Release——中文 body 会变 `?`（编码问题）。脚本用 Node `TextEncoder` UTF-8 发请求。

## 标签约定

- `failure`：失败案例，必须有「反思」与「禁止事项」
- `deploy` / `network` / `data` / `auth` / `ui`：领域
- 组件名：`openwrt` `docker` `nginx` `supabase` `vercel` `nas` 等
