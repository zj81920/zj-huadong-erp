# 多经营主体架构改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **本实施计划要求严格遵循 TDD（测试驱动开发）**：每个功能点的步骤顺序为 写测试 → 验证失败 → 写实现 → 验证通过。不允许跳过测试直接写实现代码。

**Goal:** 将单公司系统改造为支持多经营主体的架构，涵盖总公司、分公司、咨询公司、挂靠公司之间的合同、发票、资金流管理。

**Architecture:** 新增 Organization 模型作为业务数据归属根，新增 InterOrgContract 模型处理内部结算，现有业务表增加 organizationId 字段。系统仍以分公司为主视角，通过筛选器查看其他主体数据。核心业务逻辑（管理费坐扣算法）采用 TDD 开发。

**Tech Stack:** Next.js 15, Prisma, PostgreSQL, TypeScript, Vitest (单元测试), Playwright (E2E)

**Design Spec:** `docs/superpowers/specs/2026-06-04-multi-organization-design.md`

---

## 第一阶段：核心数据模型

### Task 1: 创建 Organization 模型 + Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: 在 schema.prisma 添加 Organization 模型**

在 `prisma/schema.prisma` 文件末尾添加：

```prisma
model Organization {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  shortName String?  @map("short_name")
  taxId     String?  @map("tax_id")
  type      String   // PARENT / BRANCH / CONSULTING / AFFILIATED
  isActive  Boolean  @default(true) @map("is_active")
  sort      Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("organizations")
}
```

- [x] **Step 2: 验证 Schema 并同步数据库**

```bash
npx prisma validate
npx prisma db push
```

Expected: Schema 验证通过，数据库同步成功。

- [x] **Step 3: 在 seed.ts 添加种子数据**

在 `prisma/seed.ts` 中添加 Organization 种子数据：

```typescript
// 经营主体
const organizations = await Promise.all([
  prisma.organization.create({
    data: { code: 'HQ', name: '总公司', shortName: '总公司', type: 'PARENT', sort: 1 },
  }),
  prisma.organization.create({
    data: { code: 'BRANCH', name: '安徽华东化工医药工程有限责任公司', shortName: '分公司', type: 'BRANCH', sort: 2 },
  }),
  prisma.organization.create({
    data: { code: 'CONSULT', name: '咨询公司', shortName: '咨询公司', type: 'CONSULTING', sort: 3 },
  }),
  prisma.organization.create({
    data: { code: 'AFFILIATED', name: '挂靠公司', shortName: '挂靠公司', type: 'AFFILIATED', sort: 4 },
  }),
]);
```

- [x] **Step 4: 运行 seed 验证**

```bash
npx prisma db seed
```

Expected: 四家经营主体数据写入数据库。

### Task 2: 写 Organization API 的测试（TDD）

**Files:**
- Create: `test/api/organizations.test.ts`
- Create: `src/app/api/organizations/route.ts`

- [x] **Step 1: 写 GET /api/organizations 的测试**

```typescript
// test/api/organizations.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../../src/lib/prisma';

describe('Organizations API', () => {
  beforeAll(async () => {
    // 确保种子数据已存在
    const count = await prisma.organization.count();
    if (count === 0) {
      throw new Error('请先运行 seed: npx prisma db seed');
    }
  });

  it('GET /api/organizations 返回所有活跃主体', async () => {
    const res = await fetch('http://localhost:3000/api/organizations');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(4);
    const branch = body.data.find((o: any) => o.code === 'BRANCH');
    expect(branch).toBeDefined();
    expect(branch.type).toBe('BRANCH');
  });

  it('GET /api/organizations?type=PARENT 只返回总公司', async () => {
    const res = await fetch('http://localhost:3000/api/organizations?type=PARENT');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].code).toBe('HQ');
  });
});
```

- [x] **Step 2: 运行测试，验证失败**

```bash
npx vitest run test/api/organizations.test.ts
```

Expected: FAIL — 404 或路由不存在错误。

- [x] **Step 3: 实现 GET /api/organizations API 路由**

创建 `src/app/api/organizations/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  const where: Record<string, unknown> = { isActive: true };
  if (type) where.type = type;

  const organizations = await prisma.organization.findMany({
    where,
    orderBy: { sort: 'asc' },
  });

  return NextResponse.json({ data: organizations });
}
```

- [x] **Step 4: 运行测试，验证通过**

```bash
npx vitest run test/api/organizations.test.ts
```

Expected: PASS

### Task 3: 给核心业务表加 organizationId（TDD 验证迁移）

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `test/db/organization-relation.test.ts`

- [x] **Step 1: 写测试验证 organizationId 字段存在**

```typescript
// test/db/organization-relation.test.ts
import { describe, it, expect } from 'vitest';
import prisma from '../../src/lib/prisma';

describe('Organization 关联', () => {
  const models = [
    'incomeContract',
    'expenseContract',
    'invoice',
    'receivable',
    'payable',
    'receiptVoucher',
    'paymentVoucher',
    'project',
  ] as const;

  for (const model of models) {
    it(`${model} 应有 organizationId 字段`, () => {
      // Prisma Client 的类型推断会验证 organizationId 是否存在
      // 这里通过 DMMF 检查
      const dmmf = (prisma as any)._dmmf;
      const modelMap = dmmf.modelMap;
      expect(modelMap[model]).toBeDefined();
      const fields = modelMap[model].fields.map((f: any) => f.name);
      expect(fields).toContain('organizationId');
    });
  }
});
```

- [x] **Step 2: 运行测试，验证失败**

```bash
npx vitest run test/db/organization-relation.test.ts
```

Expected: FAIL — organizationId 字段不存在。

- [x] **Step 3: 在 schema.prisma 中添加 organizationId 字段**

在 `IncomeContract`、`ExpenseContract`、`Invoice`、`Receivable`、`Payable`、`ReceiptVoucher`、`PaymentVoucher`、`Project` 模型中添加：

```prisma
organizationId String @map("organization_id")
organization   Organization @relation(fields: [organizationId], references: [id])
```

同时在 Organization 模型中添加反向关联：

```prisma
model Organization {
  ...
  incomeContracts    IncomeContract[]
  expenseContracts   ExpenseContract[]
  invoices           Invoice[]
  receivables        Receivable[]
  payables           Payable[]
  receiptVouchers    ReceiptVoucher[]
  paymentVouchers    PaymentVoucher[]
  projects           Project[]
}
```

⚠️ organizationId 设为必填字段，现有数据需要提供默认值。使用 `prisma db push` 时需先给现有数据补 organizationId。

- [x] **Step 4: 验证 Schema 并同步**

```bash
npx prisma validate
npx prisma db push
```

注意：如果现有表已有数据，`db push` 会提示添加必填字段需要默认值。可以手动执行 SQL 为现有数据填充默认 organizationId（指向分公司的 ID）。

- [x] **Step 5: 重新运行测试，验证通过**

```bash
npx vitest run test/db/organization-relation.test.ts
```

Expected: PASS

### Task 4: BankAccount 关联 Organization

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: 给 BankAccount 加 organizationId 字段**

```prisma
model BankAccount {
  ...
  organizationId String? @map("organization_id")
  organization   Organization? @relation(fields: [organizationId], references: [id])
}
```

- [x] **Step 2: 在 Organization 模型加反向关联**

```prisma
model Organization {
  ...
  bankAccounts BankAccount[]
}
```

- [x] **Step 3: 验证 Schema 并同步数据库**

```bash
npx prisma validate
npx prisma db push
```

---

## 第二阶段：业务流程改造

### Task 5: 收入合同表单增加"所属主体"字段（TDD）

**Files:**
- Create: `test/api/income-contracts-org.test.ts`
- Modify: `src/app/api/income-contracts/route.ts`
- Modify: `src/app/(dashboard)/contracts/income/page.tsx` 或对应组件

- [x] **Step 1: 写测试验证收入合同 POST 支持 organizationId**

```typescript
// test/api/income-contracts-org.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../../src/lib/prisma';

describe('收入合同 - 经营主体', () => {
  let branchOrgId: string;
  let customerId: string;

  beforeAll(async () => {
    const branch = await prisma.organization.findUnique({ where: { code: 'BRANCH' } });
    branchOrgId = branch!.id;
  });

  it('创建收入合同时可以指定 organizationId', async () => {
    const res = await fetch('http://localhost:3000/api/income-contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: branchOrgId,
        customerId: 'test-customer',
        totalAmount: 100000,
        contractName: '测试合同-主体归属',
        contractNo: 'TEST-ORG-001',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.organizationId).toBe(branchOrgId);
  });

  it('筛选 organizationId 只返回对应主体的合同', async () => {
    const res = await fetch(
      `http://localhost:3000/api/income-contracts?organizationId=${branchOrgId}`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    body.data.forEach((c: any) => {
      expect(c.organizationId).toBe(branchOrgId);
    });
  });
});
```

- [x] **Step 2: 运行测试，验证失败**

```bash
npx vitest run test/api/income-contracts-org.test.ts
```

Expected: FAIL — organizationId 未被 API 处理。

- [x] **Step 3: 修改收入合同 API 支持 organizationId**

在 `src/app/api/income-contracts/route.ts` 的 POST handler 中，从 body 读取 `organizationId` 并写入数据库。在 GET handler 中支持 `organizationId` 查询参数筛选。

```typescript
// POST 创建时
const { organizationId, ...rest } = await request.json();
const contract = await prisma.incomeContract.create({
  data: {
    ...rest,
    organizationId,
  },
});

// GET 查询时
const organizationId = searchParams.get('organizationId');
const where: any = {};
if (organizationId) where.organizationId = organizationId;
```

- [x] **Step 4: 运行测试，验证通过**

```bash
npx vitest run test/api/income-contracts-org.test.ts
```

Expected: PASS

### Task 6: 其他业务模块的表单和筛选器改造

**Files（参考 Task 5 模式逐个模块改造）：**
- Modify: `src/app/api/expense-contracts/route.ts`
- Modify: `src/app/api/invoices/route.ts`
- Modify: `src/app/api/receivables/route.ts`
- Modify: `src/app/api/payables/route.ts`
- 各对应页面组件的表单和列表

- [x] **Step 1: 支出合同 API 增加 organizationId**

同上模式，修改 `expense-contracts/route.ts` 的 POST 和 GET。

- [x] **Step 2: 发票 API 增加 organizationId**

修改 `invoices/route.ts` 的 POST 和 GET。

- [x] **Step 3: 收付款 API 增加 organizationId**

修改 `receivables/route.ts`、`payables/route.ts`、`receipt-vouchers/[id]/route.ts`、`payment-vouchers/[id]/route.ts`。

- [x] **Step 4: 前端列表页增加"所属主体"筛选器**

在收入合同、支出合同、发票、收付款等列表页的筛选区域增加组织下拉框：

```tsx
// 示例：筛选器组件中增加
<select
  value={filters.organizationId || ''}
  onChange={(e) => setFilters({ ...filters, organizationId: e.target.value })}
>
  <option value="">全部主体</option>
  {organizations.map((org) => (
    <option key={org.id} value={org.id}>{org.shortName}</option>
  ))}
</select>
```

- [x] **Step 5: 前端新增/编辑表单增加"所属主体"下拉框**

各表单的必填字段，默认值 = 分公司 ID：

```tsx
<select name="organizationId" defaultValue={branchOrgId} required>
  {organizations.map((org) => (
    <option key={org.id} value={org.id}>{org.name}</option>
  ))}
</select>
```

### Task 7: 侧边栏新增"内部结算"菜单

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [x] **Step 1: 在 Sidebar 的合同管理分组下添加菜单项**

```tsx
// Sidebar.tsx 合同管理部分
{ label: '收入合同', href: '/contracts/income', icon: FileText },
{ label: '支出合同', href: '/contracts/expense', icon: FileText },
{ label: '内部结算', href: '/contracts/internal-settlement', icon: ArrowLeftRight }, // 新增
{ label: '非合同收支', href: '/contracts/non-contract', icon: Receipt },
```

---

## 第三阶段：内部结算模块（核心新功能）

### Task 8: 写 InterOrgContract 坐扣逻辑的单元测试（TDD 核心）

**Files:**
- Create: `src/lib/inter-org-settlement.ts`
- Create: `test/unit/inter-org-settlement.test.ts`

- [x] **Step 1: 写坐扣逻辑的测试**

```typescript
// test/unit/inter-org-settlement.test.ts
import { describe, it, expect } from 'vitest';
import {
  deductManagementFee,
  createInterOrgContract,
  InterOrgContractInput,
} from '../../src/lib/inter-org-settlement';

describe('管理费坐扣逻辑', () => {
  it('正常坐扣后 deductedAmount 和 remainingAmount 正确更新', () => {
    const contract = createInterOrgContract({
      managementFeeTotal: 10000,
      deductedAmount: 0,
      remainingAmount: 10000,
    });

    const result = deductManagementFee(contract, 3000);

    expect(result.deductedAmount).toBe(3000);
    expect(result.remainingAmount).toBe(7000);
    expect(result.isCompleted).toBe(false);
  });

  it('坐扣超过剩余管理费时报错', () => {
    const contract = createInterOrgContract({
      managementFeeTotal: 5000,
      deductedAmount: 3000,
      remainingAmount: 2000,
    });

    expect(() => deductManagementFee(contract, 3000))
      .toThrow('本次扣管理费不能超过剩余金额');
  });

  it('坐扣后剩余为0时标记已完成', () => {
    const contract = createInterOrgContract({
      managementFeeTotal: 5000,
      deductedAmount: 3000,
      remainingAmount: 2000,
    });

    const result = deductManagementFee(contract, 2000);

    expect(result.remainingAmount).toBe(0);
    expect(result.isCompleted).toBe(true);
  });

  it('多次坐扣累计不超过总额', () => {
    let contract = createInterOrgContract({
      managementFeeTotal: 10000,
      deductedAmount: 0,
      remainingAmount: 10000,
    });

    contract = deductManagementFee(contract, 4000);
    expect(contract.deductedAmount).toBe(4000);
    expect(contract.remainingAmount).toBe(6000);
    expect(contract.isCompleted).toBe(false);

    contract = deductManagementFee(contract, 6000);
    expect(contract.deductedAmount).toBe(10000);
    expect(contract.remainingAmount).toBe(0);
    expect(contract.isCompleted).toBe(true);
  });

  it('全额坐扣（一次性扣完）', () => {
    const contract = createInterOrgContract({
      managementFeeTotal: 8000,
      deductedAmount: 0,
      remainingAmount: 8000,
    });

    const result = deductManagementFee(contract, 8000);

    expect(result.deductedAmount).toBe(8000);
    expect(result.remainingAmount).toBe(0);
    expect(result.isCompleted).toBe(true);
  });

  it('坐扣金额为0时不允许（无意义的操作）', () => {
    const contract = createInterOrgContract({
      managementFeeTotal: 10000,
      deductedAmount: 0,
      remainingAmount: 10000,
    });

    expect(() => deductManagementFee(contract, 0))
      .toThrow('本次扣管理费必须大于0');
  });

  it('已完成的合同不允许继续坐扣', () => {
    const contract = createInterOrgContract({
      managementFeeTotal: 5000,
      deductedAmount: 5000,
      remainingAmount: 0,
      status: '已完成',
    });

    expect(() => deductManagementFee(contract, 1000))
      .toThrow('该内部结算合同已完成，无需再扣管理费');
  });
});
```

- [x] **Step 2: 运行测试，验证失败**

```bash
npx vitest run test/unit/inter-org-settlement.test.ts
```

Expected: FAIL — 模块不存在。

- [x] **Step 3: 实现坐扣逻辑的最小代码**

```typescript
// src/lib/inter-org-settlement.ts
export interface InterOrgContractInput {
  managementFeeTotal: number;
  deductedAmount: number;
  remainingAmount: number;
  status?: string;
}

export interface DeductionResult {
  deductedAmount: number;
  remainingAmount: number;
  isCompleted: boolean;
  netSettlement: number;
}

export function createInterOrgContract(input: InterOrgContractInput): InterOrgContractInput {
  return {
    managementFeeTotal: input.managementFeeTotal,
    deductedAmount: input.deductedAmount || 0,
    remainingAmount: input.remainingAmount ?? input.managementFeeTotal,
    status: input.status || '执行中',
  };
}

export function deductManagementFee(
  contract: InterOrgContractInput,
  amount: number
): InterOrgContractInput & DeductionResult {
  if (contract.status === '已完成') {
    throw new Error('该内部结算合同已完成，无需再扣管理费');
  }

  if (amount <= 0) {
    throw new Error('本次扣管理费必须大于0');
  }

  if (amount > contract.remainingAmount) {
    throw new Error('本次扣管理费不能超过剩余金额');
  }

  const newDeducted = contract.deductedAmount + amount;
  const newRemaining = contract.remainingAmount - amount;
  const isCompleted = newRemaining <= 0;

  return {
    ...contract,
    deductedAmount: newDeducted,
    remainingAmount: newRemaining,
    isCompleted,
    netSettlement: 0, // 坐扣不触发额外结算
    status: isCompleted ? '已完成' : '执行中',
  };
}
```

- [x] **Step 4: 运行测试，验证全部通过**

```bash
npx vitest run test/unit/inter-org-settlement.test.ts
```

Expected: ALL PASS

### Task 9: 创建 InterOrgContract Prisma 模型 + API

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/app/api/inter-org-contracts/route.ts`
- Create: `src/app/api/inter-org-contracts/[id]/route.ts`
- Create: `test/api/inter-org-contracts.test.ts`

- [x] **Step 1: 在 schema.prisma 中添加 InterOrgContract 模型**

```prisma
model InterOrgContract {
  id                  String    @id @default(cuid())
  contractNo          String    @map("contract_no")
  contractName        String    @map("contract_name")
  fromOrgId           String    @map("from_org_id")
  toOrgId             String    @map("to_org_id")
  type                String    // MANAGEMENT_FEE / INTERNAL_SERVICE / REIMBURSEMENT / OTHER
  settlementType      String    // NETTED / SEPARATE
  relatedContractId   String?   @map("related_contract_id")
  relatedContractType String?   @map("related_contract_type")
  projectId           String?   @map("project_id")
  totalAmount         Decimal   @map("total_amount") @db.Decimal(15, 2)
  managementFeeRate   Decimal?  @map("management_fee_rate") @db.Decimal(5, 4)
  managementFeeTotal  Decimal   @map("management_fee_total") @db.Decimal(15, 2)
  deductedAmount      Decimal   @default(0) @map("deducted_amount") @db.Decimal(15, 2)
  remainingAmount     Decimal   @map("remaining_amount") @db.Decimal(15, 2)
  status              String    @default("待审批")
  approvalInstanceId  String?   @map("approval_instance_id")
  remark              String?   @db.Text
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  fromOrg Organization @relation("from_org", fields: [fromOrgId], references: [id])
  toOrg   Organization @relation("to_org", fields: [toOrgId], references: [id])

  @@map("inter_org_contracts")
}
```

在 Organization 模型中添加反向关联：

```prisma
model Organization {
  ...
  fromContracts InterOrgContract[] @relation("from_org")
  toContracts   InterOrgContract[] @relation("to_org")
}
```

- [x] **Step 2: 验证 Schema 并同步**

```bash
npx prisma validate
npx prisma db push
```

- [x] **Step 3: 写 API 测试**

```typescript
// test/api/inter-org-contracts.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../../src/lib/prisma';

describe('内部结算合同 API', () => {
  let hqOrgId: string;
  let branchOrgId: string;

  beforeAll(async () => {
    const hq = await prisma.organization.findUnique({ where: { code: 'HQ' } });
    const branch = await prisma.organization.findUnique({ where: { code: 'BRANCH' } });
    hqOrgId = hq!.id;
    branchOrgId = branch!.id;
  });

  it('POST 创建内部结算合同（管理费坐扣）', async () => {
    const res = await fetch('http://localhost:3000/api/inter-org-contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractNo: 'INT-2026-001',
        contractName: '2026年项目管理费',
        fromOrgId: hqOrgId,
        toOrgId: branchOrgId,
        type: 'MANAGEMENT_FEE',
        settlementType: 'NETTED',
        totalAmount: 100000,
        managementFeeTotal: 10000,
        remainingAmount: 10000,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.fromOrgId).toBe(hqOrgId);
    expect(body.toOrgId).toBe(branchOrgId);
    expect(body.remainingAmount).toBe(10000);
  });
});
```

- [x] **Step 4: 运行测试，验证失败**

```bash
npx vitest run test/api/inter-org-contracts.test.ts
```

Expected: FAIL

- [x] **Step 5: 实现 CRUD API**

```typescript
// src/app/api/inter-org-contracts/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const orgId = searchParams.get('orgId');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (orgId) {
    where.OR = [{ fromOrgId: orgId }, { toOrgId: orgId }];
  }

  const contracts = await prisma.interOrgContract.findMany({
    where,
    include: { fromOrg: true, toOrg: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: contracts });
}

export async function POST(request: Request) {
  const body = await request.json();
  const contract = await prisma.interOrgContract.create({ data: body });
  return NextResponse.json(contract, { status: 201 });
}
```

- [x] **Step 6: 运行测试，验证通过**

```bash
npx vitest run test/api/inter-org-contracts.test.ts
```

Expected: PASS

### Task 10: 审批流新增 inter_org_contract 类型

**Files:**
- Modify: `src/lib/module-config.ts`
- Modify: `src/lib/approval-engine.ts`

- [x] **Step 1: 在 module-config.ts 新增配置**

```typescript
// src/lib/module-config.ts
{ key: "inter_org_contract", name: "内部结算合同", group: "合同管理" },
```

- [x] **Step 2: 在 approval-engine.ts 的 updateBusinessStatus 新增处理**

```typescript
case "inter_org_contract": {
  await prisma.interOrgContract.update({
    where: { id: businessId },
    data: {
      status: status === '已批准' && settlementType === 'NETTED' ? '执行中' : status,
      approvalInstanceId: instanceId || undefined,
    } as any,
  });
  break;
}
```

- [x] **Step 3: 运行现有审批测试，确保未破坏已有逻辑**

```bash
npx vitest run test/
```

Expected: ALL PASS

### Task 11: 收款凭证录入增加坐扣操作

**Files:**
- Modify: `src/app/api/receipt-vouchers/[id]/route.ts` 或对应录入页面组件
- Modify: `src/lib/inter-org-settlement.ts`（增加数据库操作版）
- Create: `test/unit/inter-org-settlement-db.test.ts`

- [x] **Step 1: 写坐扣数据库操作的测试**

```typescript
// test/unit/inter-org-settlement-db.test.ts
import { describe, it, expect } from 'vitest';
import { processDeduction } from '../../src/lib/inter-org-settlement';

describe('坐扣数据库操作', () => {
  it('坐扣后生成净额支付记录', () => {
    const result = processDeduction({
      receiptAmount: 50000,
      deductionAmount: 5000,
      fromOrgId: 'hq-id',
      toOrgId: 'branch-id',
    });

    expect(result.netSettlementAmount).toBe(45000);
    expect(result.payableRecord).toBeDefined();
    expect(result.payableRecord.amount).toBe(45000);
    expect(result.payableRecord.fromOrgId).toBe('hq-id');
    expect(result.payableRecord.toOrgId).toBe('branch-id');
  });
});
```

- [x] **Step 2: 运行测试，验证失败**

```bash
npx vitest run test/unit/inter-org-settlement-db.test.ts
```

Expected: FAIL

- [x] **Step 3: 实现坐扣+生成支付记录的逻辑**

```typescript
// 追加到 src/lib/inter-org-settlement.ts
export interface DeductionInput {
  receiptAmount: number;
  deductionAmount: number;
  fromOrgId: string;
  toOrgId: string;
  receiptVoucherId?: string;
  interOrgContractId?: string;
}

export interface PayableRecord {
  amount: number;
  fromOrgId: string;
  toOrgId: string;
  sourceType: string;
  sourceId?: string;
}

export interface DeductionResult {
  netSettlementAmount: number;
  payableRecord: PayableRecord;
}

export function processDeduction(input: DeductionInput): DeductionResult {
  const netSettlementAmount = input.receiptAmount - input.deductionAmount;

  if (netSettlementAmount < 0) {
    throw new Error('扣管理费后净额不能为负数');
  }

  return {
    netSettlementAmount,
    payableRecord: {
      amount: netSettlementAmount,
      fromOrgId: input.fromOrgId,
      toOrgId: input.toOrgId,
      sourceType: 'inter_org_contract',
      sourceId: input.interOrgContractId,
    },
  };
}
```

- [x] **Step 4: 运行测试，验证通过**

```bash
npx vitest run test/unit/inter-org-settlement-db.test.ts
```

Expected: PASS

- [x] **Step 5: 收款凭证页面增加坐扣 UI**

在收款凭证录入/编辑页面，增加管理费坐扣区块，当选择的收入合同有关联的 NETTED 类型内部结算合同时显示：

```tsx
// 收款凭证页面中的坐扣区块
{relatedInterOrgContract && relatedInterOrgContract.settlementType === 'NETTED' && (
  <div className="border rounded-lg p-4 bg-gray-50">
    <h3 className="font-medium mb-2">管理费坐扣</h3>
    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
      <div>总管理费: ¥{relatedInterOrgContract.managementFeeTotal}</div>
      <div>已扣: ¥{relatedInterOrgContract.deductedAmount}</div>
      <div>剩余: ¥{relatedInterOrgContract.remainingAmount}</div>
    </div>
    <div>
      <label>本次扣管理费</label>
      <input
        type="number"
        name="deductionAmount"
        max={relatedInterOrgContract.remainingAmount}
        required
        onChange={(e) => {
          const net = Number(e.target.value)
            ? receiptAmount - Number(e.target.value)
            : receiptAmount;
          setNetAmount(net);
        }}
      />
      <span>净额: ¥{netAmount}</span>
    </div>
  </div>
)}
```

### Task 12: 创建内部结算合同页面

**Files:**
- Create: `src/app/(dashboard)/contracts/internal-settlement/page.tsx`
- Create: `src/app/(dashboard)/contracts/internal-settlement/new/page.tsx`
- Create: `src/app/(dashboard)/contracts/internal-settlement/[id]/page.tsx`

- [x] **Step 1: 创建列表页**

基本 CRUD 列表页，展示所有内部结算合同，支持按类型、状态、主体筛选。

```tsx
// internal-settlement/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';

interface InterOrgContract {
  id: string;
  contractNo: string;
  contractName: string;
  type: string;
  settlementType: string;
  totalAmount: number;
  managementFeeTotal: number;
  deductedAmount: number;
  remainingAmount: number;
  status: string;
  fromOrg: { name: string };
  toOrg: { name: string };
}

export default function InternalSettlementPage() {
  const [contracts, setContracts] = useState<InterOrgContract[]>([]);
  const [filters, setFilters] = useState({ type: '', status: '' });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    fetch(`/api/inter-org-contracts?${params}`)
      .then(res => res.json())
      .then(data => setContracts(data.data));
  }, [filters]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">内部结算合同</h1>
        <Link href="/contracts/internal-settlement/new" className="btn btn-primary">
          <Plus className="w-4 h-4 mr-1" /> 新增
        </Link>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-4 mb-4">
        <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
          <option value="">全部类型</option>
          <option value="MANAGEMENT_FEE">管理费</option>
          <option value="INTERNAL_SERVICE">内部服务</option>
          <option value="REIMBURSEMENT">代付结算</option>
          <option value="OTHER">其他</option>
        </select>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <option value="">全部状态</option>
          <option value="待审批">待审批</option>
          <option value="已批准">已批准</option>
          <option value="执行中">执行中</option>
          <option value="已付款">已付款</option>
          <option value="已完成">已完成</option>
        </select>
      </div>

      {/* 合同列表 */}
      <table className="w-full">
        <thead>
          <tr>
            <th>合同编号</th>
            <th>合同名称</th>
            <th>类型</th>
            <th>收款方</th>
            <th>付款方</th>
            <th>结算方式</th>
            <th>总金额</th>
            <th>管理费</th>
            <th>已扣</th>
            <th>剩余</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map(c => (
            <tr key={c.id}>
              <td>{c.contractNo}</td>
              <td>{c.contractName}</td>
              <td>{c.type === 'MANAGEMENT_FEE' ? '管理费' : c.type}</td>
              <td>{c.fromOrg.name}</td>
              <td>{c.toOrg.name}</td>
              <td>{c.settlementType === 'NETTED' ? '坐扣' : '单独支付'}</td>
              <td>¥{c.totalAmount.toLocaleString()}</td>
              <td>¥{c.managementFeeTotal.toLocaleString()}</td>
              <td>¥{Number(c.deductedAmount).toLocaleString()}</td>
              <td>¥{Number(c.remainingAmount).toLocaleString()}</td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [x] **Step 2: 创建新增/详情页**

参考现有收入合同页面的风格，创建新增表单和详情页面，支持：
- 选择收款方/付款方（Organization 下拉）
- 选择类型和结算方式
- 输入合同金额、管理费总额
- 关联外部合同（可选）
- 提交后走审批流

---

## 第四阶段：收尾

### Task 13: 发票关联 inter_org_contract

**Files:**
- Modify: `src/app/api/invoices/route.ts`（updateRelatedInvoicedAmount 函数）

- [x] **Step 1: 在 updateRelatedInvoicedAmount 中添加 inter_org_contract 处理**

```typescript
} else if (sourceType === "inter_org_contract") {
  // 内部结算合同发票只做记录，不更新合同上的 invoicedAmount
  // 因为内部结算合同没有 invoicedAmount 字段
  // 只需验证合同存在
  const contract = await prisma.interOrgContract.findUnique({
    where: { id: sourceId },
  });
  if (!contract) {
    throw new Error('内部结算合同不存在');
  }
}
```

- [x] **Step 2: 写测试验证内部结算合同可以开票**

```typescript
// 追加到 test/api/inter-org-contracts.test.ts
it('可以为内部结算合同创建发票', async () => {
  const contract = await prisma.interOrgContract.findFirst();
  const branch = await prisma.organization.findUnique({ where: { code: 'BRANCH' } });

  const res = await fetch('http://localhost:3000/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceNo: 'INV-INT-001',
      invoiceType: '增值税专用发票',
      invoiceCategory: '销项发票',
      invoiceDate: new Date().toISOString(),
      amount: 10000,
      totalAmount: 10000,
      sourceType: 'inter_org_contract',
      sourceId: contract!.id,
      organizationId: branch!.id,
      sellerName: branch!.name,
      buyerName: '总公司',
    }),
  });
  expect(res.status).toBe(201);
});
```

### Task 14: 报表增加主体维度

**Files:**
- Modify: `src/app/(dashboard)/finance/reports/page.tsx` 或其他报表页面

- [x] **Step 1: 报表增加"按主体汇总"和"跨主体合并"视图**

在财务报表页面的筛选条件中增加主体选择：

```tsx
// 报表筛选器
<select value={reportOrgId} onChange={setReportOrgId}>
  <option value="">全部主体（合并报表）</option>
  {organizations.map(org => (
    <option key={org.id} value={org.id}>{org.shortName}</option>
  ))}
</select>
```

### Task 15: 回归验证

**Files:**
- Modify: `scripts/verify.sh`

- [x] **Step 1: 运行完整回归脚本**

```bash
bash scripts/verify.sh
```

Expected: 所有验证通过。

- [x] **Step 2: 运行所有单元测试**

```bash
npx vitest run
```

Expected: ALL PASS

- [x] **Step 3: 运行 E2E 测试**

```bash
npx playwright test
```

Expected: ALL PASS
