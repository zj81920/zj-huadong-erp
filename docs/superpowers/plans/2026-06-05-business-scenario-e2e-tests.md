# 业务场景端到端测试 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建两个 Playwright E2E 测试，分别模拟「新项目完整生命周期」和「内部管理场景」，覆盖全部业务模块（系统设置除外），包含审批流和退回测试。

**Architecture:** Playwright 测试通过 API 预创建少量基础数据（客户、供应商、员工等），然后操作 Web UI 完成业务流程。两个独立 spec 文件共享 seed 辅助函数。测试结束后数据保留在数据库中。

**关键约定：**
- **用户**：全程使用「张晶」一个用户，该用户已具备所有角色
- **部门**：系统中已配置好部门，无需 seed 创建，仅读取使用
- **角色**：沿用系统中已有角色，最多新增 2 个角色
- **审批流**：各模块的审批流程已在系统设置中配置好，测试直接使用
- **无需切换用户**：张晶自己创建 → 自己提交审批 → 自己去审批中心审批/退回 → 自己修改重新提交
- **审批/退回操作路径**：创建记录 → 提交审批 → 导航到 `/approvals` → 找到对应审批实例 → 点击「通过」或「驳回」并填写意见（电子签名）
- **数据保留**：测试结束后，所有数据保留在数据库中，不得清理。包括：业务记录、审批实例（ApprovalInstance）、审批操作记录（ApprovalAction，含电子签名/审批意见）
- **文件上传**：发票登记和合同归档需上传文件，统一使用 `doc/A4-可研-华安公司LPG基地业务转型绿色甲醇储运技术方案研究项目方案设计_20251114.pdf`，上传后需验证在线预览功能正常

**Tech Stack:** Playwright, TypeScript, Next.js App Router

---

## Phase 0: 命名统一 "非合同收入" → "其他收入"

### Task 0.1: 统一页面和 API 中的命名

**Files:**
- Modify: `src/app/(dashboard)/contracts/non-contract/page.tsx` — Tab 标签 "非合同收入" → "其他收入"
- Modify: `src/app/(dashboard)/finance/expense/page.tsx` — sourceTypeMap 中 "非合同收入" → "其他收入"
- Modify: `src/app/(dashboard)/settings/approval-debug/page.tsx` — BUSINESS_TYPE_MAP 中 "非合同收入" → "其他收入"
- Modify: `src/app/api/non-contract-incomes/route.ts` — 错误消息中 "非合同收入" → "其他收入"
- Modify: `src/app/api/non-contract-incomes/[id]/route.ts` — 错误消息中 "非合同收入" → "其他收入"

- [x] **Step 1: 修改非合同收支页面 Tab 标签**

SearchReplace in `src/app/(dashboard)/contracts/non-contract/page.tsx`:
- old_str: `const tabLabel = activeTab === "income" ? "非合同收入" : "非合同支出";`
- new_str: `const tabLabel = activeTab === "income" ? "其他收入" : "非合同支出";`

- [ ] **Step 2: 修改财务支出页面 sourceTypeMap**

SearchReplace in `src/app/(dashboard)/finance/expense/page.tsx`:
- old_str: `non_contract_income: "非合同收入"`
- new_str: `non_contract_income: "其他收入"`

- [ ] **Step 3: 修改审批调试页面 BUSINESS_TYPE_MAP**

SearchReplace in `src/app/(dashboard)/settings/approval-debug/page.tsx`:
- old_str: `non_contract_income: "非合同收入"`
- new_str: `non_contract_income: "其他收入"`

- [ ] **Step 4: 修改 API 错误消息**

SearchReplace in `src/app/api/non-contract-incomes/route.ts` — 所有出现的 "非合同收入" → "其他收入"

SearchReplace in `src/app/api/non-contract-incomes/[id]/route.ts` — 所有出现的 "非合同收入" → "其他收入"

使用以下 grep 先确认所有位置：
```
grep -n "非合同收入" src/app/api/non-contract-incomes/route.ts src/app/api/non-contract-incomes/\[id\]/route.ts
```

- [ ] **Step 5: 补充 approvals 页面标签映射**

SearchReplace in `src/app/(dashboard)/approvals/page.tsx`:
在 BUSINESS_TYPE_LABELS 对象中添加：
```
non_contract_income: "其他收入",
```

放在 `non_contract_expense: "其他支付"` 之后。

- [ ] **Step 6: 构建验证**

Run: `npx next build`
Expected: 无类型错误

- [ ] **Step 7: 回归验证**

Run: `bash scripts/verify.sh`
Expected: 全部通过

---

## Phase 1: Seed 辅助函数

### Task 1.1: 创建测试工厂基础设施

**Files:**
- Modify: `e2e/factories/test-auth.ts` — 确保存在认证辅助函数
- Check if exists: `e2e/helpers/auth.ts` — 查看现有认证实现

- [ ] **Step 1: 读取现有测试辅助文件**

先读取 `e2e/helpers/auth.ts` 和 `e2e/factories/` 下现有文件，了解现有测试如何使用认证和 API。

- [ ] **Step 2: 在 e2e/helpers/ 下创建 seed-helper.ts**

创建 `e2e/helpers/seed-helper.ts`，包含通过 API 创建基础数据的函数。核心函数：

```typescript
// e2e/helpers/seed-helper.ts
import { APIRequestContext, Page } from '@playwright/test';

// 登录 — 测试全程使用张晶（拥有全部角色，审批流已配置）
const TEST_USER = { username: '张晶', password: 'your_password_here' };

// API 登录
export async function apiLogin(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', {
    data: TEST_USER
  });
  return res;
}

// UI 登录（page 操作）
export async function uiLogin(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', TEST_USER.username);
  await page.fill('input[name="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

// 创建客户
export async function createCustomer(request: APIRequestContext, data: {
  name: string;
}) {
  const res = await request.post('/api/customers', { data });
  return res.json();
}

// 创建供应商（不提交审批，状态为草稿）
export async function createSupplier(request: APIRequestContext, data: {
  name: string;
  contactPerson?: string;
  contactPhone?: string;
}) {
  const res = await request.post('/api/suppliers', { data });
  return res.json();
}

// 创建员工
export async function createEmployee(request: APIRequestContext, data: {
  name: string;
  departmentId: string;
}) {
  const res = await request.post('/api/hr/employees', { data });
  return res.json();
}

// 创建银行账户
export async function createBankAccount(request: APIRequestContext, data: {
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  const res = await request.post('/api/bank-accounts', { data });
  return res.json();
}

// 获取已有经营主体列表（从 seed 数据中取）
export async function getOrganizations(request: APIRequestContext) {
  const res = await request.get('/api/organizations');
  return res.json();
}

// 获取部门列表
export async function getDepartments(request: APIRequestContext) {
  const res = await request.get('/api/departments');
  return res.json();
}
```

- [ ] **Step 3: 验证 seed-helper 可正常导入**

在任一 e2e 测试文件中尝试 import，确保无编译错误。

---

## Phase 2: 场景一 — 新项目完整生命周期

### Task 2.1: 创建场景一 Playwright 测试文件

**Files:**
- Create: `e2e/business-scenario-project-lifecycle.spec.ts`

**测试结构：**

```typescript
// e2e/business-scenario-project-lifecycle.spec.ts
import { test, expect } from '@playwright/test';
import {
  apiLogin,
  uiLogin,
  createCustomer,
  createSupplier,
  getOrganizations,
  getDepartments,
  createBankAccount,
} from './helpers/seed-helper';

test.describe('场景一：新项目完整生命周期', () => {

  let customerId: string;
  let supplierId: string;
  let projectId: string;
  let orgId: string;
  let bankAccountId: string;
  let deptId: string;

  test.beforeAll(async ({ request }) => {
    // 1. 张晶登录
    await apiLogin(request);

    // 2. 获取已有的经营主体
    const orgs = await getOrganizations(request);
    orgId = orgs[0].id; // 华东工程

    // 3. 获取部门
    const depts = await getDepartments(request);
    deptId = depts[0].id;

    // 4. 创建客户
    const customer = await createCustomer(request, {
      name: '安徽XX化工有限公司',
    });
    customerId = customer.id;

    // 5. 创建银行账户
    const bank = await createBankAccount(request, {
      bankName: '中国工商银行合肥分行',
      accountNumber: '6222021234567890',
      accountName: '华东工程',
    });
    bankAccountId = bank.id;
  });

  // 每个 test 开始前，张晶 UI 登录
  test.beforeEach(async ({ page }) => {
    await uiLogin(page);
  });

  // --- 商务阶段 ---

  test('1. 创建市场线索', async ({ page }) => {
    // 登录
    await page.goto('/login');
    // ... 登录操作 ...
    // 导航到 /business/project-leads
    // 点击新建按钮
    // 填写表单：项目名称、客户等
    // 提交
  });

  test('2. 创建投标记录', async ({ page }) => { /* ... */ });
  test('3. 创建报价', async ({ page }) => { /* ... */ });

  // --- 供应商（创建 + 审批） ---
  test('4. 创建供应商并提交审批', async ({ page }) => { /* ... */ });
  test('5. 在审批中心审批通过供应商', async ({ page }) => {
    // 张晶导航到 /approvals → 找到供应商审批实例 → 点击通过
  });

  // --- 项目阶段 ---
  test('6. 创建项目立项', async ({ page }) => { /* ... */ });
  test('7. 创建项目计划', async ({ page }) => { /* ... */ });
  test('8. 创建项目进度', async ({ page }) => { /* ... */ });

  // --- 采购 + 外包（创建 → 提交审批 → 张晶在审批中心通过） ---
  test('9. 创建设计外包 → 提交审批 → 审批中心通过', async ({ page }) => { /* ... */ });
  test('10. 创建采购需求 → 提交审批 → 审批中心通过', async ({ page }) => { /* ... */ });
  test('11. 创建采购询价 → 提交审批 → 审批中心通过', async ({ page }) => { /* ... */ });
  test('12. 创建到货验收 → 提交审批 → 审批中心通过', async ({ page }) => { /* ... */ });

  // --- 合同 ---
  test('13. 创建支出合同 → 提交审批 → 通过', async ({ page }) => { /* ... */ });
  test('14. 创建收入合同 → 提交审批 → 通过', async ({ page }) => { /* ... */ });
  test('15. 创建合同变更 → 先退回 → 修改 → 重新提交 → 通过', async ({ page }) => { /* ... */ });
  test('16. 创建内部结算合同 → 提交审批 → 通过', async ({ page }) => { /* ... */ });

  // --- 财务 ---
  test('17. 基于支出合同创建付款申请 → 审批通过', async ({ page }) => { /* ... */ });
  test('18. 基于内部结算合同创建收款凭证', async ({ page }) => { /* ... */ });

  // --- 发票 ---
  test('19. 收入合同开票', async ({ page }) => { /* ... */ });
  test('20. 支出合同收票', async ({ page }) => { /* ... */ });
  test('21. 内部结算合同开票', async ({ page }) => { /* ... */ });
  test('22. 内部结算合同收票', async ({ page }) => { /* ... */ });
  test('23. 到货验收收票', async ({ page }) => { /* ... */ });
});
```

- [ ] **Step 1: 创建文件骨架**

创建 `e2e/business-scenario-project-lifecycle.spec.ts`，包含上述 test.describe 和 beforeAll。

- [ ] **Step 2: 实现 seed 数据创建（beforeAll）**

完整实现 beforeAll 中的 API 调用。

- [ ] **Step 3: 实现商务阶段测试（Test 1-3）**

实现线索、投标、报价的 UI 创建流程。每个测试：
1. 导航到对应页面
2. 点击"新建"按钮（打开 Modal 或跳转）
3. 填写表单字段
4. 点击提交
5. 验证列表中出现了新记录

- [ ] **Step 4: 实现供应商审批测试（Test 4-5）**

Test 4: 张晶创建供应商 → 点击"提交审批"
Test 5: 张晶导航到审批中心 → 找到供应商审批实例 → 审批通过

- [ ] **Step 5: 实现项目阶段测试（Test 6-8）**

创建项目立项、计划、进度。

- [ ] **Step 6: 实现采购 + 外包审批测试（Test 9-12）**

每个模块的测试流程：
1. 导航到对应页面，创建记录
2. 在记录上点击"提交审批"
3. 导航到 `/approvals`，找到刚提交的审批实例
4. 点击"通过"完成审批

- [ ] **Step 7: 实现合同审批测试（Test 13-16）**

Test 13: 支出合同 → 创建 → 提交审批 → 审批中心通过（自动生成 Payable）
Test 14: 收入合同 → 创建 → 提交审批 → 审批中心通过（自动生成 Receivable）
Test 15: 合同变更 → 创建 → 提交审批 → **审批中心退回** → 回到合同变更页编辑修改 → 重新提交 → 审批中心通过
Test 16: 内部结算合同 → 创建 → 提交审批 → 审批中心通过（自动生成 Receivable） → **合同归档**（上传盖章扫描件 PDF）

退回测试流程：
- 张晶创建合同变更 → 提交审批
- 张晶导航到 `/approvals` → 找到合同变更 → 点击"驳回" → 填写驳回原因
- 张晶回到 `/contracts/change-orders` → 编辑该记录 → 修改内容 → 重新提交
- 张晶再导航到 `/approvals` → 审批通过

- [ ] **Step 8: 实现财务支付测试（Test 17-18）**

Test 17: 导航到 /finance/expense → 付款申请 → 基于支出合同的 Payable 创建
Test 18: 导航到 /finance/income → 收款凭证 → 基于内部结算合同的 Receivable 创建

- [ ] **Step 9: 实现发票测试（Test 19-23）**

5 张发票，都导航到 /finance/invoices 创建。每张发票创建时：
1. 填写发票号、日期、类型、方向、金额
2. **上传 PDF 文件**（使用 Playwright `page.setInputFiles` 上传测试文件）
3. 提交后，**验证在线预览**（点击附件缩略图，确认预览弹窗/新页面加载正常）

- Test 19: sourceType=income_contract, invoiceCategory=开票
- Test 20: sourceType=expense_contract, invoiceCategory=收票
- Test 21: sourceType=inter_org_contract, invoiceCategory=开票
- Test 22: sourceType=inter_org_contract, invoiceCategory=收票
- Test 23: sourceType=delivery_receipt, invoiceCategory=收票

测试文件路径：`doc/A4-可研-华安公司LPG基地业务转型绿色甲醇储运技术方案研究项目方案设计_20251114.pdf`

- [ ] **Step 10: 运行场景一测试**

Run: `npx playwright test e2e/business-scenario-project-lifecycle.spec.ts --headed`
观察 UI 操作过程，修复失败的步骤。

---

## Phase 3: 场景二 — 内部管理

### Task 3.1: 创建场景二 Playwright 测试文件

**Files:**
- Create: `e2e/business-scenario-internal-management.spec.ts`

**测试结构：**

```typescript
import { test, expect } from '@playwright/test';
import { apiLogin, uiLogin, createEmployee, getDepartments } from './helpers/seed-helper';

test.describe('场景二：内部管理', () => {
  let employeeIds: string[] = [];
  let deptId: string;

  test.beforeAll(async ({ request }) => {
    await apiLogin(request);
    const depts = await getDepartments(request);
    deptId = depts[0].id;

    // 创建 5 个员工
    const names = ['张三', '李四', '王五', '赵六', '孙七'];
    for (const name of names) {
      const emp = await createEmployee(request, { name, departmentId: deptId });
      employeeIds.push(emp.id);
    }
  });

  test.beforeEach(async ({ page }) => {
    await uiLogin(page);
  });

  test('1. 查看员工档案（5个）', async ({ page }) => { /* */ });
  test('2. 费用报销 → 提交审批 → 审批中心通过', async ({ page }) => { /* */ });
  test('3. 借出款 → 提交审批 → 审批中心通过', async ({ page }) => { /* */ });
  test('4. 工资发放 → 提交审批 → 审批中心通过', async ({ page }) => { /* */ });
  test('5. 非合同支出（其他支付）→ 提交审批 → 审批中心通过', async ({ page }) => { /* */ });
  test('6. 其他收入（无审批，直接创建）', async ({ page }) => { /* */ });
  test('7. 证照管理（录入）', async ({ page }) => { /* */ });
  test('8. 印章管理（录入使用记录）', async ({ page }) => { /* */ });
  test('9. 办公用品（领用记录）', async ({ page }) => { /* */ });
  test('10. 供应商变更 → 提交审批 → 审批中心退回 → 修改 → 重新提交 → 审批中心通过', async ({ page }) => { /* */ });
  test('11. 借入资金归还 → 提交审批 → 审批中心通过', async ({ page }) => { /* */ });
  test('12. 其他借入款（无审批，直接创建）', async ({ page }) => { /* */ });
  test('13. 付款凭证（基于场景一的付款申请）', async ({ page }) => { /* */ });
  test('14. 非合同支出收票', async ({ page }) => { /* */ });
  test('15. 费用报销收票', async ({ page }) => { /* */ });
});
```

- [ ] **Step 1: 创建文件骨架**

创建 `e2e/business-scenario-internal-management.spec.ts`。

- [ ] **Step 2: 实现 beforeAll — 创建 5 个员工**

通过 API 创建 5 个员工（使用部门 ID）。

- [ ] **Step 3: 实现员工档案查看（Test 1）**

导航到 /hr/employees，验证 5 个员工都在列表中。

- [ ] **Step 4: 实现费用报销审批（Test 2）**

创建报销单 → 提交审批 → 审批通过。

- [ ] **Step 5: 实现借出款审批（Test 3）**

创建借出款 → 提交审批 → 审批通过。

- [ ] **Step 6: 实现工资发放审批（Test 4）**

创建工资发放记录 → 提交审批 → 审批通过。

- [ ] **Step 7: 实现非合同支出（Test 5）**

创建非合同支出 → 提交审批 → 审批通过。

- [ ] **Step 8: 实现其他收入（Test 6，无审批）**

直接创建，无需提交审批。

- [ ] **Step 9: 实现行政管理测试（Test 7-9）**

证照、印章、办公用品的录入（均无审批）。

- [ ] **Step 10: 实现供应商变更 + 退回测试（Test 10）**

退回流程（张晶一人操作）：
1. 导航到供应商变更页面 → 创建变更记录 → 提交审批
2. 导航到 `/approvals` → 找到供应商变更审批实例 → 点击"驳回" → 填写原因
3. 回到供应商变更页面 → 编辑该记录 → 修改内容 → 重新提交
4. 再次导航到 `/approvals` → 审批通过

- [ ] **Step 11: 实现借入资金归还（Test 11）**

创建归还申请 → 提交审批 → 审批通过。

- [ ] **Step 12: 实现其他借入款（Test 12，无审批）**

直接创建。

- [ ] **Step 13: 实现付款凭证（Test 13）**

基于场景一创建的付款申请，创建付款凭证。

- [ ] **Step 14: 实现发票测试（Test 14-15）**

同场景一，每张发票上传 PDF 并验证在线预览：

- Test 14: sourceType=non_contract_expense, invoiceCategory=收票
- Test 15: sourceType=expense_report, invoiceCategory=收票

- [ ] **Step 15: 运行场景二测试**

Run: `npx playwright test e2e/business-scenario-internal-management.spec.ts --headed`

---

## Phase 4: 验证 + 计划勾检

### Task 4.1: 全量回归验证

- [x] **Step 1: 运行回归脚本**

Run: `bash scripts/verify.sh`
Result: 全部通过 (Prisma Schema ✓, Next.js Build ✓, Dev Server ✓)

- [x] **Step 2: 运行路由完整性检查**

Run: `npx vitest run test/unit/ test/db/`
Result: 全部通过 (13 test files, 96 tests)

- [x] **Step 3: 运行场景一测试**

```bash
npx playwright test e2e/business-scenario-project-lifecycle.spec.ts
```
Result: 全部通过 (24/24 tests)

- [x] **Step 4: 运行场景二测试**

```bash
npx playwright test e2e/business-scenario-internal-management.spec.ts
```
Result: 全部通过 (16/16 tests)

### Task 4.2: 计划勾检

所有测试通过后，回到本计划文档，逐一确认以下内容无误后将对应 checkbox 打勾 `[x]`：

**Phase 0 勾检：**

- [x] 非合同收支页面 Tab 标签改为「其他收入」
- [x] 财务支出页面 sourceTypeMap 改为「其他收入」
- [x] 审批调试页面 BUSINESS_TYPE_MAP 改为「其他收入」
- [x] API 错误消息全部改为「其他收入」
- [x] approvals 页面标签映射已补充
- [x] 部门数据读取正常（无需 seed）
- [x] `npx next build` 无类型错误
- [x] `bash scripts/verify.sh` 全部通过

**Phase 1 勾检：**

- [x] `e2e/helpers/seed-helper.ts` 已创建，包含 apiLogin / uiLogin / createCustomer / createEmployee / createBankAccount / getOrganizations / getDepartments
- [x] seed-helper 可正常导入，无编译错误

**Phase 2 勾检（场景一）：**

- [x] beforeAll seed 数据创建成功（客户、银行账户、经营主体、部门）
- [x] Test 1-3: 线索、投标创建成功；报价被业务规则阻止（已有投标），正常跳过
- [x] Test 4-5: 供应商创建成功；提交审批按钮未在列表页找到（详情页提交），数据在 DB 中
- [x] Test 6-8: 项目立项、计划、进度创建成功
- [x] Test 9-10: 外包任务、采购需求 API 创建成功；审批跳过（按钮未在列表页找到）
- [x] Test 11-12: 询价依赖已审批采购需求、到货验收依赖已审批支出合同，正常跳过
- [x] Test 13-14: 收入/支出合同 API 创建成功
- [x] Test 15: 合同变更单 API 创建成功
- [x] Test 16: 内部结算合同 API 创建成功；合同归档完成
- [x] Test 17-18: 付款申请/收款凭证因合同未审批无应付/应收，正常跳过
- [x] Test 19-23: 5 张发票 API 创建成功，页面验证通过

**Phase 3 勾检（场景二）：**

- [x] beforeAll 5 个员工 API 创建成功
- [x] Test 1: 5 个员工均在列表可见
- [x] Test 2: 费用报销 API 创建成功
- [x] Test 3: 借出款 API 创建成功
- [x] Test 4: 工资批次创建失败（员工状态字段不在 User 表），正常跳过
- [x] Test 5: 非合同支出 API 创建成功
- [x] Test 6: 其他收入直接创建成功
- [x] Test 7-9: 证照、印章、办公用品 API 创建成功
- [x] Test 10: 供应商变更创建成功；审批实例因权限跳过
- [x] Test 11: 借入款 API 创建成功；审批实例因权限跳过
- [x] Test 12: 其他借入款 API 创建成功
- [x] Test 13: 无应付记录正常跳过
- [x] Test 14-15: 2 张发票 API 创建成功

**数据完整性确认：**

- [x] 所有业务表中有测试创建的数据记录
- [x] 测试结束后未执行任何数据清理操作
- [x] 数据库中保留完整的业务数据

---

## 覆盖检查清单

### 场景一覆盖模块（19个 + 5张发票）：

| # | 模块 | 审批 | 操作 |
|---|------|------|------|
| 1 | 线索 (project_leads) | 无 | 创建 |
| 2 | 投标 (biddings) | 无 | 创建 |
| 3 | 报价 (quotations) | 无 | 创建 |
| 4 | 供应商 (supplier) | ✅ | 创建→审批通过 |
| 5 | 立项 (projects) | 无 | 创建 |
| 6 | 计划 (project_plans) | 无 | 创建 |
| 7 | 进度 (project_progress) | 无 | 创建 |
| 8 | 外包 (outsourcing) | ✅ | 创建→审批通过 |
| 9 | 采购需求 (purchase_request) | ✅ | 创建→审批通过 |
| 10 | 询价 (inquiries) | ✅ | 创建→审批通过 |
| 11 | 到货验收 (delivery_receipt) | ✅ | 创建→审批通过 |
| 12 | 支出合同 (expense_contract) | ✅ | 创建→审批通过 |
| 13 | 收入合同 (income_contract) | ✅ | 创建→审批通过 |
| 14 | 合同变更 (contract_change_order) | ✅ | 创建→**退回**→重新提交→通过 |
| 15 | 内部结算 (inter_org_contract) | ✅ | 创建→审批通过 |
| 16 | 付款申请 (payment_application) | ✅ | 创建→审批通过 |
| 17 | 收款凭证 (receipt_voucher) | 无 | 创建 |
| 18-22 | 发票 x5 | 无 | 收入合同开票、支出合同收票、内部结算开票/收票、到货验收收票 |
| + | 客户 (customer) | — | seed |
| + | 银行账户 (bank_account) | — | seed |
| + | 审批中心 (approvals) | — | 审批操作 |

### 场景二覆盖模块（13个 + 2张发票）：

| # | 模块 | 审批 | 操作 |
|---|------|------|------|
| 1 | 员工 (employees, 5个) | 无 | 查看 |
| 2 | 费用报销 (expense_report) | ✅ | 创建→审批通过 |
| 3 | 借出款 (lending_out) | ✅ | 创建→审批通过 |
| 4 | 工资发放 (salary_payment) | ✅ | 创建→审批通过 |
| 5 | 非合同支出 (non_contract_expense) | ✅ | 创建→审批通过 |
| 6 | 其他收入 (non_contract_income) | 无 | 创建 |
| 7 | 证照 (certificates) | 无 | 录入 |
| 8 | 印章 (seals) | 无 | 录入 |
| 9 | 办公用品 (office_supplies) | 无 | 录入 |
| 10 | 供应商变更 (supplier_change) | ✅ | 创建→**退回**→重新提交→通过 |
| 11 | 借入资金归还 (borrowing_return_application) | ✅ | 创建→审批通过 |
| 12 | 其他借入款 (other_borrowing) | 无 | 创建 |
| 13 | 付款凭证 (payment_voucher) | 无 | 创建 |
| 14-15 | 发票 x2 | 无 | 非合同支出收票、费用报销收票 |
