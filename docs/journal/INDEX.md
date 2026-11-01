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

## 标签约定

- `failure`：失败案例，必须有「反思」与「禁止事项」
- `deploy` / `network` / `data` / `auth` / `ui`：领域
- 组件名：`openwrt` `docker` `nginx` `supabase` `vercel` `nas` 等
