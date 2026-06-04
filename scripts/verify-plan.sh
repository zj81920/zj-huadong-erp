#!/bin/bash
# ============================================================
# 多经营主体改造 + 合同变更单 — 实施计划验证脚本
# 用法: bash scripts/verify-plan.sh [--start-server] [--run-tests]
#   --start-server  自动启动 dev server（需要 sudo）
#   --run-tests     运行单元/DB/路由测试
# ============================================================

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
PASS=0
FAIL=0
WARN=0

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

START_SERVER=false
RUN_TESTS=false

for arg in "$@"; do
  case $arg in
    --start-server) START_SERVER=true ;;
    --run-tests) RUN_TESTS=true ;;
  esac
done

echo ""
echo "============================================"
echo "  多经营主体改造 + 合同变更单 验证脚本"
echo "============================================"
echo ""

# ============================================================
# 辅助函数
# ============================================================

check_file() {
  local task="$1"
  local file="$2"
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✅${NC} ${task}"
    PASS=$((PASS + 1))
    return 0
  else
    echo -e "  ${RED}❌${NC} ${task}"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

check_file_warn() {
  local task="$1"
  local file="$2"
  if [ -f "$file" ]; then
    echo -e "  ${GREEN}✅${NC} ${task}"
    PASS=$((PASS + 1))
    return 0
  else
    echo -e "  ${YELLOW}⚠️  ${task}（文件不存在，可选文件）${NC}"
    WARN=$((WARN + 1))
    return 1
  fi
}

check_grep() {
  local task="$1"
  local pattern="$2"
  local file="$3"
  if [ -f "$file" ] && grep -q "$pattern" "$file" 2>/dev/null; then
    echo -e "  ${GREEN}✅${NC} ${task}"
    PASS=$((PASS + 1))
    return 0
  else
    echo -e "  ${RED}❌${NC} ${task}"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

check_grep_warn() {
  local task="$1"
  local pattern="$2"
  local file="$3"
  if [ -f "$file" ] && grep -q "$pattern" "$file" 2>/dev/null; then
    echo -e "  ${GREEN}✅${NC} ${task}"
    PASS=$((PASS + 1))
    return 0
  else
    echo -e "  ${YELLOW}⚠️  ${task}（未找到匹配）${NC}"
    WARN=$((WARN + 1))
    return 1
  fi
}

check_http() {
  local task="$1"
  local url="$2"
  if command -v curl &>/dev/null; then
    local status
    status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo "000")
    if [ "$status" = "200" ] || [ "$status" = "302" ] || [ "$status" = "307" ]; then
      echo -e "  ${GREEN}✅${NC} ${task} (HTTP ${status})"
      PASS=$((PASS + 1))
      return 0
    else
      echo -e "  ${RED}❌${NC} ${task} (HTTP ${status})"
      FAIL=$((FAIL + 1))
      return 1
    fi
  else
    echo -e "  ${YELLOW}⚠️  ${task}（无 curl，跳过）${NC}"
    WARN=$((WARN + 1))
    return 1
  fi
}

section() {
  echo ""
  echo "--- $1 ---"
}

verify_test() {
  local task="$1"
  local cmd="$2"
  if $RUN_TESTS; then
    echo -n "  [$task] ... "
    if eval "$cmd" > /tmp/verify_test.log 2>&1; then
      echo -e "${GREEN}✅ 通过${NC}"
      PASS=$((PASS + 1))
    else
      echo -e "${RED}❌ 失败${NC}"
      tail -5 /tmp/verify_test.log
      FAIL=$((FAIL + 1))
    fi
  else
    echo -e "  ${YELLOW}⏭️  ${task}（使用 --run-tests 执行）${NC}"
  fi
}

separator() {
  echo "  -----------------------------------------"
}

# ============================================================
# Task 1: Schema 模型变更
# ============================================================
section "Task 1: Schema 模型变更"

# Step 1: InterOrgContract 模型字段
check_grep "Step 1: ✅ InterOrgContract - settlementAmount 字段" "settlementAmount" "prisma/schema.prisma"
check_grep "Step 1: ✅ InterOrgContract - managementFee 字段" "managementFee" "prisma/schema.prisma"
check_grep "Step 1: ✅ InterOrgContract - taxBurden 字段" "taxBurden" "prisma/schema.prisma"
check_grep "Step 1: ✅ InterOrgContract - otherFee 字段" "otherFee" "prisma/schema.prisma"
check_grep "Step 1: ✅ InterOrgContract - mainContractAmount 字段" "mainContractAmount" "prisma/schema.prisma"
check_grep "Step 1: ✅ InterOrgContract - otherFeeNote 字段" "otherFeeNote" "prisma/schema.prisma"
separator

# Step 2: IncomeContract 加 interOrgContractId
check_grep "Step 2: ✅ IncomeContract - interOrgContractId 字段" "interOrgContractId" "prisma/schema.prisma"
check_grep "Step 2: ✅ IncomeContract - organizationId 字段" "organizationId" "prisma/schema.prisma"
separator

# Step 3: 新增 ContractChangeOrder 模型
check_grep "Step 3: ✅ ContractChangeOrder 模型存在" "model ContractChangeOrder" "prisma/schema.prisma"
check_grep "Step 3: ✅ ContractChangeOrder - changeNo 字段" "changeNo" "prisma/schema.prisma"
check_grep "Step 3: ✅ ContractChangeOrder - amountDifference 字段" "amountDifference" "prisma/schema.prisma"
check_grep "Step 3: ✅ ContractChangeOrder - hasOverCollection 字段" "hasOverCollection" "prisma/schema.prisma"
check_grep "Step 3: ✅ ContractChangeOrder - newFiles 字段" "newFiles" "prisma/schema.prisma"
separator

# Step 4: 删除废弃字段（字段不存在=已删除=通过）
check_removed_field() {
  local field="$1"
  if grep -q "$field" "prisma/schema.prisma" 2>/dev/null; then
    echo -e "  ${RED}❌ Step 4: InterOrgContract 仍有 ${field} 字段（应已删除）${NC}"
    FAIL=$((FAIL + 1))
  else
    echo -e "  ${GREEN}✅ Step 4: InterOrgContract 已删除 ${field}${NC}"
    PASS=$((PASS + 1))
  fi
}

check_removed_field "settlementType"
check_removed_field "deductedAmount"
check_removed_field "managementFeeRate"
check_removed_field "managementFeeTotal"
separator

# Step 5: Prisma validate + db push
echo -n "  Step 5: Prisma Schema 验证 ... "
if npx prisma validate > /tmp/prisma-validate.log 2>&1; then
  echo -e "${GREEN}✅ 通过${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}❌ 失败${NC}"
  cat /tmp/prisma-validate.log
  FAIL=$((FAIL + 1))
fi

# Step 6: DB 测试文件
check_grep "Step 6: ✅ DB 测试 - ContractChangeOrder 字段验证" "ContractChangeOrder" "test/db/organization-relation.test.ts"
check_grep "Step 6: ✅ DB 测试 - interOrgContractId 字段验证" "interOrgContractId" "test/db/organization-relation.test.ts"
check_grep "Step 6: ✅ DB 测试 - settlementAmount 字段验证" "settlementAmount" "test/db/organization-relation.test.ts"
separator

# Step 7: DB 测试运行
verify_test "Step 7: DB 测试通过" "npx vitest run test/db/ -v"
separator

# ============================================================
# Task 2: 结算金额计算逻辑 TDD
# ============================================================
section "Task 2: 结算金额计算逻辑 TDD"

check_file "Step 1: ✅ 结算测试文件存在" "test/unit/inter-org-settlement.test.ts"
check_file "Step 3: ✅ 结算逻辑实现文件存在" "src/lib/inter-org-settlement.ts"
verify_test "Step 4: 结算计算单元测试通过（预期 9 passed）" "npx vitest run test/unit/inter-org-settlement.test.ts -v"

# ============================================================
# Task 3: 合同变更单业务逻辑 TDD
# ============================================================
section "Task 3: 合同变更单业务逻辑 TDD"

check_file "Step 1: ✅ 变更单测试文件存在" "test/unit/contract-change-order.test.ts"
check_file "Step 3: ✅ 变更单逻辑实现文件存在" "src/lib/change-order.ts"
check_grep "Step 3: ✅ change-order.ts - calculateAmountDifference" "calculateAmountDifference" "src/lib/change-order.ts"
check_grep "Step 3: ✅ change-order.ts - checkOverCollection" "checkOverCollection" "src/lib/change-order.ts"
check_grep "Step 3: ✅ change-order.ts - applyFinancialAdjustment" "applyFinancialAdjustment" "src/lib/change-order.ts"
check_grep "Step 3: ✅ change-order.ts - mergeArchivedFiles" "mergeArchivedFiles" "src/lib/change-order.ts"
verify_test "Step 4: 变更单业务单元测试通过（预期 12 passed）" "npx vitest run test/unit/contract-change-order.test.ts -v"

# ============================================================
# Task 4: 所属主体表单改造（收入合同）
# ============================================================
section "Task 4: 所属主体表单改造（收入合同）"

check_file "Step 1-4: ✅ 收入合同页面存在" "src/app/(dashboard)/contracts/income/page.tsx"
check_grep "Step 1: ✅ 收入合同页面 - organizationId 表单字段" "organizationId" "src/app/(dashboard)/contracts/income/page.tsx"

# ============================================================
# Task 5: 所属主体表单改造（支出合同）
# ============================================================
section "Task 5: 所属主体表单改造（支出合同）"

check_file "Step 1-4: ✅ 支出合同页面存在" "src/app/(dashboard)/contracts/expense/page.tsx"
check_grep "Step 1: ✅ 支出合同页面 - organizationId 表单字段" "organizationId" "src/app/(dashboard)/contracts/expense/page.tsx"

# ============================================================
# Task 6: 内部结算合同 API + 审批流
# ============================================================
section "Task 6: 内部结算合同 API + 审批流"

check_file "Step 1: ✅ 内部结算合同 API 列表路由存在" "src/app/api/inter-org-contracts/route.ts"
check_file "Step 2: ✅ 内部结算合同 API 详情路由存在" "src/app/api/inter-org-contracts/[id]/route.ts"
check_grep "Step 3: ✅ 审批引擎 - inter_org_contract case 存在" "case \"inter_org_contract\"" "src/lib/approval-engine.ts"
check_grep "Step 3: ✅ 审批引擎 - 自动生成应收逻辑" "sourceType: \"inter_org_contract\"" "src/lib/approval-engine.ts"
check_grep "Step 3: ✅ 审批引擎 - 关联收入合同标记" "interOrgContractId" "src/lib/approval-engine.ts"
check_file "Step 4: ✅ API 集成测试文件存在" "test/api/inter-org-contracts.test.ts"

# 检查 API 测试是否使用新字段
if grep -q "settlementType\|totalAmount\|managementFeeTotal\|remainingAmount" "test/api/inter-org-contracts.test.ts" 2>/dev/null; then
  echo -e "  ${YELLOW}⚠️  Step 4: API 测试仍使用旧字段名（settlementType/totalAmount/managementFeeTotal/remainingAmount）${NC}"
  echo -e "  ${YELLOW}   需要更新为新字段: mainContractAmount, managementFee, taxBurden, otherFee, settlementAmount${NC}"
  WARN=$((WARN + 1))
else
  echo -e "  ${GREEN}✅ Step 4: API 测试使用新字段${NC}"
  PASS=$((PASS + 1))
fi

# ============================================================
# Task 7: 内部结算合同页面重写
# ============================================================
section "Task 7: 内部结算合同页面重写"

check_file "Step 1: ✅ 内部结算新建页面存在" "src/app/(dashboard)/contracts/internal-settlement/new/page.tsx"
check_file "Step 2: ✅ 内部结算列表页存在" "src/app/(dashboard)/contracts/internal-settlement/page.tsx"
check_file "Step 3: ✅ 内部结算详情页存在" "src/app/(dashboard)/contracts/internal-settlement/[id]/page.tsx"
check_grep "Step 1: ✅ 新建页 - relatedContractId 字段" "relatedContractId" "src/app/(dashboard)/contracts/internal-settlement/new/page.tsx"
check_grep "Step 1: ✅ 新建页 - settlementAmount 字段" "settlementAmount" "src/app/(dashboard)/contracts/internal-settlement/new/page.tsx"

# ============================================================
# Task 8: Invoice API 增加 inter_org_contract 支持
# ============================================================
section "Task 8: Invoice API 增加 inter_org_contract 支持"

check_grep "Step 1: ✅ 发票页 - inter_org_contract sourceType" "inter_org_contract" "src/app/(dashboard)/finance/invoices/page.tsx"

# ============================================================
# Task 9: Receivable API 支持 inter_org_contract 查询
# ============================================================
section "Task 9: Receivable API 支持 inter_org_contract 查询"

check_grep "Step 1: ✅ 应收 API - inter_org_contract 处理分支" "inter_org_contract" "src/app/api/receivables/route.ts"

# ============================================================
# Task 10: 合同变更单 API + 审批流
# ============================================================
section "Task 10: 合同变更单 API + 审批流"

check_file "Step 1: ✅ 变更单列表/创建 API 存在" "src/app/api/change-orders/route.ts"
check_file "Step 2: ✅ 变更单详情/更新/删除 API 存在" "src/app/api/change-orders/[id]/route.ts"

# 检查审批引擎中是否有 contract_change_order case
if grep -q "case \"contract_change_order\"" "src/lib/approval-engine.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✅ Step 3: 审批引擎 - contract_change_order case 存在${NC}"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}❌ Step 3: 审批引擎缺少 contract_change_order case${NC}"
  echo -e "  ${YELLOW}   需要在 updateBusinessStatus 函数中增加 contract_change_order 分支${NC}"
  echo -e "  ${YELLOW}   - 批准时: applyChangeOrderToContract + adjustFinancialRecords + appendArchivedFiles${NC}"
  FAIL=$((FAIL + 1))
fi

# 检查 API 集成测试文件
if [ -f "test/api/change-orders.test.ts" ]; then
  echo -e "  ${GREEN}✅ Step 4: 变更单 API 集成测试文件存在${NC}"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}❌ Step 4: 变更单 API 集成测试文件缺失${NC}"
  echo -e "  ${YELLOW}   需要创建 test/api/change-orders.test.ts${NC}"
  FAIL=$((FAIL + 1))
fi

# ============================================================
# Task 11: 合同变更单页面
# ============================================================
section "Task 11: 合同变更单页面"

check_file "Step 1: ✅ 变更单列表页存在" "src/app/(dashboard)/contracts/change-orders/page.tsx"
check_file "Step 2: ✅ 变更单新建页存在" "src/app/(dashboard)/contracts/change-orders/new/page.tsx"
check_file "Step 3: ✅ 变更单详情页存在" "src/app/(dashboard)/contracts/change-orders/[id]/page.tsx"

# ============================================================
# Task 12: 路由完整性测试
# ============================================================
section "Task 12: 路由完整性测试"

if [ -f "test/unit/route-integrity.test.ts" ]; then
  # 检查是否包含变更单页面
  if grep -q "change-orders" "test/unit/route-integrity.test.ts" 2>/dev/null; then
    echo -e "  ${GREEN}✅ Step 1: 路由测试包含变更单页面${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}⚠️  Step 1: 路由测试未包含变更单页面（建议补充）${NC}"
    WARN=$((WARN + 1))
  fi
  # 检查是否包含内部结算页面
  if grep -q "internal-settlement" "test/unit/route-integrity.test.ts" 2>/dev/null; then
    echo -e "  ${GREEN}✅ Step 1: 路由测试包含内部结算页面${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}⚠️  Step 1: 路由测试未包含内部结算页面（建议补充）${NC}"
    WARN=$((WARN + 1))
  fi
else
  echo -e "  ${RED}❌ Step 1: 路由完整性测试文件不存在${NC}"
  FAIL=$((FAIL + 1))
fi

# ============================================================
# Task 13: Module-config 注册
# ============================================================
section "Task 13: Module-config 注册"

check_grep "Step 1: ✅ module-config - contract_change_order 已注册" "contract_change_order" "src/lib/module-config.ts"

# ============================================================
# Task 14: 删除管理费坐扣 UI
# ============================================================
section "Task 14: 删除管理费坐扣 UI"

check_file "Step 1-3: ✅ 财务收入页面存在" "src/app/(dashboard)/finance/income/page.tsx"
if grep -q "NETTED\|管理费坐扣\|坐扣" "src/app/(dashboard)/finance/income/page.tsx" 2>/dev/null; then
  echo -e "  ${YELLOW}⚠️  Step 1: 管理费坐扣相关代码仍可能存在（需确认是否能安全删除）${NC}"
  WARN=$((WARN + 1))
else
  echo -e "  ${GREEN}✅ Step 1: 管理费坐扣代码已清理${NC}"
  PASS=$((PASS + 1))
fi

# ============================================================
# Task 15: E2E 测试
# ============================================================
section "Task 15: E2E 测试"

check_file "Step 1: ✅ 多组织 E2E 测试存在" "e2e/business-scenarios-multi-org.spec.ts"

if [ -f "test/e2e/change-order-flow.spec.ts" ]; then
  echo -e "  ${GREEN}✅ Step 2: 变更单 E2E 测试文件存在${NC}"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}❌ Step 2: 变更单 E2E 测试文件缺失${NC}"
  echo -e "  ${YELLOW}   需要创建 test/e2e/change-order-flow.spec.ts${NC}"
  FAIL=$((FAIL + 1))
fi

# ============================================================
# Task 16: 回归验证
# ============================================================
section "Task 16: 回归验证"

check_file "Step 1: ✅ 回归脚本存在" "scripts/verify.sh"

# ============================================================
# 运行时检查（需要 dev server）
# ============================================================
section "运行时页面检查（需要 dev server）"

if $START_SERVER; then
  echo "  启动开发服务器 ..."
  npm run dev > /tmp/dev-server-verify.log 2>&1 &
  DEV_PID=$!
  sleep 10

  check_http "首页可访问" "http://localhost:3000"
  check_http "内部结算列表页可访问" "http://localhost:3000/contracts/internal-settlement"
  check_http "内部结算新建页可访问" "http://localhost:3000/contracts/internal-settlement/new"
  check_http "变更单列表页可访问" "http://localhost:3000/contracts/change-orders"
  check_http "变更单新建页可访问" "http://localhost:3000/contracts/change-orders/new"

  kill $DEV_PID 2>/dev/null || true
  wait $DEV_PID 2>/dev/null || true
  echo "  服务器已停止"
else
  echo "  ${YELLOW}⏭️  运行时检查跳过（使用 --start-server 参数启动 dev server 后检查）${NC}"
fi

# ============================================================
# 汇总
# ============================================================
echo ""
echo "============================================"
TOTAL=$((PASS + FAIL))
echo -e "  ${GREEN}通过: $PASS${NC}  ${RED}失败: $FAIL${NC}  ${YELLOW}警告: $WARN${NC}  总计: $TOTAL"
echo "============================================"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo -e "${RED}⚠️  发现 $FAIL 个问题需要修复${NC}"
  echo ""
  echo "=== 已知问题清单 ==="
  echo ""

  # 重复检查以输出具体问题
  if ! grep -q "case \"contract_change_order\"" "src/lib/approval-engine.ts" 2>/dev/null; then
    echo -e "${RED}1. 审批引擎缺少 contract_change_order 分支${NC}"
    echo "   文件: src/lib/approval-engine.ts"
    echo "   原因: updateBusinessStatus 函数中没有处理 contract_change_order 业务的 case"
    echo "   影响: 合同变更单提交审批后，状态无法更新，审批通过后不会联动更新合同金额/应收"
    echo "   修复计划:"
    echo "     ① 在 approval-engine.ts 的 updateBusinessStatus switch 中新增:"
    echo '        case "contract_change_order": { ... }'
    echo "     ② 批准时: 调用 applyChangeOrderToContract / adjustFinancialRecords / appendArchivedFiles"
    echo "     ③ 驳回时: 仅更新状态"
    echo ""
  fi

  if [ ! -f "test/api/change-orders.test.ts" ]; then
    echo -e "${RED}2. 变更单 API 集成测试缺失${NC}"
    echo "   文件: test/api/change-orders.test.ts"
    echo "   原因: 计划要求创建此文件但尚未创建"
    echo "   修复计划:"
    echo "     ① 创建 test/api/change-orders.test.ts"
    echo "     ② 包含 CRUD + 审批流测试用例（至少3个）"
    echo ""
  fi

  if [ ! -f "test/e2e/change-order-flow.spec.ts" ]; then
    echo -e "${RED}3. 变更单 E2E 测试缺失${NC}"
    echo "   文件: test/e2e/change-order-flow.spec.ts"
    echo "   原因: 计划要求创建此文件但尚未创建"
    echo "   修复计划:"
    echo "     ① 创建 test/e2e/change-order-flow.spec.ts"
    echo "     ② 包含完整流程和超收场景两个测试"
    echo ""
  fi

  # 检查 API 测试旧字段
  if [ -f "test/api/inter-org-contracts.test.ts" ] && grep -q "settlementType\|totalAmount\|managementFeeTotal\|remainingAmount" "test/api/inter-org-contracts.test.ts" 2>/dev/null; then
    echo -e "${YELLOW}4. 内部结算合同 API 测试使用旧字段名${NC}"
    echo "   文件: test/api/inter-org-contracts.test.ts"
    echo "   原因: 测试中仍在用 settlementType/totalAmount/managementFeeTotal/remainingAmount"
    echo "   影响: 测试运行会失败（服务端不再接受这些字段）"
    echo "   修复计划:"
    echo "     ① 将 totalAmount → mainContractAmount"
    echo "     ② 将 managementFeeTotal → managementFee"
    echo "     ③ 删除 settlementType/remainingAmount，添加 taxBurden/otherFee/settlementAmount"
    echo ""
  fi

  if [ -f "test/unit/route-integrity.test.ts" ] && ! grep -q "change-orders" "test/unit/route-integrity.test.ts" 2>/dev/null; then
    echo -e "${YELLOW}5. 路由完整性测试未包含变更单页面${NC}"
    echo "   文件: test/unit/route-integrity.test.ts"
    echo "   建议: 在模块检查清单中增加合同变更单页面"
    echo ""
  fi
fi

echo ""
echo -e "详细日志: /tmp/verify-plan.log"
echo ""
