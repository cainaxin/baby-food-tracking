# AGENTS.md

家庭宝宝作息记录 PWA（Vite + React + TypeScript）。产品范围与功能见 [PLAN.md](./PLAN.md)。

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev -- --host 0.0.0.0 --port 5173   # 手机同局域网可访问（如 http://192.168.x.x:5173）
npm run build      # tsc -b && vite build
npm run preview    # 预览生产构建
npm run lint       # eslint
```

无单测框架时，以 `npm run build` + 手动点验为准。

## Architecture

- **应用**：`src/` 单页 PWA；路由用轻量状态即可（首页 / 历史 / 我的），底部导航。
- **数据**：`src/lib/backend.ts` 统一读写。未配置 Supabase 时走 localStorage；配置后走云端 + Realtime。
- **登录**：邮箱密码；注册会创建家庭并生成邀请码；他人用邀请码加入。
- **领域模型**：`baby`（多宝宝）与 `event`（milk / solid / sleep / wake / outing / bath_swim）。吃奶带 `amount_ml`；睡觉、外出可有 `end_at`。
- **UI 不直连 Supabase**：一律通过 `backend.ts`，避免界面绑死后端。

## Conventions

- **中文 UI**：标签用「吃奶 / 辅食 / 睡觉 / 起床 / 外出 / 洗澡游泳」，不用英文术语。
- **老人友好**：主按钮高 ≥ 56px，正文 ≥ 16px；「记一笔」默认时间为现在，两步内保存。
- **样式**：iOS 风格（`#F2F2F7` 底、白卡片、`#0A84FF` 主色）。CSS 变量在 `src/styles/global.css`；勿写死品牌色。
- **时间**：展示用本地时间 `HH:mm`；存储 ISO 字符串。
- **校验**：只在边界校验（奶量 0–2000、必填时间）；信任内部 store。

## Supabase / 部署

- 表与 RLS、storage 头像桶：`supabase/schema.sql`（改结构先改该文件）。
- 环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（见 `.env.example`）。
- 生产部署：Vercel（`vercel.json` 已配 SPA 回退）。前端需配置上述 env。
- Realtime：Database → Replication 打开 `event`、`baby`。
- 家庭自用建议关闭邮箱确认（Authentication → Providers → Email），方便老人登录。

## Verify

1. `npm run build` 与 `npm run lint` 通过  
2. 首页能添加宝宝并记吃奶，刷新后仍在  
3. 时间线编辑 / 删除可用  
4. 窄屏（375px）无横向滚动，底部快捷按钮可点  
5. 配置 Supabase 后：两账号同家庭、一人记录另一人刷新可见  

