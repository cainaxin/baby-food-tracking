#!/bin/sh
# 宝宝日记 - OpenWrt 更新触发接口
# 安装位置：/www/cgi-bin/baby-update.cgi
# 用途：GitHub Actions 在 push 后调用，触发路由器拉取新版
# 安全：需要 token 验证，且只执行固定的 update.sh 脚本

# ===== token 验证 =====
EXPECTED_TOKEN="/root/baby-food-tracker/.update-token"
if [ ! -f "$EXPECTED_TOKEN" ]; then
  echo "Content-Type: text/plain; charset=utf-8"
  echo ""
  echo "token 未配置"
  exit 0
fi

# 从 QUERY_STRING 提取 token
QUERY_TOKEN=$(echo "$QUERY_STRING" | grep -o 'token=[^&]*' | cut -d= -f2)
STORED_TOKEN=$(cat "$EXPECTED_TOKEN")

if [ "$QUERY_TOKEN" != "$STORED_TOKEN" ]; then
  echo "Content-Type: text/plain; charset=utf-8"
  echo "Status: 403"
  echo ""
  echo "token 验证失败"
  exit 0
fi

# ===== 执行更新 =====
echo "Content-Type: text/plain; charset=utf-8"
echo ""

/root/baby-food-tracker/update.sh 2>&1
