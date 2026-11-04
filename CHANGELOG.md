# 更新日志

## v0.4.2

修复每日小结没走 AI、只显示本地降级文案的问题。

### 修复

- **小结未调用 AI**：前端用 `supabase.functions.invoke()` 调 Edge Function 失败（静默降级为本地模板文案），改为直接 `fetch` 调用 EF 接口（与验证通过的方式一致），并把错误打进 console 便于排查。
- **为什么**：`invoke()` 在 HTTP 入口或某些环境下可能失败，而失败被 `catch` 吞掉后用户看到的是本地统计文案，误以为是 AI 生成的。
- **实现要点**：`summary.ts` 改用 `fetch(`${supabaseUrl}/functions/v1/daily-summary`)`；`supabase.ts` 导出 `supabaseUrl` / `supabaseAnonKey`。

## v0.4.1

每日小结体验优化：排版更好看、全家共享、历史日期也能生成。

### 功能

- **小结排版优化**：内容分段展示，列表项带圆点标记，卡片更清爽；标题旁显示「已生成」徽章。
- **全家共享**：生成一次后自动缓存（云端 `daily_summary` 表 / 本地 localStorage），家人打开就能看，不用重复调 AI 花钱；点「重新生成」可刷新。
- **历史日期支持**：历史页切换到某天也能生成/查看该天小结，标题显示「X 月 X 日 · 每日小结」。
- **为什么**：原版排版单调、每人打开都要重新生成浪费 API 额度、历史日期没法看小结。
- **实现要点**：`daily_summary` 表按 `(baby_id, day_key)` 唯一缓存；`fetchDailySummary` 先查缓存再调 AI；Edge Function 不变。

## v0.4.0

外出超时提醒、宝宝个人信息、AI 每日小结。

### 功能

- **外出超时提醒**：外出超过 3 小时（睡觉超过 12 小时）还没填结束时间时，首页顶部出现红色醒目横幅，一键跳去补时间。外出统计改为不跨天（只算开始当天，截断到 24:00）。
- **宝宝个人信息**：添加/编辑宝宝时可填生日、性别、体重、身高；首页宝宝卡片显示月龄（如「3 个月」）、性别、体重、身高。
- **AI 每日小结**：首页「每日小结」卡片，点「生成小结」后根据当天记录（奶量、睡眠、外出、尿布、辅食 + 宝宝月龄/体重）给出总结和建议，鼓励做得好的部分。AI 调用 DeepSeek（deepseek-chat，最便宜），key 存在 Supabase Edge Function 服务端环境变量里，前端永远看不到 key；未部署 EF 时降级为本地统计文字。
- **为什么**：外出/睡觉忘关导致统计不准；只有文字记录看不出宝宝成长情况；老人需要简单易懂的每日建议。
- **实现要点**：
  - 外出 `outingMinutesOnDay` 改为只算开始那天并截断到 24:00；
  - `findStaleSpans` 扫描未关闭的外出/睡觉，超阈值时首页显示 `alert-banner`；
  - `Baby` 增加 `birthDate/gender/weightKg/heightCm`，`formatMonthAge` 算月龄；数据库列缺失时自动降级不写入；
  - AI 走 `supabase/functions/daily-summary/`（Deno），前端 `fetchDailySummary` 调用 EF；未部署或失败时用 `fallbackSummary` 本地文案。

## v0.3.1

修复 v0.3.0 所有记录保存报错的问题。

### 修复

- **所有记录保存失败**：v0.3.0 的 `saveEvent` 往**每条记录**的 body 里都带 `photo_url` 字段，但 Supabase 数据库还没执行 `alter table ... add column photo_url`，导致所有类型（吃奶、睡觉等）都被数据库拒绝（`Could not find the 'photo_url' column`）。
- **原因**：代码假设数据库字段已存在，但实际用户侧的 Supabase 还没跑迁移 SQL；每次保存都触发了这个错误。
- **实现要点**：
  - `photo_url` 只在**真有照片**时才写入 body，普通记录不再带这个字段；
  - 带照片的保存若因缺列报错，自动降级（去 `photo_url` 重试）保住记录本身，toast 提示"照片没存上"；
  - 根治方案仍在 Supabase SQL Editor 执行 `alter table event add column if not exists photo_url text;`（见 `supabase/schema.sql`）。

## v0.3.0

辅食可以拍照记录了，每天吃啥有图可看。

### 功能

- **辅食拍照**：记辅食时可拍一张食物照片（相机或相册）；照片会压到约 1280px JPEG 后保存，本地模式存浏览器、云端存 Supabase `photo_url`。时间线、保存确认弹窗里都能看到照片缩略图/大图，编辑时可重新拍或移除。
- **为什么**：辅食只记「米粉、果泥」看不出到底吃了啥；有照片后每天回顾更直观，老人也能看懂。
- **实现要点**：新增 `src/lib/photo.ts` 压缩图片（Canvas，HTTP 入口可用）；`BabyEvent` / `event` 表增加 `photo_url` 字段（`schema.sql` 含 `alter table` 补列语句）；拍照 UI 在辅食表单内，两步内完成「拍 → 保存」。

## v0.2.4

历史与每日统计里，外出按时长统计，不只看次数。

### 功能

- **外出时长**：每日统计的「外出」卡片改为显示当日外出总时长（跨天外出按重叠区间拆到各日），下方标注次数；变化曲线新增「外出」维度（分钟）；时间线明细里外出记录显示「几点到几点 · 时长」，未结束的显示已外出多久。
- **为什么**：原先外出只统计次数，家人更关心「今天在外面待了多久」，尤其推车散步、公园遛弯这类记录。
- **实现要点**：`time.ts` 抽出通用 `spanMinutesOnDay()`（睡眠、外出共用跨日拆分与未填结束时间的截断逻辑），新增 `outingMinutesOnDay()`；趋势图与当日统计复用同一套拆分规则。

## v0.2.3

关于页可查版本号与更新内容；保存成功后可确认或重新编辑。本次同时修正版本号未随功能更新的问题（此前一直停在 v0.2.2）。

### 功能

- **关于页选项卡**：「我的」页面底部的「关于」卡片改为「版本 / 更新内容」两个选项卡。版本标签页展示应用名称、版本号、Commit、提交时间、发布构建时间；更新标签页将 CHANGELOG 内容解析为标题/段落/列表项排版展示（支持 **加粗** 和 `等宽` 内联样式），避免原来一整段纯文本堆在一起太长。
- **为什么**：关于卡片里版本信息和更新说明全挤在一起，更新内容一大段纯文本可读性很差，老人和家人都看不清改了什么。
- **实现要点**：复用项目现有 `.segmented` 选项卡组件；新增 `parseReleaseNotes()` 把 markdown 片段解析为 h2/h3/p/li 结构；`renderNoteInline()` 处理 **加粗** 与 `等宽` 内联标记。

- **保存成功确认弹窗**：记一笔 / 编辑保存后，底部弹出「记录成功 / 已保存修改」，展示类型、时间、奶量或备注等刚写入内容；点「知道了」关闭，点「记错了，重新编辑」可回到表单改完再存。
- **为什么**：原先只有短暂 toast，老人看不清到底记了什么、记错了也没法马上改，只能再翻时间线找。
- **实现要点**：乐观写入立刻弹窗；云端返回真实 id 后同步回弹窗，保证「重新编辑」能找到那条；写入失败则关掉弹窗并 toast 报错。

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
