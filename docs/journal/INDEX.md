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

## 标签约定

- `failure`：失败案例，必须有「反思」与「禁止事项」
- `deploy` / `network` / `data` / `auth` / `ui`：领域
- 组件名：`openwrt` `docker` `nginx` `supabase` `vercel` `nas` 等
