# 角色权限与流程设置重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构角色权限模型（引入 CRUD 操作级权限）、优化设置 UI 导航和编辑器、移除项目关联角色、增加发起人自动跳过、增加业务表单草稿入口

**Architecture:** 后端 Prisma + Next.js API Routes，前端 React Server/Client Components + Tailwind CSS，审批引擎为纯函数模块。TDD 覆盖审批引擎和权限校验核心逻辑。

**Tech Stack:** Next.js 14+ App Router, TypeScript, Prisma (PostgreSQL), Tailwind CSS

---

## 文件结构

### 新增文件
| 文件 | 说明 |
|---|---|
| `src/app/(dashboard)/settings/roles/[id]/page.tsx` | 角色详情页（分 Tab） |
| `src/components/RolePermissionMatrix.tsx` | CRUD 权限矩阵组件 |
| `src/components/RoleBasicInfoForm.tsx` | 角色基本信息 Tab |
| `src/components/RoleApprovalRefs.tsx` | 角色审批引用 Tab |
| `src/lib/types/permissions.ts` | 权限类型定义 |
| `prisma/migrations/` | 数据迁移脚本 |

### 修改文件
| 文件 | 说明 |
|---|---|
| `prisma/schema.prisma` | Role 模型字段变更 |
| `src/lib/approval-engine.ts` | 移除项目关联 + 通用自动跳过 |
| `src/lib/module-permissions.ts` | 增强导出业务模块列表供 UI 使用 |
| `src/app/(dashboard)/settings/roles/page.tsx` | 卡片布局重构 |
| `src/app/(dashboard)/settings/approval-flow/page.tsx` | 编辑缓存 + 数据源统一 |
| `src/app/api/roles/route.ts` | CRUD 权限字段适配 |
| `src/app/api/roles/[id]/route.ts` | CRUD 权限字段适配 |
| `src/app/(dashboard)/approvals/page.tsx` | 增加「我的草稿」Tab |
| `src/components/Sidebar.tsx` | 设置菜单分组 |
| `src/app/(dashboard)/settings/layout.tsx` | 设置导航分组（如有） |
| `src/app/api/approval-flows/route.ts` | 保存校验放宽 |

### 检查清单文件
| 文件 | 说明 |
|---|---|
| `docs/superpowers/checklists/2026-06-03-redesign-regression.md` | 回归认证清单 |

---

## 前置条件

- [ ] **Step 1: 确认当前测试能通过**

```bash
# 运行现有 e2e 测试作为 baseline
cd /Users/zj81920/应用开发/zj-huadong-erp
npx playwright test e2e/approval-flow.spec.ts --reporter=list 2>&1 | tail -20
```
Expected: 至少现有审批流程测试通过

- [ ] **Step 2: 确认现有构建能通过**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx next build 2>&1 | tail -20
```
Expected: 构建成功，无类型错误

---

## Task 1: 权限数据源统一 — module-permissions.ts 增强

**Files:**
- Modify: `src/lib/module-permissions.ts`
- Test: `src/lib/module-permissions.ts`（类型检查）

**背景**：当前角色设置页面和流程设置页面分别硬编码了模块列表。统一从 `module-permissions.ts` 导出，其他文件从此导入。

- [ ] **Step 1: 新增业务模块列表导出**

在 `src/lib/module-permissions.ts` 末尾增加：

```typescript
// === 业务模块定义（供流程设置页面使用）===
export interface BusinessModule {
  type: string;       // 模块 key
  name: string;       // 显示名称
}

export interface BusinessModuleGroup {
  label: string;      // 分组名称（如"商务管理"）
  modules: BusinessModule[];
}

// 流程设置页面需要的业务模块分组
// 有审批流需求的模块列表
export const BUSINESS_MODULE_GROUPS: BusinessModuleGroup[] = [
  {
    label: "商务管理",
    modules: [
      { type: "quotation", name: "商务报价" },
      { type: "supplier", name: "供应商审批" },
    ],
  },
  {
    label: "项目管理",
    modules: [
      { type: "outsourcing", name: "外包任务" },
    ],
  },
  {
    label: "项目采购",
    modules: [
      { type: "purchase_request", name: "采购需求" },
      { type: "delivery_receipt", name: "到货验收" },
    ],
  },
  {
    label: "合同管理",
    modules: [
      { type: "income_contract", name: "收入合同" },
      { type: "expense_contract", name: "支出合同" },
    ],
  },
  {
    label: "财务管理 · 支出",
    modules: [
      { type: "non_contract_expense", name: "其他支付" },
      { type: "payment_application", name: "合同支付" },
      { type: "lending_out", name: "借出款" },
      { type: "expense_report", name: "费用报销" },
      { type: "salary_payment", name: "工资发放" },
      { type: "borrowing_return_application", name: "借入资金归还" },
    ],
  },
];

export const BUSINESS_MODULES = BUSINESS_MODULE_GROUPS.flatMap((g) => g.modules);
```

- [ ] **Step 2: 验证类型正确**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx tsc --noEmit src/lib/module-permissions.ts
```
Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add src/lib/module-permissions.ts
git commit -m "refactor: unify business module definitions in module-permissions.ts"
```

---

## Task 2: Prisma Schema 变更 + 迁移脚本

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260603_role_permission_redesign.sql`（手动迁移）

**背景**：Role 模型字段变更（`accessibleModules`→`modulePermissions`，`isProjectRole` 移除，`sort`→`level`）

- [ ] **Step 1: 更新 Prisma Schema**

修改 `prisma/schema.prisma` 中的 Role model：

```prisma
model Role {
  id            String      @id @default(cuid())
  code          String      @unique
  name          String
  description   String?
  departmentId  String?     @map("department_id")

  // isProjectRole 已移除

  // accessibleModules 被 modulePermissions + subModuleOverrides 替代
  modulePermissions    String   @default("{}") @map("module_permissions")
  subModuleOverrides   String   @default("{}") @map("sub_module_overrides")

  isGlobalVisible    Boolean     @default(false) @map("is_global_visible")

  level              Int         @default(0)       // 替代 sort
  isActive           Boolean     @default(true) @map("is_active")
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")
  lastModifiedBy     String?     @map("last_modified_by")

  department Department? @relation(fields: [departmentId], references: [id])
  users      UserRole[]

  @@map("roles")
}
```

- [ ] **Step 2: 运行 Prisma 验证**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx prisma validate
```
Expected: Schema 验证通过

- [ ] **Step 3: 推送 Schema 变更到数据库**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx prisma db push
```
Expected: 数据库表更新成功

- [ ] **Step 4: 编写数据迁移脚本**

创建 `prisma/scripts/20260603-migrate-role-permissions.ts`：

```typescript
import prisma from "../../src/lib/prisma";

async function migrateRoles() {
  const roles = await prisma.role.findMany();
  
  for (const role of roles) {
    // 迁移 accessibleModules → modulePermissions
    let oldModules: string[] = [];
    try {
      oldModules = JSON.parse(role.accessibleModules || "[]");
    } catch {
      oldModules = [];
    }

    const modulePermissions: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> = {};
    for (const modKey of oldModules) {
      // 旧模型中只要出现在列表里就赋予完整 CRUD
      modulePermissions[modKey] = { create: true, read: true, update: true, delete: true };
    }

    // 迁移 sort → level
    const level = (role as any).sort || 0;

    // 更新记录
    await prisma.role.update({
      where: { id: role.id },
      data: {
        modulePermissions: JSON.stringify(modulePermissions),
        subModuleOverrides: "{}",
        level,
      },
    });
  }

  console.log(`Migrated ${roles.length} roles`);
}

migrateRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: 运行迁移脚本**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx ts-node prisma/scripts/20260603-migrate-role-permissions.ts
```
Expected: `Migrated N roles`

- [ ] **Step 6: 提交**

```bash
git add prisma/schema.prisma prisma/scripts/20260603-migrate-role-permissions.ts
git commit -m "feat: update Role model with CRUD permissions and level field"
```

---

## Task 3: 权限类型定义（TDD）

**Files:**
- Create: `src/lib/types/permissions.ts`
- Test: `src/lib/__tests__/permissions.test.ts`

**背景**：定义 CRUD 权限的 TypeScript 类型和工具函数

- [ ] **Step 1: 定义类型**

`src/lib/types/permissions.ts`：

```typescript
// CRUD 操作权限
export interface CrudPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export const EMPTY_CRUD: CrudPermissions = {
  create: false,
  read: false,
  update: false,
  delete: false,
};

export const FULL_CRUD: CrudPermissions = {
  create: true,
  read: true,
  update: true,
  delete: true,
};

export const READ_ONLY: CrudPermissions = {
  create: false,
  read: true,
  update: false,
  delete: false,
};

// 角色权限配置
export interface RolePermissions {
  modulePermissions: Record<string, CrudPermissions>;      // 模块级
  subModuleOverrides: Record<string, Partial<CrudPermissions>>;  // 子模块差异
  isGlobalVisible: boolean;
}

// 解析子模块的实际权限（合并模块级 + 子模块覆盖）
export function resolveSubModulePermission(
  permissions: RolePermissions,
  moduleKey: string,
  subModuleKey: string
): CrudPermissions {
  if (permissions.isGlobalVisible) return FULL_CRUD;

  const modulePerm = permissions.modulePermissions[moduleKey] || EMPTY_CRUD;
  const override = permissions.subModuleOverrides[subModuleKey];

  if (!override) return modulePerm;

  return {
    create: override.create ?? modulePerm.create,
    read: override.read ?? modulePerm.read,
    update: override.update ?? modulePerm.update,
    delete: override.delete ?? modulePerm.delete,
  };
}

// 检查是否有新增权限（新增 = 可发起审批）
export function canCreate(perm: CrudPermissions): boolean {
  return perm.create;
}

// 检查是否有任意操作权限
export function hasAnyAccess(perm: CrudPermissions): boolean {
  return perm.create || perm.read || perm.update || perm.delete;
}
```

- [ ] **Step 2: 写测试**

`src/lib/__tests__/permissions.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  resolveSubModulePermission,
  EMPTY_CRUD,
  FULL_CRUD,
  READ_ONLY,
  canCreate,
  hasAnyAccess,
  type RolePermissions,
} from "../types/permissions";

describe("resolveSubModulePermission", () => {
  it("全局可见角色返回完整 CRUD", () => {
    const perm: RolePermissions = {
      modulePermissions: {},
      subModuleOverrides: {},
      isGlobalVisible: true,
    };
    const result = resolveSubModulePermission(perm, "business", "business.customers");
    expect(result).toEqual(FULL_CRUD);
  });

  it("子模块没有覆写时继承模块级", () => {
    const perm: RolePermissions = {
      modulePermissions: {
        business: { create: true, read: true, update: false, delete: false },
      },
      subModuleOverrides: {},
      isGlobalVisible: false,
    };
    const result = resolveSubModulePermission(perm, "business", "business.customers");
    expect(result).toEqual({ create: true, read: true, update: false, delete: false });
  });

  it("子模块覆写部分字段时合并", () => {
    const perm: RolePermissions = {
      modulePermissions: {
        business: { create: true, read: true, update: false, delete: false },
      },
      subModuleOverrides: {
        "business.customers": { update: true },
      },
      isGlobalVisible: false,
    };
    const result = resolveSubModulePermission(perm, "business", "business.customers");
    expect(result.read).toBe(true);
    expect(result.update).toBe(true);    // 覆写为 true
    expect(result.delete).toBe(false);   // 未覆写，继承模块级
  });

  it("不存在的模块返回空权限", () => {
    const perm: RolePermissions = {
      modulePermissions: {},
      subModuleOverrides: {},
      isGlobalVisible: false,
    };
    const result = resolveSubModulePermission(perm, "nonexistent", "nonexistent.sub");
    expect(result).toEqual(EMPTY_CRUD);
  });
});

describe("canCreate", () => {
  it("有新增权限返回 true", () => {
    expect(canCreate(FULL_CRUD)).toBe(true);
  });

  it("只读角色无新增权限", () => {
    expect(canCreate(READ_ONLY)).toBe(false);
  });
});

describe("hasAnyAccess", () => {
  it("完整 CRUD 可访问", () => {
    expect(hasAnyAccess(FULL_CRUD)).toBe(true);
  });

  it("空权限不可访问", () => {
    expect(hasAnyAccess(EMPTY_CRUD)).toBe(false);
  });

  it("只读也可访问", () => {
    expect(hasAnyAccess(READ_ONLY)).toBe(true);
  });
});
```

- [ ] **Step 3: 运行测试确认通过**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx vitest run src/lib/__tests__/permissions.test.ts
```
Expected: 所有测试通过

- [ ] **Step 4: 提交**

```bash
git add src/lib/types/permissions.ts src/lib/__tests__/permissions.test.ts
git commit -m "feat: add CRUD permission types and resolution logic"
```

---

## Task 4: 审批引擎 — 移除项目关联逻辑（TDD）

**Files:**
- Modify: `src/lib/approval-engine.ts`
- Test: `src/lib/__tests__/approval-engine.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lib/__tests__/approval-engine.test.ts`：

```typescript
import { describe, it, expect, vi } from "vitest";
import { resolveApproverIds, shouldSkipNode } from "../approval-engine";

// 模拟 Prisma
vi.mock("../prisma", () => ({
  default: {
    role: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "../prisma";

describe("resolveApproverIds（移除项目关联后）", () => {
  it("根据 roleCode 查找全局用户", async () => {
    (prisma.role.findUnique as any).mockResolvedValue({
      code: "dept_head",
      isProjectRole: false,
      users: [
        { user: { id: "user1" } },
        { user: { id: "user2" } },
      ],
    });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "admin-id" });

    const ids = await resolveApproverIds("dept_head");
    expect(ids).toEqual(["user1", "user2"]);
    // 不应调用任何项目相关查询
    expect(prisma.project?.findUnique).toBeUndefined();
  });

  it("不存在 role 时返回空数组", async () => {
    (prisma.role.findUnique as any).mockResolvedValue(null);

    const ids = await resolveApproverIds("nonexistent");
    expect(ids).toEqual([]);
  });
});

describe("shouldSkipNode（移除项目关联后）", () => {
  it("不传入 projectSourceId 时返回 false", async () => {
    const result = await shouldSkipNode("dept_head", "user1");
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx vitest run src/lib/__tests__/approval-engine.test.ts
```
Expected: 测试因 prisma mock 或导出问题失败

- [ ] **Step 3: 修改审批引擎 — 移除项目关联代码**

在 `src/lib/approval-engine.ts` 中：

```typescript
// 1. 删除 resolveProjectManager() 函数
// 2. 删除 resolveDesignManager() 函数  
// 3. 简化 resolveSingleRoleApproverIds()，移除 isProjectRole 分支
// 4. 简化 shouldSkipNode()，不接受 projectSourceId，统一返回 false

// 保留函数签名兼容性
export async function shouldSkipNode(
  roleCode: string,
  userId: string,
  projectSourceId?: string
): Promise<boolean> {
  return false;  // 项目关联已移除，不再自动跳过
}
```

具体修改 `resolveSingleRoleApproverIds`（移除 `isProjectRole` 判断分支）：

```typescript
async function resolveSingleRoleApproverIds(
  roleCode: string,
  projectSourceId?: string
): Promise<string[]> {
  const role = await prisma.role.findUnique({
    where: { code: roleCode },
    include: {
      users: {
        where: { user: { isActive: true } },
        include: { user: { select: { id: true } } },
      },
    },
  });

  if (!role || role.users.length === 0) {
    return [];
  }

  // 不再走 isProjectRole 分支
  const userIds = role.users.map((ur) => ur.user.id);

  // 过滤 admin
  const adminUser = await prisma.user.findUnique({
    where: { username: "admin" },
    select: { id: true },
  });
  if (adminUser) {
    return userIds.filter((id) => id !== adminUser.id);
  }

  return userIds;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx vitest run src/lib/__tests__/approval-engine.test.ts
```
Expected: 测试通过

- [ ] **Step 5: 运行现有 e2e 确认没破坏**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx playwright test e2e/approval-flow.spec.ts --reporter=list 2>&1 | tail -30
```
Expected: 测试通过

- [ ] **Step 6: 提交**

```bash
git add src/lib/approval-engine.ts src/lib/__tests__/approval-engine.test.ts
git commit -m "refactor: remove project role resolution logic from approval engine"
```

---

## Task 5: 审批引擎 — 发起人自动跳过（TDD）

**Files:**
- Modify: `src/lib/approval-engine.ts`
- Modify: `src/lib/__tests__/approval-engine.test.ts`

- [ ] **Step 1: 写测试**

在 `src/lib/__tests__/approval-engine.test.ts` 中增加：

```typescript
import { startApprovalFlow } from "../approval-engine";

describe("startApprovalFlow — 发起人自动跳过", () => {
  it("发起人属于某节点审批角色时自动跳过该节点", async () => {
    // 模拟审批流配置：节点1(dept_head) → 节点2(finance)
    // 发起人 userId=u1 是 dept_head 角色
    // 期望：节点1被自动跳过，从节点2开始

    (prisma.approvalFlowDefinition.findMany as any).mockResolvedValue([
      { id: "n1", businessType: "test", flowLevel: "common", nodeOrder: 1, nodeName: "部门审批", approverRole: "dept_head", nodeType: "approval", isActive: true },
      { id: "n2", businessType: "test", flowLevel: "common", nodeOrder: 2, nodeName: "财务审批", approverRole: "finance", nodeType: "approval", isActive: true },
    ]);

    (prisma.userRole.findMany as any).mockResolvedValue([
      { role: { code: "dept_head" } },
    ]);

    (prisma.role.findUnique as any).mockResolvedValue({
      code: "dept_head",
      isProjectRole: false,
      users: [{ user: { id: "u1" } }],
    });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "admin-id" });

    // Mock create 等
    (prisma.approvalInstance.create as any).mockResolvedValue({ id: "inst-1", currentNode: 2, status: "审批中" });
    (prisma.approvalAction.create as any).mockResolvedValue({});

    const result = await startApprovalFlow({
      businessType: "test",
      flowLevel: "common",
      businessId: "biz-1",
      userId: "u1",
    });

    // 应该从节点2开始，节点1被跳过
    expect(result.currentNode).toBe(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx vitest run src/lib/__tests__/approval-engine.test.ts -t "发起人自动跳过"
```
Expected: 测试失败（新功能未实现）

- [ ] **Step 3: 实现自动跳过逻辑**

在 `startApprovalFlow` 函数中增加跳过逻辑（约改动 20 行）：

```typescript
export async function startApprovalFlow(params: {
  businessType: string;
  flowLevel: string;
  businessId: string;
  userId: string;
  projectSourceId?: string;
}): Promise<{
  instanceId: string;
  currentNode: number;
  status: string;
  approverIds: string[];
}> {
  const { businessType, flowLevel, businessId, userId, projectSourceId } = params;

  // 获取当前用户的角色 codes
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true } } },
  });
  const userRoleCodes = userRoles.map((ur) => ur.role.code);

  // 获取审批流所有节点
  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });

  if (flowNodes.length === 0) {
    throw new Error("未配置审批流");
  }

  // 跳过发起人自身角色的节点（archive/payment 类型不跳过）
  let startNodeOrder = 1;
  for (const node of flowNodes) {
    if (node.nodeType === "archive" || node.nodeType === "payment") {
      break;  // 遇到终节点停止跳过
    }
    const nodeRoles = node.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
    const isSelf = nodeRoles.some((r) => userRoleCodes.includes(r));
    if (isSelf) {
      // 记录 auto_skip 动作
      startNodeOrder = node.nodeOrder + 1;
    } else {
      break;  // 遇到不是自己的节点停止跳过
    }
  }

  // 确保不超出节点范围
  if (startNodeOrder > flowNodes.length) {
    startNodeOrder = flowNodes.length;
  }

  const startNode = flowNodes.find((n) => n.nodeOrder === startNodeOrder);
  if (!startNode) {
    // 所有人都跳过？取最后节点
    startNodeOrder = flowNodes.length;
  }

  // 原有创建审批实例逻辑...
  const approverIds = await resolveApproverIds(startNode!.approverRole, projectSourceId);
  const instance = await prisma.approvalInstance.create({
    data: {
      businessType,
      businessId,
      flowLevel,
      currentNode: startNodeOrder,
      status: "审批中",
    },
  });

  return {
    instanceId: instance.id,
    currentNode: startNodeOrder,
    status: "审批中",
    approverIds,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx vitest run src/lib/__tests__/approval-engine.test.ts
```
Expected: 所有测试通过

- [ ] **Step 5: 提交**

```bash
git add src/lib/approval-engine.ts src/lib/__tests__/approval-engine.test.ts
git commit -m "feat: auto-skip approval nodes where initiator is the approver"
```

---

## Task 6: 角色 API 适配新权限模型

**Files:**
- Modify: `src/app/api/roles/route.ts`
- Modify: `src/app/api/roles/[id]/route.ts`

**背景**：API 路由需要适配新的 `modulePermissions` + `subModuleOverrides` 字段，同时保持向后兼容。

- [ ] **Step 1: 修改角色创建/更新 API**

在 `src/app/api/roles/route.ts` 中：

```typescript
// POST 处理 body 时接受新字段
const body = await req.json();
// 修改：接收 modulePermissions 和 subModuleOverrides 替代 accessibleModules
const data: any = {
  name: body.name,
  description: body.description || null,
  departmentId: body.departmentId || null,
  // isProjectRole 已移除
  modulePermissions: JSON.stringify(body.modulePermissions || {}),
  subModuleOverrides: JSON.stringify(body.subModuleOverrides || {}),
  isGlobalVisible: body.isGlobalVisible || false,
  level: body.level || 0,
};

// GET 返回时，解析 JSON 字符串
// 在 return data 前增加：
if (typeof role.modulePermissions === "string") {
  role.modulePermissions = JSON.parse(role.modulePermissions);
}
if (typeof role.subModuleOverrides === "string") {
  role.subModuleOverrides = JSON.parse(role.subModuleOverrides);
}
```

同样修改 `src/app/api/roles/[id]/route.ts` 中的 PUT 处理逻辑。

- [ ] **Step 2: 验证 API 能正常返回**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
curl -s http://localhost:3000/api/roles | head -50
```
Expected: 返回数据包含 `modulePermissions` 和 `subModuleOverrides` 字段

- [ ] **Step 3: 提交**

```bash
git add src/app/api/roles/route.ts src/app/api/roles/[id]/route.ts
git commit -m "feat: adapt role APIs for new CRUD permission fields"
```

---

## Task 7: 角色设置 UI — 卡片列表页

**Files:**
- Modify: `src/app/(dashboard)/settings/roles/page.tsx`

**背景**：从表格改为卡片布局，移除项目关联标签

- [ ] **Step 1: 重写角色列表部分为卡片布局

```tsx
// 在 roles/page.tsx 中，将 table 部分替换为卡片网格

// roles 数据获取逻辑保持不变（fetchRoles, fetchDepartments, 搜索过滤）

// 渲染部分改为：
{filteredRoles.map((role) => (
  <div
    key={role.id}
    className={`rounded-xl border p-4 ${
      role.code === "admin"
        ? "bg-[#FAFAF9] border-[#E7E5E4]"
        : "bg-white border-[#E7E5E4] hover:shadow-sm transition-shadow"
    }`}
  >
    <div className="flex items-start justify-between mb-2.5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-[#1C1917]/10 flex items-center justify-center text-[15px] font-bold">
          {String(role.level).padStart(2, "0")}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[15px]">{role.name}</span>
            {role.code === "admin" && (
              <span className="text-[10px] bg-[#78716C] text-white rounded px-1.5 py-0.5">系统内定</span>
            )}
          </div>
          {role.departmentName && (
            <span className="text-[12px] text-[#78716C]">{role.departmentName} · 等级 {role.level}</span>
          )}
        </div>
      </div>
      {role.code !== "admin" && (
        <Link
          href={`/settings/roles/${role.id}`}
          className="text-[12px] bg-[#F5F5F4] rounded-lg px-3 py-1.5 hover:bg-[#E7E5E4] transition-colors"
        >
          编辑
        </Link>
      )}
    </div>

    <div className="flex gap-1.5 flex-wrap mb-2">
      {(() => {
        const modules = typeof role.modulePermissions === "string"
          ? JSON.parse(role.modulePermissions || "{}")
          : role.modulePermissions || {};
        const moduleKeys = Object.keys(modules);
        const display = moduleKeys.slice(0, 3);
        const rest = moduleKeys.length - 3;
        return (
          <>
            {display.map((k) => (
              <span key={k} className="text-[11px] bg-[#FAFAF9] rounded px-2 py-0.5 text-[#78716C]">
                {MODULE_MAP[k as ModuleKey] || k}
              </span>
            ))}
            {rest > 0 && (
              <span className="text-[11px] text-[#78716C]">+{rest} 模块</span>
            )}
          </>
        );
      })()}
    </div>

    <div className="flex justify-between text-[12px] text-[#78716C] pt-2.5 border-t border-[#F5F5F4]">
      <span><strong>{role.userCount}</strong> 位用户</span>
      <span>{formatDate(role.updatedAt)}</span>
    </div>
  </div>
))}
```

- [ ] **Step 2: 构建验证**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx next build 2>&1 | tail -20
```
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/app/(dashboard)/settings/roles/page.tsx
git commit -m "feat: redesign role list page with card layout"
```

---

## Task 8: 角色设置 UI — 详情页（分 Tab + CRUD 矩阵）

**Files:**
- Create: `src/app/(dashboard)/settings/roles/[id]/page.tsx`
- Create: `src/components/RolePermissionMatrix.tsx`
- Create: `src/components/RoleBasicInfoForm.tsx`
- Create: `src/components/RoleApprovalRefs.tsx`

- [ ] **Step 1: 创建角色详情页主页面**

`src/app/(dashboard)/settings/roles/[id]/page.tsx`：

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import RoleBasicInfoForm from "@/components/RoleBasicInfoForm";
import RolePermissionMatrix from "@/components/RolePermissionMatrix";
import RoleApprovalRefs from "@/components/RoleApprovalRefs";

type TabKey = "basic" | "permissions" | "refs";

const TABS: { key: TabKey; label: string }[] = [
  { key: "basic", label: "基本信息" },
  { key: "permissions", label: "权限配置" },
  { key: "refs", label: "审批引用" },
];

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/roles/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setRole(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div>加载中...</div>;
  if (!role) return <div>角色不存在</div>;

  const renderTab = () => {
    switch (activeTab) {
      case "basic":
        return <RoleBasicInfoForm role={role} onSaved={(updated) => setRole(updated)} />;
      case "permissions":
        return <RolePermissionMatrix role={role} onSaved={(updated) => setRole(updated)} />;
      case "refs":
        return <RoleApprovalRefs role={role} />;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/settings/roles")} className="p-2 hover:bg-[#F5F5F4] rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1>{role.name}</h1>
            <p>角色详情 · {role.code}</p>
          </div>
        </div>
      </div>

      <div className="bento-card-static">
        <div className="flex border-b border-[#E7E5E4] bg-[#FAFAF9] rounded-t-xl overflow-hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-[14px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white border-b-2 border-[#1C1917] text-[#1C1917]"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 CRUD 权限矩阵组件**

`src/components/RolePermissionMatrix.tsx`：渲染模块→子模块的 CRUD 矩阵表格，支持模块级设置和子模块覆写。

- [ ] **Step 3: 创建基本信息 Tab**

`src/components/RoleBasicInfoForm.tsx`：名称、部门、描述、全局可见、等级

- [ ] **Step 4: 创建审批引用 Tab**

`src/components/RoleApprovalRefs.tsx`：从 `/api/approval-flows` 查询此角色出现在哪些节点中，只读展示

- [ ] **Step 5: 构建验证**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx next build 2>&1 | tail -20
```
Expected: 构建成功

- [ ] **Step 6: 提交**

```bash
git add src/app/(dashboard)/settings/roles/[id]/page.tsx src/components/RolePermissionMatrix.tsx src/components/RoleBasicInfoForm.tsx src/components/RoleApprovalRefs.tsx
git commit -m "feat: add role detail page with tabs and CRUD permission matrix"
```

---

## Task 9: 流程设置 UI 优化

**Files:**
- Modify: `src/app/(dashboard)/settings/approval-flow/page.tsx`

- [ ] **Step 1: 替换业务模块数据源**

将页面顶部硬编码的 `BUSINESS_MODULE_GROUPS` 替换为从 `module-permissions.ts` 导入：

```typescript
import { BUSINESS_MODULE_GROUPS, BUSINESS_MODULES } from "@/lib/module-permissions";
```

删除页面中 `CONTRACT_MODULES`、`FINANCE_MODULES`、`BUSINESS_MODULE_GROUPS`、`BUSINESS_MODULES` 的本地定义。

- [ ] **Step 2: 实现编辑缓存**

```typescript
const [draftCache, setDraftCache] = useState<Record<string, FlowNode[]>>({});

// 切换模块时，保存当前编辑到缓存，从缓存加载目标模块
const handleModuleSelect = (moduleType: string) => {
  // 保存当前编辑内容到缓存
  setDraftCache((prev) => ({ ...prev, [selectedModule]: nodes }));
  // 从缓存加载目标模块
  const cached = draftCache[moduleType];
  if (cached) {
    setNodes(cached.map((n) => ({ ...n })));
  } else {
    setNodes(savedFlows[moduleType]?.map((n) => ({ ...n })) || []);
  }
  setSaveMsg(null);
};
```

- [ ] **Step 3: 保存校验放宽**

```typescript
// 不再校验所有节点必须有审批角色
// 直接提交保存，允许部分配置

const handleSave = async () => {
  // 移除原有的空角色校验
  // const invalid = nodes.find((n) => !n.approverRole);
  // if (invalid) { ... return; }
  
  // 直接保存
  // ...
};
```

- [ ] **Step 4: 左侧列表显示节点数**

在左侧每个模块项右侧显示节点数或空白。

- [ ] **Step 5: 构建验证**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx next build 2>&1 | tail -20
```
Expected: 构建成功

- [ ] **Step 6: 提交**

```bash
git add src/app/(dashboard)/settings/approval-flow/page.tsx
git commit -m "feat: optimize flow settings with edit cache and unified data source"
```

---

## Task 10: 设置导航分组

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: 修改侧边栏设置菜单**

在 `src/components/Sidebar.tsx` 中找到设置菜单列表部分，改为分组结构：

```typescript
{
  label: "系统设置",
  children: [
    {
      label: "用户与权限",
      items: [
        { label: "用户设置", href: "/settings/users" },
        { label: "角色设置", href: "/settings/roles" },
        { label: "部门设置", href: "/settings/departments" },
      ],
    },
    {
      label: "审批配置",
      items: [
        { label: "流程设置", href: "/settings/approval-flow" },
        { label: "审批调试", href: "/settings/approval-debug" },
      ],
    },
    {
      label: "基础数据",
      items: [
        { label: "个人设置", href: "/settings/profile" },
        { label: "往来信息管理", href: "/settings/counterparty" },
      ],
    },
    {
      label: "系统",
      items: [
        { label: "AI 模型配置", href: "/settings/ai-model" },
      ],
    },
  ],
}
```

- [ ] **Step 2: 构建验证**

```bash
cd /Users/zj81920/应用开发/zj-huadong-erp
npx next build 2>&1 | tail -20
```
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add src/components/Sidebar.tsx
git commit -m "refactor: group settings navigation into categories"
```

---

## Task 11: 业务表单草稿 — 审批中心 Tab

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx`
- Modify（可选）: `src/app/api/approval-instances/route.ts`

- [ ] **Step 1: 增加「我的草稿」Tab**

在审批中心页面增加第四个 Tab：

```tsx
const TABS = [
  { key: "pending", label: "待处理" },
  { key: "processed", label: "已处理" },
  { key: "initiated", label: "已发起" },
  { key: "drafts", label: "我的草稿" },
];
```

- [ ] **Step 2: 草稿列表 UI**

当 `activeTab === "drafts"` 时，调用 `/api/drafts`（新 API 或现有实例 API）获取当前用户的草稿列表，展示业务类型标签、标题、保存进度、编辑时间。

- [ ] **Step 3: 提交**

```bash
git add src/app/(dashboard)/approvals/page.tsx
git commit -m "feat: add 'My Drafts' tab to approval center"
```

---

## 回归认证清单

**文件**: `docs/superpowers/checklists/2026-06-03-redesign-regression.md`

### 功能回归检查

| # | 检查项 | 预期 | 结果 |
|---|---|---|---|
| 1 | 角色列表页正常显示所有角色 | 卡片布局，展示名称/部门/等级/权限标签/用户数 | |
| 2 | admin 角色不可编辑 | 灰色背景，无编辑按钮 | |
| 3 | 点击编辑跳转到详情页 | 进入 `/settings/roles/[id]`，显示三个 Tab | |
| 4 | 基本信息 Tab 可编辑并保存 | 修改名称/等级后保存成功 | |
| 5 | 权限配置 Tab 显示 CRUD 矩阵 | 7 个模块+子模块，每行有 CRUD 四个操作 | |
| 6 | 模块级设置影响子模块 | 修改模块级「查看」，子模块自动变化 | |
| 7 | 子模块覆写生效 | 覆写后显示「已覆写」，不继承模块级 | |
| 8 | 审批引用 Tab 显示流程信息 | 显示此角色出现在哪些审批节点中 | |
| 9 | 流程设置页面切换不丢失编辑 | 编辑商务报价→切到供应商审批→切回来，内容还在 | |
| 10 | 流程设置可保存不完整流程 | 只填节点名称不选角色，保存成功 | |
| 11 | 发起审批自动跳过自己 | 自己是某节点审批人时自动跳过 | |
| 12 | 设置导航显示分组 | 侧边栏「系统设置」下有 4 个分组 | |
| 13 | 审批中心显示「我的草稿」Tab | 显示草稿列表，可继续填写 | |

### 构建回归检查

| # | 检查项 | 命令 |
|---|---|---|
| 1 | 构建通过 | `npx next build` |
| 2 | Prisma 验证 | `npx prisma validate` |

---

## 执行方案

**Plan complete and saved to `docs/superpowers/plans/2026-06-03-role-permission-flow-redesign.md`。两种执行方式：**

**1. Subagent-Driven（推荐）** — 我为每个 Task 分派一个独立子代理，任务间有审查点，快速迭代

**2. Inline Execution** — 在当前 session 中按 Task 顺序执行，批量 review

**你选择哪种方式？**
