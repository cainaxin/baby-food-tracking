# 更新日志

## Unreleased

### 部署（2026-11-01）

- **家宽入口上线**：前端静态包部署到 OpenWrt（iStoreOS / i5），`http://nxhome.cloud:3006`，国内手机无 VPN 可访问。
- **后端保持 Supabase**：登录 / 同步 / 实时仍用 `zxlcsmdsgqnsvcqpokdd.supabase.co`；根路径返回 `{"error":"requested path is invalid"}` 属正常，不代表不可用。
- **原因**：`*.vercel.app` 在手机流量下打不开（电脑宽带常可打开），Vercel 管理台 `vercel.com` 可登录≠生产站可用。
- **代码**：业务代码零改动；`npm run build` 后 `dist` 经 GitHub Release `home-dist-v1` 传到 OpenWrt，Docker `nginx:alpine` 托管。

### 事故（2026-11-01）— 必须记住

- **现象**：部署过程中家里网全断（与关闭 TTYD 网页无关，时间巧合）。
- **根因**：在 **iStoreOS 主路由** 上执行 `docker run -p 3006:80`（Docker 改写 iptables）+ 随后 `/etc/init.d/firewall restart`，与 OpenWrt fw3/fw4 冲突，NAT/转发损坏。
- **错误决策**：不应在主路由器上用带端口映射的 Docker；更不应在 Docker 后重启防火墙。
- **恢复**：`docker stop/rm baby-web` → `docker stop docker` → `firewall restart` + `network restart`；无效则断电重启路由器。
- **后续约束**：主路由上网稳定优先；宝宝站再上线须用「不碰 iptables」方案（见项目 MEMORY.md）。

### 规则

- **AGENTS.md**：修改需 commit + 更新 CHANGELOG（含**为什么改**）；自测通过后 push 远程。
- **关键环境/事故/决策**必须写入 CHANGELOG 与项目 MEMORY，保证新对话可续做。

---

## v0.2.2

HTTP 家宽入口可以正常「记一笔」了。

### 修复

- **能看不能改**：`http://` 入口下新建记录时调用 `crypto.randomUUID()`（仅 HTTPS 可用）抛 `TypeError`，写入未发起。改为 `uid()`（`Date.now` + `Math.random`），HTTP / HTTPS 均可保存。

### 原因

- OpenWrt 家宽入口是 `http://nxhome.cloud:3006`，非安全上下文；HTTPS 的 Vercel 站点不暴露此问题。
- 本地模式已在用 `uid()`，云端乐观 ID 却单独调了 `crypto.randomUUID`。

### 禁止事项

- HTTP 部署的前端不得无保护调用 `crypto.randomUUID` / `navigator.clipboard` 等安全上下文 API。

### 升级说明

- GitHub Release：`v0.2.2` / `home-dist-v2`（`baby-dist-v2.tar.gz`）。
- OpenWrt：解压覆盖 `/root/baby-food-tracker/dist` 后刷新 PWA；不必动 Docker / 防火墙。

---

## v0.2.1

跨夜睡眠不再算错，界面可查版本与更新内容。

### 修复

- **跨天睡眠**：时间线与历史按「与当日重叠」展示，夜觉两天都能看到，并标「跨天」
- **睡眠统计**：当日睡眠 / 趋势按重叠区间拆到各日（22:00–07:00 → 昨天 2h + 今天 7h）
- **是否在睡**：看全部记录里最近一次睡觉，跨过午夜仍显示「睡着中」
- **起床回填**：记「起床」时自动把上一条未结束睡眠的结束时间填为起床时刻
- **时长校验**：结束时间必须晚于开始时间；未填结束的睡眠统计上限 18 小时
- **展示**：跨夜区间显示「22:00 – 次日 07:00」

### 功能

- **关于**：「我的」页可查看版本号、Commit、构建时间、本版修复内容

---

## v0.2.0

记录更完整、更跟手，历史页可看统计和变化曲线。

### 功能

- **换尿布**：尿尿 / 拉屎 / 尿尿+拉屎
- **喝水**：毫升数，5ml 步进
- **吃奶**：可选结束时间；类型可选 亲喂 / 冻奶 / 奶粉
- **辅食**：类型可多选、可增删自定义选项
- **首页**：最近吃奶「距上次」、最近睡眠「已清醒」蓝色时长提示
- **历史**：当日统计（奶量/睡眠/尿布/喝水/辅食/外出）；周/月变化曲线，可切换维度，点柱子联动当日明细
- **导出**：干净备份 JSON（宝宝、记录、辅食类型）
- **体验**：记录先本地秒回再后台同步，家人改动自动推送

### 技术

- Realtime 发布脚本：`supabase/migrate-realtime.sql`
- 事件类型扩展脚本：`supabase/migrate-event-types.sql`
- 主库脚本 `supabase/fix-family-share.sql` 已同步上述约束与 Realtime

### 升级说明

- 已有云端库：执行 `migrate-event-types.sql`、`migrate-realtime.sql`（若尚未执行）
- 客户端刷新或重新打开 PWA 即可使用新版本

### 代码

- Git 标签：`v0.2.0`

---

## v0.1.0（首个可用版本）

家庭共用的宝宝作息记录 PWA：一人记录，全家实时可见。

### 功能

- **六类记录**：吃奶（含奶量 ml）、辅食、睡觉、起床、外出、洗澡/游泳
- **首页**：今日状态摘要、今日时间线、快捷大按钮记一笔
- **历史**：按日查看
- **多宝宝**：添加/编辑、头像（相册或首字色块）、一键切换
- **家庭协同**：邮箱注册登录、家庭邀请码、加入家庭、实时同步
- **编辑删除**：时间线点按修改/删除
- **PWA**：可「添加到主屏幕」，iOS 风格、大按钮、中文短标签

### 技术

- 前端：Vite + React + TypeScript
- 云端：Supabase（Auth / Postgres / Realtime / Storage）
- 部署：Vercel（生产）+ Supabase（数据）
- 数据库脚本：`supabase/fix-family-share.sql`（可重复执行的主脚本）

### 环境变量

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 已知事项

- 部分手机网络下 `*.vercel.app` 可能无法访问，可绑域名或换国内托管
- 未上架应用商店（以 PWA 分发）

### 代码

- Git 标签：`v0.1.0`
- 提交基线：`b1c890b`（功能）+ 标签与本文档
