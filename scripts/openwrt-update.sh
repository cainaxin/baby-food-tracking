#!/bin/sh
# OpenWrt 端自动更新脚本：从 GitHub Release 拉新版 dist 并覆盖
# 安装位置：/root/baby-food-tracker/update.sh
# 用法：直接运行，或由 cron / 手动 TTYD 触发
set -e

DIST_DIR="/root/baby-food-tracker/dist"
BACKUP_DIR="/root/baby-food-tracker/dist.bak"
REPO="cainaxin/baby-food-tracking"
# gh-proxy 加速（国内直连 GitHub 慢）
MIRROR="https://gh-proxy.com/https://github.com"

# 读当前版本（从已部署的 version.txt，构建时生成）
CURRENT_VER=""
if [ -f "$DIST_DIR/version.txt" ]; then
  CURRENT_VER=$(cat "$DIST_DIR/version.txt")
fi
echo "当前版本: ${CURRENT_VER:-未知}"

# 查 GitHub 最新 Release tag
LATEST=$(wget -qO- "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | head -1 | cut -d'"' -f4)
echo "最新版本: $LATEST"

if [ -z "$LATEST" ]; then
  echo "获取版本失败，跳过更新"
  exit 0
fi

if [ "v$CURRENT_VER" = "$LATEST" ]; then
  echo "已是最新，无需更新"
  exit 0
fi

# 下载新版
VER_DASH=$(echo "$LATEST" | tr '.' '-')
TAR_URL="$MIRROR/$REPO/releases/download/$LATEST/baby-dist-$VER_DASH.tar.gz"
TAR_FILE="/tmp/baby-dist-$VER_DASH.tar.gz"

echo "下载 $TAR_URL ..."
wget -O "$TAR_FILE" "$TAR_URL"

# 备份旧版 → 解压新版（就地更新，不替换目录，避免 Docker bind mount 失效）
echo "更新中..."
[ -d "$BACKUP_DIR" ] && rm -rf "$BACKUP_DIR"
cp -a "$DIST_DIR" "$BACKUP_DIR"
rm -rf "${DIST_DIR:?}/"*
tar -xzf "$TAR_FILE" -C "$DIST_DIR/"
rm "$TAR_FILE"

echo "更新完成: $CURRENT_VER → $LATEST"
