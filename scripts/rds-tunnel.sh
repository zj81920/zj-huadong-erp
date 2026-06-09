#!/bin/bash
# SSH 隧道管理脚本 - 连通生产 RDS PostgreSQL
# 使用方法: bash scripts/rds-tunnel.sh [start|stop|status]

set -e

# ========================================
# 配置 - 请替换为实际生产环境信息
# ========================================
TUNNEL_HOST="47.96.128.88"                       # ECS 公网 IP
TUNNEL_USER="ecs-user"                             # ECS SSH 用户名
RDS_HOST="pgm-bp1aai3pll96gfnl.pg.rds.aliyuncs.com"  # RDS 内网地址
LOCAL_PORT=5432                                   # 本地映射端口

PID_FILE="/tmp/rds-tunnel.pid"

start_tunnel() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "[已运行] SSH 隧道已在运行中 (PID: $(cat "$PID_FILE"))"
    return 0
  fi

  echo "[启动] 正在建立 SSH 隧道: localhost:$LOCAL_PORT -> ECS -> RDS..."

  if command -v autossh &>/dev/null; then
    autossh -M 0 \
      -L "${LOCAL_PORT}:${RDS_HOST}:5432" \
      "${TUNNEL_USER}@${TUNNEL_HOST}" \
      -N -f \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes
    echo "[autossh] SSH 隧道已启动 (断线自动重连)"
  else
    ssh \
      -L "${LOCAL_PORT}:${RDS_HOST}:5432" \
      "${TUNNEL_USER}@${TUNNEL_HOST}" \
      -N -f \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes
    echo "[SSH] SSH 隧道已启动 (建议安装 autossh: brew install autossh)"
  fi

  # 记录 PID
  pgrep -f "ssh.*-L ${LOCAL_PORT}:${RDS_HOST}" | head -1 > "$PID_FILE"
  echo "[完成] 隧道已建立，本地 localhost:${LOCAL_PORT} → ${RDS_HOST}:5432"
}

stop_tunnel() {
  if [ ! -f "$PID_FILE" ]; then
    echo "[未运行] 未找到运行中的隧道"
    return 0
  fi

  echo "[停止] 正在关闭 SSH 隧道..."
  pkill -f "ssh.*-L ${LOCAL_PORT}:${RDS_HOST}" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "[完成] SSH 隧道已关闭"
}

status_tunnel() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "[运行中] SSH 隧道正常 (PID: $(cat "$PID_FILE"))"
    echo "  localhost:${LOCAL_PORT} → ${RDS_HOST}:5432"
    return 0
  fi

  # 兜底检查：通过端口检测 SSH 进程
  SSH_PID=$(lsof -i :${LOCAL_PORT} -P -n -t 2>/dev/null | xargs -I {} ps -p {} -o pid= -o comm= 2>/dev/null | grep -i ssh | awk '{print $1}' | head -1)
  if [ -n "$SSH_PID" ]; then
    echo "$SSH_PID" > "$PID_FILE"
    echo "[运行中] SSH 隧道正常 (PID: $SSH_PID，PID 文件已重建)"
    echo "  localhost:${LOCAL_PORT} → ${RDS_HOST}:5432"
    return 0
  fi

  echo "[未运行] SSH 隧道未启动"
  rm -f "$PID_FILE" 2>/dev/null
}

case "${1:-}" in
  start)   start_tunnel ;;
  stop)    stop_tunnel ;;
  status)  status_tunnel ;;
  *)
    echo "用法: bash scripts/rds-tunnel.sh [start|stop|status]"
    exit 1
    ;;
esac
