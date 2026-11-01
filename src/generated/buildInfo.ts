// 由 scripts/build-info.mjs 在 build/dev 前生成，请勿手改
export const buildInfo = {
  "version": "0.2.2",
  "commit": "213f046",
  "commitTime": "2026-11-01T23:00:06+08:00",
  "buildTime": "2026-11-01T15:08:17.076Z",
  "releaseNotes": "## Unreleased\n\n### 功能\n\n- **保存成功确认弹窗**：记一笔 / 编辑保存后，底部弹出「记录成功 / 已保存修改」，展示类型、时间、奶量或备注等刚写入内容；点「知道了」关闭，点「记错了，重新编辑」可回到表单改完再存。\n- **为什么**：原先只有短暂 toast，老人看不清到底记了什么、记错了也没法马上改，只能再翻时间线找。\n- **实现要点**：乐观写入立刻弹窗；云端返回真实 id 后同步回弹窗，保证「重新编辑」能找到那条；写入失败则关掉弹窗并 toast 报错。\n\n### 部署（2026-11-01）\n\n- **家宽入口上线**：前端静态包部署到 OpenWrt（iStoreOS / i5），`http://nxhome.cloud:3006`，国内手机无 VPN 可访问。\n- **后端保持 Supabase**：登录 / 同步 / 实时仍用 `zxlcsmdsgqnsvcqpokdd.supabase.co`；根路径返回 `{\"error\":\"requested path is invalid\"}` 属正常，不代表不可用。\n- **原因**：`*.vercel.app` 在手机流量下打不开（电脑宽带常可打开），Vercel 管理台 `vercel.com` 可登录≠生产站可用。\n- **代码**：业务代码零改动；`npm run build` 后 `dist` 经 GitHub Release `home-dist-v1` 传到 OpenWrt，Docker `nginx:alpine` 托管。\n\n### 事故（2026-11-01）— 必须记住\n\n- **现象**：部署过程中家里网全断（与关闭 TTYD 网页无关，时间巧合）。\n- **根因**：在 **iStoreOS 主路由** 上执行 `docker run -p 3006:80`（Docker 改写 iptables）+ 随后 `/etc/init.d/firewall restart`，与 OpenWrt fw3/fw4 冲突，NAT/转发损坏。\n- **错误决策**：不应在主路由器上用带端口映射的 Docker；更不应在 Docker 后重启防火墙。\n- **恢复**：`docker stop/rm baby-web` → `docker stop docker` → `firewall restart` + `network restart`；无效则断电重启路由器。\n- **后续约束**：主路由上网稳定优先；宝宝站再上线须用「不碰 iptables」方案（见项目 MEMORY.md）。\n\n### 规则\n\n- **AGENTS.md**：修改需 commit + 更新 CHANGELOG（含**为什么改**）；自测通过后 push 远程。\n- **关键环境/事故/决策**必须写入 CHANGELOG 与项目 MEMORY，保证新对话可续做。"
} as const
