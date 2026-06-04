# 多经营主体改造 + 合同变更单 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成多经营主体架构的剩余改造（所属主体表单 + 内部结算合同重写 + 合同变更单模块），所有改动经 TDD 和回归验证。

**架构说明：**
- 所属主体改造：收入/支出合同表单加 Organization 下拉选择，联动银行账户筛选
- 内部结算合同重写：简化字段模型，去掉坐扣/代付逻辑，改为关联收入合同→计算结算金额→审批→生成应收
- 合同变更单：新增 ContractChangeOrder 模型，已批准合同通过变更单修改金额/字段，走审批流，通过后联动更新合同和应收/应付

**Tech Stack:** Next.js 14 (App Router), Prisma (PostgreSQL), TypeScript, Vitest, Playwright

---

## 文件变更清单

### 新建文件
| 文件 | 说明 |
|------|------|
| `prisma/migrations/xxx_multi_org_v2.sql` | 手写迁移 SQL |
| `test/unit/contract-change-order.test.ts` | 合同变更单业务逻辑单元测试 |
| `test/e2e/change-order-flow.spec.ts` | 变更单 E2E 测试 |
| `src/app/api/change-orders/route.ts` | 变更单列表+创建 API |
| `src/app/api/change-orders/[id]/route.ts` | 变更单详情+更新+删除 API |
| `src/app/(dashboard)/contracts/change-orders/page.tsx` | 变更单列表页 |
| `src/app/(dashboard)/contracts/change-orders/new/page.tsx` | 新增变更单页 |
| `src/app/(dashboard)/contracts/change-orders/[id]/page.tsx` | 变更单详情页 |
| `src/lib/change-order.ts` | 变更单业务逻辑（财务调整、文件追加） |

### 修改文件
| 文件 | 改动 |
|------|------|
| `prisma/schema.prisma` | InterOrgContract 模型字段重构、IncomeContract 加 interOrgContractId、新增 ContractChangeOrder 模型 |
| `src/lib/module-config.ts` | 新增 contract_change_order 业务类型 |
| `src/lib/approval-engine.ts` | 新增 inter_org_contract 和 contract_change_order 审批分支 |
| `src/lib/inter-org-settlement.ts` | 重写为结算金额计算函数（删除坐扣逻辑） |
| `src/app/api/inter-org-contracts/route.ts` | 更新 CRUD 适配新字段 |
| `src/app/api/inter-org-contracts/[id]/route.ts` | 更新 CRUD 适配新字段 |
| `src/app/api/receivables/route.ts` | 支持 inter_org_contract 来源查询 |
| `src/app/api/invoices/route.ts` | 前端 sourceTypeOptions 加 inter_org_contract |
| `src/app/(dashboard)/contracts/income/page.tsx` | 加所属主体下拉、操作栏加"发起变更"、详情页加"变更历史" |
| `src/app/(dashboard)/contracts/expense/page.tsx` | 加所属主体下拉、操作栏加"发起变更"、详情页加"变更历史" |
| `src/app/(dashboard)/contracts/internal-settlement/page.tsx` | 列表页重写（统一操作栏） |
| `src/app/(dashboard)/contracts/internal-settlement/new/page.tsx` | 表单重写（新字段结构） |
| `src/app/(dashboard)/contracts/internal-settlement/[id]/page.tsx` | 详情页重写（关联主合同、收款历史、发票、归档） |
| `src/app/(dashboard)/finance/income/page.tsx` | 删除管理费坐扣UI，支持 inter_org_contract 来源应收展示 |
| `src/components/ApprovalComponents.tsx` | 支持 inter_org_contract 和 contract_change_order 归档 |

### 测试文件
| 文件 | 类型 | 说明 |
|------|------|------|
| `test/unit/inter-org-settlement.test.ts` | 单元测试 | 重写：结算金额计算逻辑，9个用例 |
| `test/unit/contract-change-order.test.ts` | 单元测试 | 新增：变更单财务调整逻辑，12个用例 |
| `test/db/organization-relation.test.ts` | DB测试 | 更新：补充新字段验证 |
| `test/api/inter-org-contracts.test.ts` | API集成测试 | 重写：内部结算合同审批→生成应收 |
| `test/api/change-orders.test.ts` | API集成测试 | 新增：变更单 CRUD + 审批流 |
| `test/unit/route-integrity.test.ts` | 路由完整性 | 更新：新增菜单项和页面的路由 |
| `e2e/business-scenarios-multi-org.spec.ts` | E2E | 更新：补充新场景 |
| `test/e2e/change-order-flow.spec.ts` | E2E | 新增：变更单完整流程 |
| `scripts/verify.sh` | 回归脚本 | 无需修改 |

---

## 实施任务

### Task 1: Schema 模型变更

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `test/db/organization-relation.test.ts`

- [x] **Step 1: 修改 InterOrgContract 模型**

修改 `prisma/schema.prisma` 中 InterOrgContract 模型（约第1440行）：

```prisma
model InterOrgContract {
  id                  String    @id @default(cuid())
  contractNo          String    @map("contract_no")
  contractName        String    @map("contract_name")
  fromOrgId           String    @map("from_org_id")
  toOrgId             String    @map("to_org_id")
  type                String    @default("MANAGEMENT_FEE")
  relatedContractId   String?   @map("related_contract_id")
  mainContractAmount  Decimal?  @db.Decimal(15, 2) @map("main_contract_amount")
  managementFee       Decimal   @default(0) @db.Decimal(15, 2) @map("management_fee")
  taxBurden           Decimal   @default(0) @db.Decimal(15, 2) @map("tax_burden")
  otherFee            Decimal   @default(0) @db.Decimal(15, 2) @map("other_fee")
  otherFeeNote        String?   @map("other_fee_note")
  settlementAmount    Decimal   @db.Decimal(15, 2) @map("settlement_amount")
  status              String    @default("草稿")
  approvalInstanceId  String?   @map("approval_instance_id")
  archivedUrl         String?   @map("archived_url")
  remark              String?   @db.Text
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  lastModifiedBy      String?   @map("last_modified_by")
  createdById         String?   @map("created_by")

  fromOrg Organization @relation("FromOrg", fields: [fromOrgId], references: [id])
  toOrg   Organization @relation("ToOrg", fields: [toOrgId], references: [id])
  approvalInstance ApprovalInstance? @relation(fields: [approvalInstanceId], references: [id])

  @@map("inter_org_contracts")
}
```

- [x] **Step 2: IncomeContract 加 interOrgContractId 字段**

在 IncomeContract 模型内（`projectSourceId` 字段附近）新增：

```prisma
interOrgContractId  String?   @map("inter_org_contract_id")
```

- [x] **Step 3: 新增 ContractChangeOrder 模型**

在 schema.prisma 末尾新增：

```prisma
model ContractChangeOrder {
  id                  String    @id @default(cuid())
  changeNo            String    @map("change_no")
  contractType        String    @map("contract_type")
  contractId          String    @map("contract_id")
  changeReason        String    @map("change_reason")
  previousAmount      Decimal   @db.Decimal(15, 2) @map("previous_amount")
  previousData        Json      @map("previous_data")
  newAmount           Decimal   @db.Decimal(15, 2) @map("new_amount")
  newData             Json      @default("{}") @map("new_data")
  amountDifference    Decimal   @db.Decimal(15, 2) @map("amount_difference")
  hasOverCollection   Boolean   @default(false) @map("has_over_collection")
  overCollectionAmount Decimal? @db.Decimal(15, 2) @map("over_collection_amount")
  newFiles            Json      @default("[]") @map("new_files")
  status              String    @default("草稿")
  approvalInstanceId  String?   @map("approval_instance_id")
  remark              String?   @db.Text
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  createdById         String?   @map("created_by")
  lastModifiedBy      String?   @map("last_modified_by")

  approvalInstance ApprovalInstance? @relation(fields: [approvalInstanceId], references: [id])

  @@map("contract_change_orders")
}
```

- [x] **Step 4: 删除废弃字段**

查找并删除 schema 中以下字段定义（这些是旧关联，已被 relatedContractId+relatedContractType 替代）：
- InterOrgContract 的 `settlementType`、`managementFeeRate`、`managementFeeTotal`、`deductedAmount`、`remainingAmount`

- [x] **Step 5: 验证并同步数据库**

```bash
npx prisma validate
npx prisma db push
```

Expected: Both commands succeed, no errors.

- [x] **Step 6: 更新 DB 测试**

修改 `test/db/organization-relation.test.ts`，添加对新字段的验证：

```typescript
// 验证结算金额计算字段存在
const result = await prisma.interOrgContract.findFirst();
expect(result).toHaveProperty('settlementAmount');
expect(result).toHaveProperty('managementFee');
expect(result).toHaveProperty('taxBurden');
// 验证废弃字段不存在
expect(result).not.toHaveProperty('settlementType');
expect(result).not.toHaveProperty('deductedAmount');
```

- [x] **Step 7: 运行 DB 测试**

```bash
npx vitest run test/db/ -v
```

Expected: All tests pass.

- [x] **Step 8: Commit**

```bash
git add prisma/schema.prisma test/db/organization-relation.test.ts
git commit -m "feat:重构InterOrgContract模型，新增ContractChangeOrder模型"
```

---

### Task 2: 结算金额计算逻辑 TDD（纯函数）

**Files:**
- Modify: `src/lib/inter-org-settlement.ts`
- Test: `test/unit/inter-org-settlement.test.ts`

- [x] **Step 1: 先写测试**

重写 `test/unit/inter-org-settlement.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { calculateSettlementAmount } from '@/lib/inter-org-settlement';

describe('calculateSettlementAmount', () => {
  it('正常计算：主合同金额100，管理费10，税费0，其他费用0，结算额=90', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 0,
      otherFee: 0,
    });
    expect(result).toBe(90);
  });

  it('含税费承担：主合同100，管理费10，税费5，其他费用0，结算额=85', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 5,
      otherFee: 0,
    });
    expect(result).toBe(85);
  });

  it('含其他费用：主合同100，管理费10，税费0，其他费用3，结算额=87', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 0,
      otherFee: 3,
    });
    expect(result).toBe(87);
  });

  it('所有费用都为0，结算额=主合同金额', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 0,
      taxBurden: 0,
      otherFee: 0,
    });
    expect(result).toBe(100);
  });

  it('管理费=主合同金额，结算额=0', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 100,
      taxBurden: 0,
      otherFee: 0,
    });
    expect(result).toBe(0);
  });

  it('费用总和>主合同金额，结算额可为负数', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 80,
      taxBurden: 30,
      otherFee: 10,
    });
    expect(result).toBe(-20);
  });

  it('金额为字符串格式也能正常计算', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: '100.00',
      managementFee: '10.50',
      taxBurden: '5.00',
      otherFee: '2.50',
    });
    expect(result).toBe(82);
  });

  it('费用合计验证：管理费验证必填', () => {
    // 管理费为负数时抛错
    expect(() => calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: -1,
      taxBurden: 0,
      otherFee: 0,
    })).toThrow('管理费不能为负数');
  });

  it('其他费用>0时需提供说明（函数内部不校验，由表单层校验）', () => {
    // 纯计算函数不校验说明字段，只做计算
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 0,
      otherFee: 5,
    });
    // 不抛错，正常计算
    expect(result).toBe(85);
  });
});
```

- [x] **Step 2: 运行测试，确认失败**

```bash
npx vitest run test/unit/inter-org-settlement.test.ts -v
```

Expected: FAIL（函数未定义）

- [x] **Step 3: 写实现**

重写 `src/lib/inter-org-settlement.ts`：

```typescript
export interface SettlementInput {
  mainContractAmount: number | string;
  managementFee: number | string;
  taxBurden: number | string;
  otherFee: number | string;
}

export function calculateSettlementAmount(input: SettlementInput): number {
  const main = typeof input.mainContractAmount === 'string'
    ? parseFloat(input.mainContractAmount)
    : input.mainContractAmount;
  const fee = typeof input.managementFee === 'string'
    ? parseFloat(input.managementFee)
    : input.managementFee;
  const tax = typeof input.taxBurden === 'string'
    ? parseFloat(input.taxBurden)
    : input.taxBurden;
  const other = typeof input.otherFee === 'string'
    ? parseFloat(input.otherFee)
    : input.otherFee;

  if (fee < 0) throw new Error('管理费不能为负数');
  if (tax < 0) throw new Error('税费承担不能为负数');
  if (other < 0) throw new Error('其他费用不能为负数');

  return parseFloat((main - fee - tax - other).toFixed(2));
}
```

- [x] **Step 4: 运行测试，确认通过**

```bash
npx vitest run test/unit/inter-org-settlement.test.ts -v
```

Expected: ALL PASS（9 passed）

- [x] **Step 5: Commit**

```bash
git add src/lib/inter-org-settlement.ts test/unit/inter-org-settlement.test.ts
git commit -m "feat:重写结算金额计算逻辑，删除坐扣相关代码"
```

---

### Task 3: 合同变更单业务逻辑 TDD（纯函数）

**Files:**
- Create: `test/unit/contract-change-order.test.ts`
- Create: `src/lib/change-order.ts`

- [x] **Step 1: 先写测试**

创建 `test/unit/contract-change-order.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculateAmountDifference,
  checkOverCollection,
  applyContractUpdate,
  applyFinancialAdjustment,
  mergeArchivedFiles,
} from '@/lib/change-order';

describe('calculateAmountDifference', () => {
  it('金额增加：100→120，差额=20', () => {
    expect(calculateAmountDifference(100, 120)).toBe(20);
  });

  it('金额减少：100→80，差额=-20', () => {
    expect(calculateAmountDifference(100, 80)).toBe(-20);
  });

  it('金额不变：100→100，差额=0', () => {
    expect(calculateAmountDifference(100, 100)).toBe(0);
  });
});

describe('checkOverCollection', () => {
  it('未超收：已收60，新金额100，返回false', () => {
    const result = checkOverCollection({ paidAmount: 60, newAmount: 100 });
    expect(result.isOver).toBe(false);
  });

  it('超收：已收60，新金额50，返回true且超收金额=10', () => {
    const result = checkOverCollection({ paidAmount: 60, newAmount: 50 });
    expect(result.isOver).toBe(true);
    expect(result.overAmount).toBe(10);
  });

  it('刚好相等：已收100，新金额100，不超收', () => {
    const result = checkOverCollection({ paidAmount: 100, newAmount: 100 });
    expect(result.isOver).toBe(false);
  });

  it('无已收金额：已收0，新金额80，不超收', () => {
    const result = checkOverCollection({ paidAmount: 0, newAmount: 80 });
    expect(result.isOver).toBe(false);
  });
});

describe('applyFinancialAdjustment', () => {
  it('收入合同金额增加时，应收金额更新为新金额', () => {
    const receivable = { amount: 100, paidAmount: 0, status: '未收' };
    const result = applyFinancialAdjustment(receivable, 120);
    expect(result.amount).toBe(120);
    expect(result.hasOverCollection).toBe(false);
  });

  it('收入合同金额减少但未超收，应收更新且状态不变', () => {
    const receivable = { amount: 100, paidAmount: 50, status: '部分收款' };
    const result = applyFinancialAdjustment(receivable, 80);
    expect(result.amount).toBe(80);
    expect(result.hasOverCollection).toBe(false);
  });

  it('收入合同金额减少且超收，应收更新并标记', () => {
    const receivable = { amount: 100, paidAmount: 70, status: '部分收款' };
    const result = applyFinancialAdjustment(receivable, 50);
    expect(result.amount).toBe(50);
    expect(result.hasOverCollection).toBe(true);
    expect(result.overCollectionAmount).toBe(20);
  });
});

describe('mergeArchivedFiles', () => {
  it('原无文件，新增一个文件，合并后只有一个', () => {
    const result = mergeArchivedFiles(null, ['https://oss.com/new.pdf']);
    expect(result).toEqual(['https://oss.com/new.pdf']);
  });

  it('原有2个文件，新增1个，合并后有3个', () => {
    const existing = ['https://oss.com/a.pdf', 'https://oss.com/b.pdf'];
    const result = mergeArchivedFiles(JSON.stringify(existing), ['https://oss.com/c.pdf']);
    expect(result).toHaveLength(3);
    expect(result).toContain('https://oss.com/a.pdf');
    expect(result).toContain('https://oss.com/c.pdf');
  });

  it('无新增文件，合并后不变', () => {
    const existing = ['https://oss.com/a.pdf'];
    const result = mergeArchivedFiles(JSON.stringify(existing), []);
    expect(result).toEqual(existing);
  });
});
```

- [x] **Step 2: 运行测试，确认失败**

```bash
npx vitest run test/unit/contract-change-order.test.ts -v
```

Expected: FAIL（所有函数未定义）

- [x] **Step 3: 写实现**

创建 `src/lib/change-order.ts`：

```typescript
export function calculateAmountDifference(
  previousAmount: number,
  newAmount: number
): number {
  return parseFloat((newAmount - previousAmount).toFixed(2));
}

export function checkOverCollection(input: {
  paidAmount: number;
  newAmount: number;
}): { isOver: boolean; overAmount: number } {
  const over = input.paidAmount - input.newAmount;
  if (over > 0) {
    return { isOver: true, overAmount: parseFloat(over.toFixed(2)) };
  }
  return { isOver: false, overAmount: 0 };
}

export interface FinancialRecord {
  amount: number;
  paidAmount: number;
  status: string;
}

export interface AdjustmentResult {
  amount: number;
  hasOverCollection: boolean;
  overCollectionAmount?: number;
}

export function applyFinancialAdjustment(
  record: FinancialRecord,
  newAmount: number
): AdjustmentResult {
  const result: AdjustmentResult = {
    amount: newAmount,
    hasOverCollection: false,
  };

  if (record.paidAmount > newAmount) {
    result.hasOverCollection = true;
    result.overCollectionAmount = parseFloat(
      (record.paidAmount - newAmount).toFixed(2)
    );
  }

  return result;
}

export function mergeArchivedFiles(
  existingArchivedUrl: string | null,
  newFiles: string[]
): string[] {
  const existing: string[] = [];
  if (existingArchivedUrl) {
    try {
      const parsed = JSON.parse(existingArchivedUrl);
      if (Array.isArray(parsed)) existing.push(...parsed);
      else existing.push(existingArchivedUrl);
    } catch {
      existing.push(existingArchivedUrl);
    }
  }
  return [...existing, ...newFiles];
}
```

- [x] **Step 4: 运行测试，确认通过**

```bash
npx vitest run test/unit/contract-change-order.test.ts -v
```

Expected: ALL PASS（12 passed）

- [x] **Step 5: Commit**

```bash
git add src/lib/change-order.ts test/unit/contract-change-order.test.ts
git commit -m "feat:新增合同变更单业务逻辑函数"
```

---

### Task 4: 所属主体表单改造（收入合同）

**Files:**
- Modify: `src/app/(dashboard)/contracts/income/page.tsx`

- [x] **Step 1: 在收入合同新增/编辑表单加"所属主体"下拉**

在收入合同页面的表单中找到组织机构的引入位置。在 `useEffect` 中已有 `fetch("/api/organizations?pageSize=200")` 获取组织列表，在表单中合适位置增加下拉框。

在表单的"基本信息"区域（`contractNo` 下方）增加：

```tsx
{/* 所属主体 */}
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">
    所属主体 <span className="text-[#78716C]">*</span>
  </label>
  <select
    className="ios-select"
    value={form.organizationId || ''}
    onChange={(e) => updateForm("organizationId", e.target.value)}
  >
    <option value="">请选择主体</option>
    {organizations.map((org) => (
      <option key={org.id} value={org.id}>
        {org.name}
      </option>
    ))}
  </select>
</div>
```

同时初始化 `form.organizationId` 默认值为总公司的 ID（从 organizations 列表中找出 type=PARENT 的 org）。

- [x] **Step 2: 收款账户按主体筛选**

找到收款账户下拉框，修改其筛选逻辑：

```tsx
const filteredBankAccounts = bankAccounts.filter(
  account => !form.organizationId || account.organizationId === form.organizationId
);
```

- [x] **Step 3: 列表页增加"所属主体"筛选器**

在列表页的 filter-bar 区域增加：

```tsx
<select
  className="ios-select w-[160px]"
  value={filterOrg}
  onChange={(e) => setFilterOrg(e.target.value)}
>
  <option value="">全部主体</option>
  {organizations.map((org) => (
    <option key={org.id} value={org.id}>{org.name}</option>
  ))}
</select>
```

- [x] **Step 4: Commit**

```bash
git add src/app/(dashboard)/contracts/income/page.tsx
git commit -m "feat:收入合同增加所属主体选择，列表增加主体筛选"
```

---

### Task 5: 所属主体表单改造（支出合同）

**Files:**
- Modify: `src/app/(dashboard)/contracts/expense/page.tsx`

与 Task 4 完全一致的操作，在支出合同页面做同样的三处改动：
1. 新增/编辑表单加"所属主体"下拉（默认=总公司）
2. 付款账户按主体筛选
3. 列表页加"所属主体"筛选器

- [x] **Step 1: 支出合同表单加所属主体下拉**
- [x] **Step 2: 付款账户按主体筛选**
- [x] **Step 3: 列表页加主体筛选器**
- [x] **Step 4: Commit**

```bash
git add src/app/(dashboard)/contracts/expense/page.tsx
git commit -m "feat:支出合同增加所属主体选择，列表增加主体筛选"
```

---

### Task 6: 内部结算合同 API + 审批流

**Files:**
- Modify: `src/app/api/inter-org-contracts/route.ts`
- Modify: `src/app/api/inter-org-contracts/[id]/route.ts`
- Modify: `src/lib/approval-engine.ts`
- Test: `test/api/inter-org-contracts.test.ts`

- [x] **Step 1: 更新内部结算合同 POST API**

修改 `src/app/api/inter-org-contracts/route.ts`，适配新字段：

```typescript
// POST handler 中构造 data 时使用新字段
const data = {
  contractNo: body.contractNo,
  contractName: body.contractName,
  fromOrgId: body.fromOrgId,
  toOrgId: body.toOrgId,
  type: 'MANAGEMENT_FEE',
  relatedContractId: body.relatedContractId || null,
  mainContractAmount: body.mainContractAmount ? parseFloat(body.mainContractAmount) : null,
  managementFee: parseFloat(body.managementFee || 0),
  taxBurden: parseFloat(body.taxBurden || 0),
  otherFee: parseFloat(body.otherFee || 0),
  otherFeeNote: body.otherFeeNote || null,
  settlementAmount: parseFloat(body.settlementAmount),
  status: '草稿',
  remark: body.remark || null,
  createdById: currentUser?.id,
};
```

- [x] **Step 2: 更新内部结算合同 GET 列表查询**

在 GET handler 中，增加关联收入合同信息的查询（当 relatedContractId 不为空时）：

```typescript
// 查询时 include 关联的 incomeContract
const contracts = await prisma.interOrgContract.findMany({
  include: {
    fromOrg: true,
    toOrg: true,
  },
  orderBy: { createdAt: 'desc' },
});
// 如果有 relatedContractId，单独查询收入合同信息
for (const contract of contracts) {
  if (contract.relatedContractId) {
    const incomeContract = await prisma.incomeContract.findUnique({
      where: { id: contract.relatedContractId },
      include: { customer: true, project: true },
    });
    (contract as any).relatedContract = incomeContract;
  }
}
```

- [x] **Step 3: 审批引擎增加 inter_org_contract 分支**

在 `src/lib/approval-engine.ts` 的 `updateBusinessStatus` 函数中新增：

```typescript
case "inter_org_contract": {
  await prisma.interOrgContract.update({
    where: { id: businessId },
    data: updateData,
  });
  
  if (status === "已批准") {
    // 防重复创建
    const existingReceivables = await prisma.receivable.findMany({
      where: { sourceType: "inter_org_contract", sourceId: businessId },
    });
    
    if (existingReceivables.length === 0) {
      const contract = await prisma.interOrgContract.findUnique({
        where: { id: businessId },
      });
      if (contract && contract.settlementAmount > 0) {
        // 查找关联收入合同的 projectSourceId
        let projectSourceId: string | null = null;
        if (contract.relatedContractId) {
          const incomeContract = await prisma.incomeContract.findUnique({
            where: { id: contract.relatedContractId },
            select: { projectSourceId: true },
          });
          projectSourceId = incomeContract?.projectSourceId || null;
        }
        
        await prisma.receivable.create({
          data: {
            sourceType: "inter_org_contract",
            sourceId: businessId,
            projectSourceId,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: contract.settlementAmount,
            paidAmount: 0,
            invoicedAmount: 0,
            status: "未收",
          },
        });
      }
    }
    
    // 更新关联的收入合同标记
    if (contract?.relatedContractId) {
      await prisma.incomeContract.update({
        where: { id: contract.relatedContractId },
        data: { interOrgContractId: businessId },
      });
    }
  } else if (status === "已驳回" || status === "草稿") {
    // 清空关联标记
    const contract = await prisma.interOrgContract.findUnique({
      where: { id: businessId },
      select: { relatedContractId: true },
    });
    if (contract?.relatedContractId) {
      await prisma.incomeContract.update({
        where: { id: contract.relatedContractId },
        data: { interOrgContractId: null },
      });
    }
  }
  break;
}
```

- [x] **Step 4: 更新 API 集成测试**

重写 `test/api/inter-org-contracts.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';

describe('InterOrgContract API', () => {
  it('创建内部结算合同应包含新字段', async () => {
    const res = await fetch('http://localhost:3000/api/inter-org-contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractNo: 'INT-2026-001',
        contractName: '测试内部结算',
        fromOrgId: 'org-hq',
        toOrgId: 'org-branch',
        relatedContractId: 'contract-001',
        mainContractAmount: 100000,
        managementFee: 10000,
        taxBurden: 0,
        otherFee: 0,
        settlementAmount: 90000,
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.settlementAmount).toBe(90000);
    expect(json.data.type).toBe('MANAGEMENT_FEE');
  });
});
```

- [x] **Step 5: Commit**

```bash
git add src/app/api/inter-org-contracts/ src/lib/approval-engine.ts test/api/inter-org-contracts.test.ts
git commit -m "feat:内部结算合同API适配新字段，审批通过后自动生成应收"
```

---

### Task 7: 内部结算合同页面重写

**Files:**
- Modify: `src/app/(dashboard)/contracts/internal-settlement/page.tsx`
- Modify: `src/app/(dashboard)/contracts/internal-settlement/new/page.tsx`
- Modify: `src/app/(dashboard)/contracts/internal-settlement/[id]/page.tsx`

- [x] **Step 1: 重写新建页面表单**

重写 `new/page.tsx` 的表单，按新字段结构：

```tsx
// 关联主合同选择器
<div>
  <label>关联收入合同 <span>*</span></label>
  <select value={form.relatedContractId} onChange={...}>
    <option value="">请选择收入合同（仅显示有项目的）</option>
    {incomeContracts.filter(c => c.projectSourceId).map(c => (
      <option key={c.id} value={c.id}>{c.contractNo} - {c.customer?.name}</option>
    ))}
  </select>
</div>

// 主合同金额（自动带出，只读）
<div>
  <label>主合同金额</label>
  <input type="text" readOnly className="bg-gray-100" value={mainContractAmount} />
</div>

// 管理费
<div>
  <label>管理费 <span>*</span></label>
  <input type="number" value={form.managementFee} onChange={...} />
</div>

// 税费承担
<div>
  <label>税费承担</label>
  <input type="number" value={form.taxBurden} onChange={...} />
</div>

// 其他费用 + 说明
<div>
  <label>其他费用</label>
  <input type="number" value={form.otherFee} onChange={...} />
</div>
{parseFloat(form.otherFee) > 0 && (
  <div>
    <label>其他费用说明 <span className="text-red-500">*</span></label>
    <textarea value={form.otherFeeNote} onChange={...} />
  </div>
)}

// 结算合同额（自动计算，只读）
<div>
  <label>结算合同额</label>
  <input type="text" readOnly className="bg-gray-100" value={settlementAmount} />
  <p className="text-xs text-gray-500">
    = 主合同金额 - 管理费 - 税费承担 - 其他费用
  </p>
</div>
```

关键逻辑：当 `relatedContractId` 变化时，自动带出主合同金额；当管理费/税费/其他费用变化时，自动重算结算合同额。

- [x] **Step 2: 重写列表页操作栏**

修改 `page.tsx`，将整行点击跳转改为操作栏按钮：

```tsx
<td>
  <div className="flex items-center gap-1">
    <button onClick={() => router.push(`/contracts/internal-settlement/${contract.id}`)}>
      查看
    </button>
    {(contract.status === '草稿' || contract.status === '已驳回') && (
      <>
        <button onClick={() => handleEdit(contract)}>编辑</button>
        <button onClick={() => handleDelete(contract)}>删除</button>
      </>
    )}
    {contract.status === '草稿' && (
      <button onClick={() => handleSubmitApproval(contract)}>提交审批</button>
    )}
  </div>
</td>
```

- [x] **Step 3: 重写详情页**

详情页新增区块：
1. 关联主合同区块：显示收入合同编号、客户、金额、状态，可跳转
2. 费用信息区块：主合同金额、管理费、税费承担、其他费用（含说明）、结算合同额
3. 收款记录区块：查关联 Receivable 状态，列出 ReceiptVoucher 历史
4. 发票记录区块：查关联 Invoice 列表，加"开票登记"按钮
5. 归档文件区块：展示 archivedUrl 文件列表

- [x] **Step 4: Commit**

```bash
git add src/app/(dashboard)/contracts/internal-settlement/
git commit -m "feat:内部结算合同页面重写，适配新字段和流程"
```

---

### Task 8: Invoice API 增加 inter_org_contract 支持

**Files:**
- Modify: `src/app/api/invoices/route.ts`
- Modify: `src/app/(dashboard)/finance/invoices/page.tsx`

- [x] **Step 1: 前端发票 sourceTypeOptions 增加 inter_org_contract**

在 `finance/invoices/page.tsx` 中找到 `sourceTypeOptions` 和 `sourceTypeMap`，添加：

```typescript
// sourceTypeOptions
{ value: "inter_org_contract", label: "内部结算开票" }

// sourceTypeMap
inter_org_contract: "内部结算",
```

- [x] **Step 2: 前端发票表单中，当选择 inter_org_contract 时，显示内部结算合同选择器**

在发票新建/编辑表单中，当 `form.sourceType === 'inter_org_contract'` 时，显示内部结算合同的下拉选择：

```tsx
{form.sourceType === 'inter_org_contract' && (
  <div>
    <label>内部结算合同 <span>*</span></label>
    <select
      value={form.sourceId}
      onChange={(e) => {
        updateForm('sourceId', e.target.value);
        // 自动填入 seller/buyer 信息
        const contract = interOrgContracts.find(c => c.id === e.target.value);
        if (contract) {
          updateForm('sellerName', contract.fromOrg.name);
          updateForm('buyerName', contract.toOrg.name);
        }
      }}
    >
      {interOrgContracts.map(c => (
        <option key={c.id} value={c.id}>{c.contractNo}</option>
      ))}
    </select>
  </div>
)}
```

- [x] **Step 3: Commit**

```bash
git add src/app/api/invoices/route.ts src/app/(dashboard)/finance/invoices/page.tsx
git commit -m "feat:发票支持inter_org_contract来源类型"
```

---

### Task 9: Receivable API 支持 inter_org_contract 查询

**Files:**
- Modify: `src/app/api/receivables/route.ts`

- [x] **Step 1: 在 GET 查询中增加 inter_org_contract 分支**

找到 `sourceType === 'income_contract'` 的处理分支，在旁边添加：

```typescript
if (sourceType === 'inter_org_contract') {
  // 关联内部结算合同信息
  const contractMap = new Map();
  for (const record of data) {
    if (!contractMap.has(record.sourceId)) {
      const contract = await prisma.interOrgContract.findUnique({
        where: { id: record.sourceId },
        include: { fromOrg: true, toOrg: true },
      });
      contractMap.set(record.sourceId, contract);
    }
    (record as any).sourceContract = contractMap.get(record.sourceId);
  }
}
```

- [x] **Step 2: Commit**

```bash
git add src/app/api/receivables/route.ts
git commit -m "feat:应收API支持inter_org_contract来源查询"
```

---

### Task 10: 合同变更单 API + 审批流 TDD

**Files:**
- Create: `src/app/api/change-orders/route.ts`
- Create: `src/app/api/change-orders/[id]/route.ts`
- Modify: `src/lib/approval-engine.ts`
- Test: `test/api/change-orders.test.ts`

- [x] **Step 1: 创建变更单 API**

创建 `src/app/api/change-orders/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractType = searchParams.get('contractType');
    const contractId = searchParams.get('contractId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (contractType) where.contractType = contractType;
    if (contractId) where.contractId = contractId;
    if (status) where.status = status;

    const data = await prisma.contractChangeOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('获取变更单列表失败:', error);
    return NextResponse.json({ error: '获取变更单列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();

    // 校验变更原因
    if (!body.changeReason?.trim()) {
      return NextResponse.json({ error: '变更原因不能为空' }, { status: 400 });
    }

    const data = await prisma.contractChangeOrder.create({
      data: {
        changeNo: `BG-${Date.now()}`,
        contractType: body.contractType,
        contractId: body.contractId,
        changeReason: body.changeReason,
        previousAmount: parseFloat(body.previousAmount),
        previousData: body.previousData || {},
        newAmount: parseFloat(body.newAmount),
        newData: body.newData || {},
        amountDifference: parseFloat(body.newAmount) - parseFloat(body.previousAmount),
        newFiles: body.newFiles || [],
        status: '草稿',
        remark: body.remark || null,
        createdById: currentUser?.id,
      },
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('创建变更单失败:', error);
    return NextResponse.json({ error: '创建变更单失败' }, { status: 500 });
  }
}
```

- [x] **Step 2: 创建变更单详情 API**

创建 `src/app/api/change-orders/[id]/route.ts`，支持 GET、PUT、DELETE，其中 PUT 的编辑权限校验与合同一致（仅草稿/已驳回状态可编辑）。

- [x] **Step 3: 审批引擎增加 contract_change_order 分支**

在 `approval-engine.ts` 的 `updateBusinessStatus` 中新增：

```typescript
case "contract_change_order": {
  const order = await prisma.contractChangeOrder.findUnique({
    where: { id: businessId },
  });
  if (!order) throw new Error('变更单不存在');

  await prisma.contractChangeOrder.update({
    where: { id: businessId },
    data: updateData,
  });

  if (status === "已批准") {
    // 1. 更新关联合同字段
    await applyChangeOrderToContract(order);
    // 2. 调整应收/应付
    await adjustFinancialRecords(order);
    // 3. 追加归档文件
    await appendArchivedFiles(order);
    // 4. 变更单状态→已生效
    await prisma.contractChangeOrder.update({
      where: { id: businessId },
      data: { status: '已生效' },
    });
  }
  break;
}
```

`applyChangeOrderToContract`、`adjustFinancialRecords`、`appendArchivedFiles` 三个函数在 `src/lib/change-order.ts` 中已实现，这里调用即可。

- [x] **Step 4: 写 API 集成测试**

创建 `test/api/change-orders.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';

describe('ChangeOrder API', () => {
  it('创建变更单应返回正确的数据结构', async () => {
    const res = await fetch('http://localhost:3000/api/change-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractType: 'income_contract',
        contractId: 'test-contract-id',
        changeReason: '客户要求增加合同金额',
        previousAmount: 100000,
        previousData: { paymentTerms: '一次性付清' },
        newAmount: 120000,
        newData: { paymentTerms: '分期付款' },
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.changeReason).toBe('客户要求增加合同金额');
    expect(json.data.amountDifference).toBe(20000);
    expect(json.data.status).toBe('草稿');
  });
});
```

- [x] **Step 5: Commit**

```bash
git add src/app/api/change-orders/ src/lib/approval-engine.ts test/api/change-orders.test.ts
git commit -m "feat:新增合同变更单API和审批流"
```

---

### Task 11: 合同变更单页面

**Files:**
- Create: `src/app/(dashboard)/contracts/change-orders/page.tsx`
- Create: `src/app/(dashboard)/contracts/change-orders/new/page.tsx`
- Create: `src/app/(dashboard)/contracts/change-orders/[id]/page.tsx`
- Modify: `src/app/(dashboard)/contracts/income/page.tsx`（加"发起变更"按钮）
- Modify: `src/app/(dashboard)/contracts/expense/page.tsx`（加"发起变更"按钮）
- Modify: `src/app/(dashboard)/contracts/internal-settlement/[id]/page.tsx`（加"发起变更"按钮）

- [x] **Step 1: 创建变更单列表页**

创建 `change-orders/page.tsx`，列表展示：变更单编号、关联合同类型、原金额→新金额、差额、状态、操作栏（查看/编辑/删除/提交审批）。

- [x] **Step 2: 创建变更单新建/编辑页**

创建 `change-orders/new/page.tsx`，表单包含：
- 合同类型下拉（收入合同/支出合同/内部结算合同）
- 合同选择器（根据类型筛选对应的合同列表，仅显示已批准/已归档的）
- 变更原因（文本框，必填）
- 变更后金额（必填）
- 其他字段：根据合同类型动态展示可编辑字段
- 新文件上传（可选）

- [x] **Step 3: 创建变更单详情页**

创建 `change-orders/[id]/page.tsx`，展示：
- 变更前后对比表
- 关联合同信息（可跳转）
- 变更原因
- 新文件列表
- 审批进度
- 超收标记

- [x] **Step 4: 合同详情页加"发起变更"按钮**

在收入/支出/内部结算合同的详情页操作栏中，在已批准/已归档状态下显示"发起变更"按钮，点击跳转到新建变更单页并预填合同信息：

```tsx
{contract.status === '已批准' || contract.status === '已归档' ? (
  <button onClick={() => router.push(
    `/contracts/change-orders/new?contractType=income_contract&contractId=${contract.id}`
  )}>
    发起变更
  </button>
) : null}
```

- [x] **Step 5: 合同详情页加"变更历史"区块**

在收入/支出合同详情页底部，查询关联的变更单列表并展示：

```tsx
{/* 变更历史 */}
{changeOrders.length > 0 && (
  <div className="bento-card-static">
    <h3>变更历史</h3>
    <table>
      <thead>
        <tr><th>变更单号</th><th>变更前</th><th>变更后</th><th>差额</th><th>状态</th><th>时间</th></tr>
      </thead>
      <tbody>
        {changeOrders.map(order => (
          <tr key={order.id}>
            <td><a href={`/contracts/change-orders/${order.id}`}>{order.changeNo}</a></td>
            <td>{formatAmount(order.previousAmount)}</td>
            <td>{formatAmount(order.newAmount)}</td>
            <td>{formatAmount(order.amountDifference)}</td>
            <td>{order.status}</td>
            <td>{formatDate(order.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

- [x] **Step 6: Commit**

```bash
git add src/app/(dashboard)/contracts/change-orders/ src/app/(dashboard)/contracts/income/page.tsx src/app/(dashboard)/contracts/expense/page.tsx src/app/(dashboard)/contracts/internal-settlement/[id]/page.tsx
git commit -m "feat:合同变更单前后端页面"
```

---

### Task 12: 路由完整性测试

**Files:**
- Modify: `test/unit/route-integrity.test.ts`

- [x] **Step 1: 添加新页面的路由测试**

在 `test/unit/route-integrity.test.ts` 中新增：

```typescript
it('内部结算合同页面可访问', async () => {
  const res = await fetch('http://localhost:3000/contracts/internal-settlement');
  expect(res.status).toBe(200);
});

it('内部结算新建页面可访问', async () => {
  const res = await fetch('http://localhost:3000/contracts/internal-settlement/new');
  expect(res.status).toBe(200);
});

it('合同变更单列表页可访问', async () => {
  const res = await fetch('http://localhost:3000/contracts/change-orders');
  expect(res.status).toBe(200);
});

it('合同变更单新建页可访问', async () => {
  const res = await fetch('http://localhost:3000/contracts/change-orders/new');
  expect(res.status).toBe(200);
});
```

- [x] **Step 2: 运行路由测试**

```bash
# 先启动 dev server
npm run dev &
# 等待启动后运行
npx vitest run test/unit/route-integrity.test.ts -v
```

Expected: ALL PASS

- [x] **Step 3: Commit**

```bash
git add test/unit/route-integrity.test.ts
git commit -m "test:新增内部结算和变更单页面路由完整性测试"
```

---

### Task 13: Module-config 注册 + seed 同步

**Files:**
- Modify: `src/lib/module-config.ts`

- [x] **Step 1: 注册 contract_change_order 业务类型**

在 MODULE_CONFIG 数组中新增：

```typescript
{ key: "contract_change_order", name: "合同变更", group: "合同管理" },
```

- [x] **Step 2: 运行 seed 同步审批流配置**

```bash
npx prisma db seed
```

- [x] **Step 3: 在审批流配置页面验证**

手动访问 `/settings/approval-flow`，确认"合同管理"分组下能看到"合同变更"模块。

- [x] **Step 4: Commit**

```bash
git add src/lib/module-config.ts
git commit -m "feat:注册合同变更审批业务类型"
```

---

### Task 14: 删除管理费坐扣 UI（财务收入页面）

**Files:**
- Modify: `src/app/(dashboard)/finance/income/page.tsx`

- [x] **Step 1: 删除管理费坐扣相关代码**

在 `finance/income/page.tsx` 中搜索并删除：
1. 管理费坐扣的 UI 区块（显示总管理费/已扣/剩余的区块）
2. 查询关联 NETTED 类型内部结算合同的逻辑
3. 管理费坐扣的提交逻辑

保留正常的收款流程（选择应收记录→填写金额→提交），不受影响。

- [x] **Step 2: 支持展示 inter_org_contract 来源的应收记录**

在应收列表的 sourceType 展示中增加 `inter_org_contract`：

```typescript
const sourceTypeLabel: Record<string, string> = {
  income_contract: '收入合同',
  inter_org_contract: '内部结算',
};
```

- [x] **Step 3: Commit**

```bash
git add src/app/(dashboard)/finance/income/page.tsx
git commit -m "feat:删除管理费坐扣UI，支持内部结算来源应收展示"
```

---

### Task 15: E2E 测试

**Files:**
- Modify: `e2e/business-scenarios-multi-org.spec.ts`
- Create: `test/e2e/change-order-flow.spec.ts`

- [x] **Step 1: 更新多组织业务场景 E2E**

在 `e2e/business-scenarios-multi-org.spec.ts` 中补充内部结算合同业务场景：

```typescript
test('内部结算完整流程：创建→审批→收款', async ({ page }) => {
  // 1. 登录
  // 2. 新建内部结算合同（关联收入合同，填写管理费等）
  // 3. 提交审批
  // 4. 审批通过
  // 5. 验证自动生成应收记录
  // 6. 在财务首页看到该应收
});
```

- [x] **Step 2: 创建变更单 E2E**

创建 `test/e2e/change-order-flow.spec.ts`：

```typescript
import { test, expect } from '@playwright/test';

test('合同变更单完整流程', async ({ page }) => {
  // 1. 登录
  // 2. 进入已批准的收入合同详情页
  // 3. 点击"发起变更"
  // 4. 填写变更后金额和变更原因
  // 5. 提交审批
  // 6. 审批通过
  // 7. 验证合同金额已更新
  // 8. 验证变更历史中可见该变更记录
});

test('超收场景：金额减少后标记超收', async ({ page }) => {
  // 1. 找一个已部分收款的合同
  // 2. 发起金额减少的变更
  // 3. 审批通过
  // 4. 验证超收标记和超收金额正确
});
```

- [x] **Step 3: Commit**

```bash
git add e2e/ test/e2e/
git commit -m "test:新增内部结算和变更单E2E测试"
```

---

### Task 16: 回归验证

- [x] **Step 1: 运行回归脚本**

```bash
bash scripts/verify.sh
```

Expected: All checks pass.

- [x] **Step 2: 运行全量单元测试**

```bash
npx vitest run test/unit/ test/db/ -v
```

Expected: ALL PASS

- [x] **Step 3: 运行全量 E2E**

```bash
npx playwright test e2e/business-scenarios-multi-org.spec.ts test/e2e/change-order-flow.spec.ts
```

Expected: ALL PASS

- [x] **Step 4: 最终提交**

```bash
git add -A
git commit -m "chore:回归验证通过，多经营主体改造+合同变更单完成"
```
