#!/bin/bash
# 回归验证脚本 — 每次重大变更后运行
# 用法: bash scripts/verify.sh

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
PASS=0
FAIL=0

check() {
  local desc="$1"
  shift
  echo -n "  [$desc] ... "
  if "$@" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== 构建层检查 ==="

check "Prisma Schema 验证" npx prisma validate
check "Next.js 构建" npx next build

echo ""
echo "=== 运行时检查 ==="

# 启动开发服务器
echo -n "  启动开发服务器 ... "
npm run dev > /tmp/dev-server.log 2>&1 &
DEV_PID=$!
sleep 8

# 检查服务器是否存活
check "服务器进程存活" kill -0 $DEV_PID

# 关键页面 HTTP 状态检查
check "首页可访问 (200)" curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 | grep -q 200
check "登录页可访问 (200)" curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login | grep -q 200

# 非 admin 访问设置页被拦截
check "非登录用户 /settings 重定向" curl -s -o /dev/null -w '%{redirect_url}' http://localhost:3000/settings/roles | grep -q login

# 停止服务器
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true

echo ""
echo "========================================="
echo -e "通过: ${GREEN}$PASS${NC}  失败: ${RED}$FAIL${NC}"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}回归验证未通过，请修复后再提交${NC}"
  exit 1
else
  echo -e "${GREEN}回归验证全部通过${NC}"
fi
