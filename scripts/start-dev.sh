#!/bin/bash
# 一键启动本地开发环境
# 使用方法: bash scripts/start-dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "========================================"
echo "  🚀 启动本地开发环境"
echo "========================================"

# 1. 检查 SSH 隧道
echo ""
echo "[1/3] 检查 SSH 隧道..."
TUNNEL_PID_FILE="/tmp/rds-tunnel.pid"
TUNNEL_RUNNING=false
if [ -f "$TUNNEL_PID_FILE" ] && kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
  TUNNEL_RUNNING=true
elif lsof -i :5432 -P -n 2>/dev/null | grep -q "ssh.*LISTEN"; then
  TUNNEL_RUNNING=true
  echo "  ℹ️  SSH 隧道进程存在但 PID 文件丢失，跳过启动"
fi

if [ "$TUNNEL_RUNNING" = true ]; then
  echo "  ✅ SSH 隧道已在运行"
else
  echo "  🔌 正在启动 SSH 隧道..."
  bash "$SCRIPT_DIR/rds-tunnel.sh" start
  sleep 2
  echo "  ✅ SSH 隧道已启动"
fi

# 2. 检查端口 3000 是否已被占用
echo ""
echo "[2/3] 检查开发服务器..."
if lsof -i :3000 -P -n 2>/dev/null | grep -q LISTEN; then
  # 检查是否是 Next.js 进程
  NEXT_PID=$(lsof -i :3000 -P -n -t 2>/dev/null | xargs -I {} ps -p {} -o pid= -o comm= 2>/dev/null | grep -i "node\|next" | awk '{print $1}')
  if [ -n "$NEXT_PID" ]; then
    echo "  ✅ 开发服务器已在运行 (http://localhost:3000)"
  else
    echo "  ⚠️  端口 3000 被其他进程占用:"
    lsof -i :3000 -P -n 2>/dev/null | grep LISTEN
    echo ""
    read -p "  是否杀掉占用进程并重启? (y/n): " KILL_IT
    if [ "$KILL_IT" = "y" ] || [ "$KILL_IT" = "Y" ]; then
      OCCUPY_PID=$(lsof -i :3000 -P -n -t 2>/dev/null | head -1)
      kill -9 "$OCCUPY_PID" 2>/dev/null
      sleep 1
      echo "  ✅ 已清理端口 3000"
    else
      echo "  ❌ 请手动释放端口 3000 后重试"
      exit 1
    fi
  fi
fi

# 如果端口未被占用（或已清理），启动服务器
if ! lsof -i :3000 -P -n 2>/dev/null | grep -q LISTEN; then
  echo "  📦 正在启动 Next.js 开发服务器..."
  npm run dev &
  # 等待服务器启动
  for i in $(seq 1 30); do
    if lsof -i :3000 -P -n 2>/dev/null | grep -q LISTEN; then
      echo "  ✅ 开发服务器已启动"
      break
    fi
    sleep 1
  done
  if ! lsof -i :3000 -P -n 2>/dev/null | grep -q LISTEN; then
    echo "  ⚠️  开发服务器启动较慢，正在后台继续启动..."
  fi
fi

# 3. 打开浏览器
echo ""
echo "[3/3] 打开浏览器..."
open "http://localhost:3000/login"

echo ""
echo "========================================"
echo "  ✅ 启动完成！"
echo "  应用地址: http://localhost:3000"
echo "  登录用户: admin / admin123"
echo "========================================"
echo ""
echo "  停止隧道: bash scripts/rds-tunnel.sh stop"
echo "  停止服务器: 按 Ctrl+C"
echo "========================================"
