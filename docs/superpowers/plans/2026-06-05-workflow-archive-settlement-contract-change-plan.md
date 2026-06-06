# 内部结算合同与合同变更流程归档 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 为内部结算合同和合同变更的审批流增加归档终端节点，调整"发起变更"入口到"已归档"状态，合同变更归档文件上传可选。

**架构：** 复用现有审批引擎的 archive 节点机制（由 `CONTRACT_MODULES` 控制），在流程设置页面增加模块声明、在各合同页面调整按钮条件和归档弹窗、在审批引擎中适配合同变更的归档逻辑。

**Tech Stack:** Next.js 14 App Router, Prisma, TypeScript, Tailwind CSS

---

### Task 1: 流程设置页面 — CONTRACT_MODULES 扩展

**文件：**
- 修改：`src/app/(dashboard)/settings/approval-flow/page.tsx:18`

- [x] **Step 1: 添加 2 个模块到 CONTRACT_MODULES**

将 `CONTRACT_MODULES` 从：
```typescript
const CONTRACT_MODULES = ["income_contract", "expense_contract"];
```
改为：
```typescript
const CONTRACT_MODULES = ["income_contract", "expense_contract", "inter_org_contract", "contract_change_order"];
```

- [ ] **Step 2: 验证**

手动验证：启动 dev server，进入流程设置页面，选择"内部结算合同"和"合同变更"，确认最后一个节点自动显示"归档"标签（紫色 badge）。

---

### Task 2: 收入合同 — "发起变更"按钮迁移到"合同归档"状态

**文件：**
- 修改：`src/app/(dashboard)/contracts/income/page.tsx`

- [ ] **Step 1: 定位"发起变更"按钮代码**

在收入合同页面中找到当前 `contract.status === "已批准"` 条件下的"发起变更"按钮（约第979行）。

- [ ] **Step 2: 迁移按钮到"合同归档"条件**

查找文件中 `contract.status === "合同归档"` 的条件块（或者参考 `contract.status === "已批准"` 和 `contract.status === "生效"` 的写法）。

如果没有现成的"合同归档"条件块，在"已批准"或"生效"条件块附近新增：

```tsx
{contract.status === "合同归档" && (
  <>
    <button
      className="ios-btn ios-btn-ghost ios-btn-sm text-[#1C1917]!"
      onClick={() => router.push(`/contracts/change-orders/new?contractType=income_contract&contractId=${contract.id}`)}
    >
      发起变更
    </button>
  </>
)}
```

然后删除原来 `contract.status === "已批准"` 条件下的"发起变更"按钮（只移除按钮，保留其他元素如"开票"按钮）。

- [ ] **Step 3: 验证**

手动验证：找到一条"合同归档"状态的收入合同，确认"发起变更"按钮可见；找到一条"已批准"状态的收入合同，确认"发起变更"按钮不再显示。

---

### Task 3: 支出合同 — "发起变更"按钮迁移到"合同归档"状态

**文件：**
- 修改：`src/app/(dashboard)/contracts/expense/page.tsx`

- [ ] **Step 1: 定位并迁移按钮**

同上，在支出合同页面中找到 `contract.status === "已批准"` 条件下的"发起变更"按钮（约第1130行），移到 `contract.status === "合同归档"` 条件下，删除原位置的按钮。

- [ ] **Step 2: 验证**

手动验证：支出合同"合同归档"状态显示"发起变更"，"已批准"状态不再显示。

---

### Task 4 (TDD): 审批引擎 — 合同变更归档逻辑适配 + 测试

**文件：**
- 修改：`src/lib/approval-engine.ts`
- 创建：`test/unit/contract-change-archive.test.ts`

#### 4.1 分析当前状态

当前 `updateBusinessStatus` 对 `contract_change_order` 的处理（约第894-988行）：

当 `status === "已批准"` 时执行：
1. `prisma.contractChangeOrder.update({ data: updateData })` — updateData 包含 status 字段
2. 更新关联合同金额
3. 调整应收/应付记录
4. 合并 `newFiles` 到原合同的 `archivedUrl`
5. 变更单状态设为 `"已生效"`

#### 4.2 调整方案

需要将步骤 5 从"已批准"阶段剥离到"已归档"阶段：

**"已批准"阶段执行：** 步骤 1-4（业务逻辑），变更单状态保持 `"已批准"`（由外层 engine 控制）
**"已归档"阶段执行（新增）：** 变更单状态设为 `"已生效"`，可选保存 `archivedUrl`

- [ ] **Step 1: 提取纯函数 — `getContractChangeArchiveStatus`**

在 `src/lib/change-order.ts` 中添加：

```typescript
/**
 * 判断合同变更归档是否要求上传文件
 * 正常合同(收入/支出/内部结算) → 必须上传
 * 合同变更 → 可选（根据是否有 newFiles）
 */
export function isArchiveFileRequired(businessType: string): boolean {
  return businessType === "income_contract" ||
    businessType === "expense_contract" ||
    businessType === "inter_org_contract";
}
```

- [ ] **Step 2: 写单元测试（TDD — 先写测试）**

在 `test/unit/contract-change-order.test.ts` 末尾追加：

```typescript
describe('isArchiveFileRequired', () => {
  it('收入合同归档必须上传文件', () => {
    expect(isArchiveFileRequired('income_contract')).toBe(true);
  });

  it('支出合同归档必须上传文件', () => {
    expect(isArchiveFileRequired('expense_contract')).toBe(true);
  });

  it('内部结算合同归档必须上传文件', () => {
    expect(isArchiveFileRequired('inter_org_contract')).toBe(true);
  });

  it('合同变更归档不需要强制上传文件', () => {
    expect(isArchiveFileRequired('contract_change_order')).toBe(false);
  });

  it('未知类型默认需要上传文件（安全）', () => {
    expect(isArchiveFileRequired('unknown_type')).toBe(true);
  });
});
```

- [ ] **Step 3: 运行测试（预期部分失败）**

```bash
npx vitest run test/unit/contract-change-order.test.ts
```
预期：原有测试通过，新增的 `isArchiveFileRequired` 测试失败（函数未定义）。

- [ ] **Step 4: 实现 `isArchiveFileRequired`**

在 `src/lib/change-order.ts` 中实现上述函数。

- [ ] **Step 5: 运行测试（预期全部通过）**

```bash
npx vitest run test/unit/contract-change-order.test.ts
```
预期全部通过。

- [ ] **Step 6: 修改 `approval-engine.ts` — 调整"已批准"逻辑**

在 `updateBusinessStatus` 的 `case "contract_change_order"` 中：

当前代码（约第894-988行）：
```typescript
case "contract_change_order": {
  await prisma.contractChangeOrder.update({
    where: { id: businessId },
    data: updateData,
  });

  if (status === "已批准") {
    const order = await prisma.contractChangeOrder.findUnique({
      where: { id: businessId },
    });
    if (!order) break;

    // 1. 更新关联合同金额
    // ...（现有代码）

    // 2. 调整应收/应付记录
    // ...（现有代码）

    // 3. 追加归档文件到原合同
    // ...（现有代码）

    // 4. 变更单状态更新为"已生效"  ← 这行需要移除
    // await prisma.contractChangeOrder.update({
    //   where: { id: businessId },
    //   data: { status: "已生效" },
    // });
  }
  break;
}
```

移除步骤 4（变更单状态更新为"已生效"）。

- [ ] **Step 7: 添加"已归档"处理分支**

在 `case "contract_change_order"` 中新增 `status === "已归档"` 分支：

```typescript
case "contract_change_order": {
  await prisma.contractChangeOrder.update({
    where: { id: businessId },
    data: updateData,
  });

  if (status === "已批准") {
    // 现有业务逻辑（更新金额、调整应收应付、合并文件）
    // ...（保持不变，不设置 status）
  } else if (status === "已归档") {
    // 归档完成，变更单标记为"已生效"
    await prisma.contractChangeOrder.update({
      where: { id: businessId },
      data: {
        status: "已生效",
        ...(archivedUrl ? { archivedUrl } : {}),
      },
    });
  }
  break;
}
```

- [ ] **Step 8: 写 API 测试（TDD — 先写测试）**

新建 `test/api/change-orders-archive.test.ts`：

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../../src/lib/prisma';

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';
let testOrderId: string;
let testContractId: string;

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/erp_session=[^;]+/);
    if (match) sessionCookie = match[0];
  }
}

function authFetch(url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: { ...options?.headers, Cookie: sessionCookie },
  });
}

describe('合同变更归档 API', () => {
  beforeAll(async () => {
    await login();
    // 找一个已归档的合同作为测试数据
    const contract = await prisma.incomeContract.findFirst({
      where: { status: '合同归档' },
    });
    if (contract) {
      testContractId = contract.id;
    } else {
      const anyContract = await prisma.incomeContract.findFirst();
      testContractId = anyContract!.id;
    }
  });

  it('创建变更单（无文件）→ 提交审批 → 模拟归档', async () => {
    // 1. 创建变更单（无 newFiles）
    const createRes = await authFetch(`${BASE_URL}/api/change-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractType: 'income_contract',
        contractId: testContractId,
        changeReason: '归档测试：仅改金额',
        previousAmount: 100000,
        newAmount: 120000,
        newFiles: [], // 无新文件
      }),
    });
    expect(createRes.status).toBe(201);
    const order = (await createRes.json()).data;
    testOrderId = order.id;

    // 2. 验证创建成功，状态为"草稿"
    expect(order.status).toBe('草稿');
    expect(order.newFiles).toEqual([]);
  });

  afterAll(async () => {
    // 清理测试数据
    if (testOrderId) {
      await prisma.contractChangeOrder.delete({ where: { id: testOrderId } }).catch(() => {});
    }
  });
});
```

- [ ] **Step 9: 运行 API 测试**

先启动 dev server，然后：
```bash
npx vitest run test/api/change-orders-archive.test.ts
```
预期通过。

---

### Task 5: 内部结算合同 — 新增归档弹窗 + "发起变更"按钮

**文件：**
- 修改：`src/app/(dashboard)/contracts/internal-settlement/page.tsx`

- [ ] **Step 1: 确认现有状态和字段**

内部结算合同已有：
- `archivedUrl` 字段
- 状态 `contract_status: "合同归档"` 已在 statusBadgeMap 中
- `parseArchivedFiles` 工具函数已存在

- [ ] **Step 2: 新增归档 Modal 状态**

在组件中添加 state：
```typescript
const [archiveContract, setArchiveContract] = useState<InterOrgContract | null>(null);
const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
const [archiveUploading, setArchiveUploading] = useState(false);
const [archiveSaving, setArchiveSaving] = useState(false);
const archiveFileRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: 在"已批准"操作栏添加"合同归档"按钮**

在 `contract.status === "已批准"` 条件下添加：
```tsx
<button
  className="ios-btn ios-btn-ghost ios-btn-sm"
  onClick={() => {
    setArchiveContract(contract);
    setArchiveFiles([]);
  }}
>
  合同归档
</button>
```

- [ ] **Step 4: 新增归档 Modal**

参照收入合同的归档弹窗（约第2061-2155行），实现相同 UI 的归档弹窗，要求至少上传 1 个文件，确认后调用：

```
PUT /api/inter-org-contracts/:id
Body: { status: "合同归档", archivedUrl: JSON.stringify(archiveFiles) }
```

- [ ] **Step 5: 新增"发起变更"按钮（"合同归档"状态下）**

与收入/支出合同一致，在 `contract.status === "合同归档"` 条件下添加"发起变更"按钮，跳转到：
```
/contracts/change-orders/new?contractType=inter_org_contract&contractId=${contract.id}
```

- [ ] **Step 6: 验证**

手动验证：
1. 内部结算合同审批通过 → 显示"合同归档"按钮
2. 点击上传扫描件 → 确认归档 → 状态变为"合同归档"
3. "合同归档"状态下显示"发起变更"按钮

---

### Task 6: 合同变更 — 新增归档弹窗（可选上传）

**文件：**
- 修改：`src/app/(dashboard)/contracts/change-orders/page.tsx`

- [ ] **Step 1: 确认当前变更单状态流转**

当前状态：草稿 → 待审批 → 已批准 → 已生效

新增归档节点后，审批引擎会自动：
- 审批通过 → `updateBusinessStatus("已批准")` → 变更单状态设为"已批准"
- 下一节点是 archive → 实例状态为"待归档"

所以变更单列表页需要处理"已批准"状态（之前这个状态是瞬时的，现在变成了可操作状态）。

- [ ] **Step 2: 在状态映射中添加"待归档"状态**

```typescript
const statusColor: Record<string, string> = {
  "草稿": "ios-badge-gray",
  "待审批": "ios-badge-yellow",
  "已批准": "ios-badge-blue",
  "待归档": "ios-badge-purple",  // 新增
  "已归档": "ios-badge-green",   // 新增
  "已驳回": "ios-badge-red",
};
```

更新筛选下拉框的状态选项（第340行）：
```typescript
{["草稿", "待审批", "已批准", "待归档", "已归档", "已驳回"].map((s) => (
```

- [ ] **Step 3: 在变更单行操作栏添加归档按钮**

在 `o.status === "已批准" || o.status === "待归档"` 条件下添加"归档"按钮：

```tsx
{(o.status === "已批准" || o.status === "待归档") && (
  <button
    className="ios-btn ios-btn-ghost ios-btn-sm"
    onClick={() => handleArchiveOrder(o)}
  >
    归档
  </button>
)}
```

- [ ] **Step 4: 新增归档状态和弹窗**

```typescript
const [archiveOrder, setArchiveOrder] = useState<ChangeOrder | null>(null);
const [archiveFiles, setArchiveFiles] = useState<string[]>([]);
const [archiveUploading, setArchiveUploading] = useState(false);
const [archiveSaving, setArchiveSaving] = useState(false);
const archiveFileRef = useRef<HTMLInputElement>(null);

const handleArchiveOrder = async (order: ChangeOrder) => {
  // 获取变更单详情，查看是否有 newFiles
  const res = await fetch(`/api/change-orders/${order.id}`);
  const json = await res.json();
  const detail = json.data;
  setArchiveOrder(detail);
  setArchiveFiles(detail.newFiles || []);
};
```

- [ ] **Step 5: 归档弹窗（与正常合同一致，但上传可选）**

参照收入合同归档弹窗，区别：
- 按钮始终可用（`disabled={archiveSaving}`，不加 `archiveFiles.length === 0` 条件）
- 如果 `archiveFiles` 已有文件（来自变更单的 `newFiles`），显示已上传文件列表
- 可以继续上传或删除文件

确认归档后调用审批引擎的归档 action：
```
POST /api/approval-instances/:id/actions
Body: { action: "archive", archivedUrl: JSON.stringify(archiveFiles) }
```

- [ ] **Step 6: 验证**

手动验证：
1. 创建无文件的变更单 → 提交审批 → 审批通过 → 进入"待归档"
2. 点击归档 → 弹窗显示（文件可选）→ 确认归档 → 状态变为"已归档"
3. 创建有文件的变更单 → 同样流程归档 → 确认文件保存

---

### Task 7 (TDD): 更新 E2E 测试

**文件：**
- 修改：`test/e2e/change-order-flow.spec.ts`

- [ ] **Step 1: 写 E2E 测试（TDD — 先写）**

在现有 E2E 测试中补充归档流程验证：

```typescript
test('合同变更单归档流程', async ({ page }) => {
  await login(page);
  
  // 1. 进入变更单列表
  await page.goto(`${BASE_URL}/contracts/change-orders`);
  await page.waitForLoadState('networkidle');

  // 2. 找到"待归档"的变更单
  const pendingArchiveRow = page.locator('tr').filter({ hasText: '待归档' }).first();
  if (await pendingArchiveRow.count() > 0) {
    // 3. 点击归档
    await pendingArchiveRow.locator('button:has-text("归档")').click();
    await page.waitForLoadState('networkidle');

    // 4. 确认归档弹窗显示
    await expect(page.locator('text=合同归档').first()).toBeVisible({ timeout: 3000 });

    // 5. 点击确认归档（不上传文件）
    const confirmBtn = page.locator('button:has-text("确认归档")');
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // 6. 验证状态变更
    await expect(page.locator('text=已归档').first()).toBeVisible({ timeout: 5000 });
  }
});
```

- [ ] **Step 2: 运行 E2E 测试**

```bash
npx playwright test e2e/change-order-flow.spec.ts
```

---

### Task 8: 回归验证

- [ ] **Step 1: 运行单元测试**

```bash
npx vitest run test/unit/
```
确认所有现有测试不受影响（特别是 `detail-cards-registration.test.ts` 中 `contract_change_order` 的注册检查）。

- [ ] **Step 2: 运行回归脚本**

```bash
bash scripts/verify.sh
```

- [ ] **Step 3: 手动回归检查**

1. 收入合同归档流程不受影响（审批通过→待归档→上传文件→合同归档）
2. 支出合同归档流程不受影响
3. 流程设置页面其他模块（非合同/非财务）仍然没有归档/支付标签
4. 批量应用审批流功能正常（涉及 `getTerminalNodeType` 在批量保存中的调用）
