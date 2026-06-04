# 权限系统一致性重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 统一角色 CRUD 权限的前后端校验，新增模块审批流可配置化

**Architecture:** 新增 `approval_module_config` 表管理模块清单，通过 `hasApprovalFlow()` 判断模块是否走审批流，`canDelete()`/`canEdit()`/`canReadAll()` 统一前后端权限判断逻辑。无流程模块 CRUD 完全由角色权限控制，有流程模块由状态+归属控制。read 权限可控制查看范围（全局 vs 仅自己）。

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, TypeScript

**Design Spec:** `docs/superpowers/specs/2026-06-03-permission-system-redesign.md`

---

## Phase 1: 基础设施（Schema + 配置 + 公共函数）

### Task 1: 新增 approval_module_config 表

**Files:**
- Modify: `prisma/schema.prisma`

- [x] **Step 1: 在 schema.prisma 末尾添加新模型**

在 `prisma/schema.prisma` 文件末尾（最后一个 model 之后）添加：

```prisma
model ApprovalModuleConfig {
  id         String   @id @default(cuid())
  moduleKey  String   @unique @map("module_key")
  moduleName String   @map("module_name")
  groupName  String   @map("group_name")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@map("approval_module_config")
}
```

- [x] **Step 2: 验证 Schema 并同步数据库**

```bash
npx prisma validate
npx prisma db push
```

Expected: Schema 验证通过，数据库同步成功。

- [x] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: add approval_module_config table"
```

---

### Task 2: 新建模块配置文件

**Files:**
- Create: `src/lib/module-config.ts`

- [x] **Step 1: 创建配置文件**

合并现有 `module-permissions.ts` 中的 `BUSINESS_MODULES`、`BUSINESS_MODULE_GROUPS` 和 `business-types/route.ts` 中的 `businessTypes`，创建统一配置源：

```typescript
/**
 * 业务模块配置 — 集中定义所有业务模块
 *
 * 新加模块时只需在此处加一条记录，然后运行 seed 脚本同步到数据库。
 * 审批流程配置页、权限校验等均从数据库读取，无需改其他代码。
 */
export interface ModuleConfigItem {
  key: string    // 模块唯一标识，与 ApprovalFlowDefinition.businessType 对应
  name: string   // 模块显示名称
  group: string  // 所属分组
}

export const MODULE_CONFIG: ModuleConfigItem[] = [
  // === 商务管理 ===
  { key: "customers",               name: "客户管理",       group: "商务管理" },
  { key: "supplier",                name: "供应商审批",     group: "商务管理" },
  { key: "project_leads",           name: "市场开发",       group: "商务管理" },
  { key: "biddings",                name: "投标统计",       group: "商务管理" },
  { key: "quotation",               name: "商务报价",       group: "商务管理" },

  // === 项目管理 ===
  { key: "projects_list",           name: "项目立项",       group: "项目管理" },
  { key: "projects_plans",          name: "项目计划",       group: "项目管理" },
  { key: "projects_progress",       name: "项目进度",       group: "项目管理" },
  { key: "outsourcing",             name: "设计外包",       group: "项目管理" },

  // === 项目采购 ===
  { key: "purchase_request",        name: "采购需求",       group: "项目采购" },
  { key: "inquiries",               name: "采购单",         group: "项目采购" },
  { key: "delivery_receipt",        name: "到货验收",       group: "项目采购" },

  // === 合同管理 ===
  { key: "income_contract",         name: "收入合同",       group: "合同管理" },
  { key: "expense_contract",        name: "支出合同",       group: "合同管理" },

  // === 财务管理 · 收入 ===
  { key: "non_contract_income",     name: "非合同收入",     group: "财务管理" },
  { key: "other_borrowing",         name: "其他借入款",     group: "财务管理" },

  // === 财务管理 · 支出 ===
  { key: "non_contract_expense",    name: "其他支付",       group: "财务管理" },
  { key: "payment_application",     name: "合同支付",       group: "财务管理" },
  { key: "lending_out",             name: "借出款",         group: "财务管理" },
  { key: "expense_report",          name: "费用报销",       group: "财务管理" },
  { key: "salary_payment",          name: "工资发放",       group: "财务管理" },
  { key: "borrowing_return_application", name: "借入资金归还", group: "财务管理" },

  // === 人事行政 ===
  { key: "hr_employees",            name: "员工档案",       group: "人事行政" },
  { key: "office_supplies",         name: "办公用品",       group: "人事行政" },
  { key: "certificates",            name: "证照管理",       group: "人事行政" },
  { key: "seals",                   name: "印章管理",       group: "人事行政" },
]
```

- [x] **Step 2: 提交**

```bash
git add src/lib/module-config.ts
git commit -m "feat: add centralized module config"
```

---

### Task 3: 更新 Seed 脚本

**Files:**
- Modify: `prisma/seed.ts`

- [x] **Step 1: 在 seed.ts 中添加模块同步逻辑**

在 `main()` 函数中，现有管理员 upsert 逻辑之后添加：

```typescript
// 同步模块清单到 approval_module_config 表
console.log("📋 同步模块清单...");
const { MODULE_CONFIG } = await import("../src/lib/module-config");
for (const config of MODULE_CONFIG) {
  await prisma.approvalModuleConfig.upsert({
    where: { moduleKey: config.key },
    update: { moduleName: config.name, groupName: config.group, isActive: true },
    create: { moduleKey: config.key, moduleName: config.name, groupName: config.group },
  });
}
// 软删除配置中已移除的模块
await prisma.approvalModuleConfig.updateMany({
  where: { moduleKey: { notIn: MODULE_CONFIG.map((m) => m.key) } },
  data: { isActive: false },
});
console.log(`✅ 已同步 ${MODULE_CONFIG.length} 个模块`);
```

- [x] **Step 2: 运行 seed 脚本**

```bash
npx tsx prisma/seed.ts
```

Expected: 输出"已同步 XX 个模块"。

- [x] **Step 3: 提交**

```bash
git add prisma/seed.ts
git commit -m "feat: sync module config in seed script"
```

---

### Task 4: 新增公共权限校验函数

**Files:**
- Modify: `src/lib/types/permissions.ts`

- [x] **Step 1: 在 permissions.ts 末尾新增函数**

在文件末尾添加以下函数（需要 import prisma）：

```typescript
import prisma from "@/lib/prisma"

/**
 * 判断某个模块是否配置了审批流
 * 有审批节点 → 有流程；无节点 → 无流程
 */
export async function hasApprovalFlow(moduleKey: string): Promise<boolean> {
  const count = await prisma.approvalFlowDefinition.count({
    where: { businessType: moduleKey, isActive: true },
  })
  return count > 0
}

/**
 * 判断用户能否删除某条业务记录
 * - 无流程模块：角色 delete 权限 + 仅限自己创建
 * - 有流程模块：草稿/已驳回 + 仅限自己创建
 */
export async function canDelete(
  rolePerms: CrudPermissions,
  moduleKey: string,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null
): Promise<boolean> {
  const isOwner = currentUserId === recordCreatorId
  if (!isOwner) return false

  if (await hasApprovalFlow(moduleKey)) {
    return recordStatus === "草稿" || recordStatus === "已驳回"
  }

  return rolePerms.delete === true
}

/**
 * 判断用户能否编辑某条业务记录
 * - 无流程模块：角色 update 权限 + 仅限自己创建
 * - 有流程模块：草稿/已驳回 + 仅限自己创建
 */
export async function canEdit(
  rolePerms: CrudPermissions,
  moduleKey: string,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null
): Promise<boolean> {
  const isOwner = currentUserId === recordCreatorId
  if (!isOwner) return false

  if (await hasApprovalFlow(moduleKey)) {
    return recordStatus === "草稿" || recordStatus === "已驳回"
  }

  return rolePerms.update === true
}
```

- [x] **Step 2: 提交**

```bash
git add src/lib/types/permissions.ts
git commit -m "feat: add hasApprovalFlow, canDelete, canEdit functions"
```

---

### Task 5: 新增模块配置 API

**Files:**
- Create: `src/app/api/approval-module-config/route.ts`

- [x] **Step 1: 创建 API 路由**

```typescript
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const modules = await prisma.approvalModuleConfig.findMany({
      where: { isActive: true },
      orderBy: [{ groupName: "asc" }, { moduleName: "asc" }],
    })

    // 动态计算每个模块是否有审批流
    const data = await Promise.all(
      modules.map(async (m) => {
        const flowCount = await prisma.approvalFlowDefinition.count({
          where: { businessType: m.moduleKey, isActive: true },
        })
        return {
          moduleKey: m.moduleKey,
          moduleName: m.moduleName,
          groupName: m.groupName,
          hasFlow: flowCount > 0,
        }
      })
    )

    return NextResponse.json({ data })
  } catch (error) {
    console.error("获取模块配置失败:", error)
    return NextResponse.json({ error: "获取模块配置失败" }, { status: 500 })
  }
}
```

- [x] **Step 2: 测试 API**

```bash
npm run dev &
sleep 5
curl -s -b "erp_session=$(echo '{"userId":"<admin_user_id>"}' | base64)" http://localhost:3000/api/approval-module-config | head -100
```

Expected: 返回 JSON 数组，每个元素包含 `moduleKey`、`moduleName`、`groupName`、`hasFlow`。

- [x] **Step 3: 提交**

```bash
git add src/app/api/approval-module-config/route.ts
git commit -m "feat: add approval-module-config API"
```

---

### Task 6: 构建 + 回归验证

- [x] **Step 1: 运行回归验证**

```bash
bash scripts/verify.sh
```

Expected: 全部通过。

- [x] **Step 2: 提交 Phase 1 完成状态**

---

## Phase 2: 审批流程页面改造

### Task 7: 改造审批流程配置页——模块列表从 API 读取

**Files:**
- Modify: `src/app/(dashboard)/settings/approval-flow/page.tsx`

- [x] **Step 1: 修改页面，用 API 替代硬编码的 BUSINESS_MODULE_GROUPS**

关键变更：
1. 新增 `useEffect` 调用 `GET /api/approval-module-config` 获取模块列表
2. 将模块列表按 `groupName` 分组，替代 `BUSINESS_MODULE_GROUPS`
3. 删除对 `BUSINESS_MODULE_GROUPS` 和 `BUSINESS_MODULES` 的 import（保留其他 import）
4. 左侧列表增加「已配置流程」/「未配置流程」的视觉标识（如小圆点）

左侧模块列表改为：

```tsx
// state
const [moduleGroups, setModuleGroups] = useState<Record<string, { key: string; name: string; hasFlow: boolean }[]>>({});

// useEffect 加载
useEffect(() => {
  fetch("/api/approval-module-config")
    .then(r => r.json())
    .then(json => {
      const grouped: Record<string, { key: string; name: string; hasFlow: boolean }[]> = {};
      for (const m of json.data || []) {
        if (!grouped[m.groupName]) grouped[m.groupName] = [];
        grouped[m.groupName].push(m);
      }
      setModuleGroups(grouped);
      if (json.data?.length > 0) setSelectedModule(json.data[0].moduleKey);
    })
    .catch(() => {});
}, []);
```

左侧列表渲染改为遍历 `moduleGroups`。

- [x] **Step 2: 验证页面渲染**

启动 dev server，访问 `/settings/approval-flow`，确认左侧模块列表正常显示。

- [x] **Step 3: 提交**

```bash
git add src/app/(dashboard)/settings/approval-flow/page.tsx
git commit -m "feat: approval flow page reads modules from API"
```

---

### Task 8: 改造 business-types API

**Files:**
- Modify: `src/app/api/approval-flows/business-types/route.ts`

- [x] **Step 1: GET 改为从数据库读取模块列表和角色列表**

```typescript
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getCurrentUser, isAdmin } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "未授权" }, { status: 403 })
    }

    // 从数据库读取模块清单
    const modules = await prisma.approvalModuleConfig.findMany({
      where: { isActive: true },
      orderBy: [{ groupName: "asc" }, { moduleName: "asc" }],
    })
    const businessTypes = modules.map(m => ({ key: m.moduleKey, label: m.moduleName }))

    // 从数据库读取角色列表（已有审批流配置中用到的角色 code）
    const roleCodes = await prisma.approvalFlowDefinition.findMany({
      where: { isActive: true },
      select: { approverRole: true },
      distinct: ["approverRole"],
    })
    const allRoleCodes = [...new Set(roleCodes.flatMap(r => r.approverRole.split(",").map(s => s.trim())).filter(Boolean))]

    // 从 Role 表读取角色名
    const roles = await prisma.role.findMany({ where: { isActive: true }, select: { code: true, name: true } })
    const approverRoles = [
      { key: "initiator", label: "经办人" },
      ...roles.map(r => ({ key: r.code, label: r.name })),
    ]

    return NextResponse.json({ data: { businessTypes, approverRoles } })
  } catch (error) {
    console.error("获取业务类型失败:", error)
    return NextResponse.json({ error: "获取业务类型失败" }, { status: 500 })
  }
}
```

注意：POST 方法（批量初始化默认审批流）保持不变。

- [x] **Step 2: 提交**

```bash
git add src/app/api/approval-flows/business-types/route.ts
git commit -m "feat: business-types API reads from database"
```

---

## Phase 3: 后端 API 权限校验改造

### Task 9: 创建权限校验辅助函数

**Files:**
- Create: `src/lib/permission-check.ts`

由于 `canDelete()`/`canEdit()` 需要 `resolveSubModulePermission()` + 用户角色 + 记录创建人，创建一个辅助函数封装整个流程：

```typescript
import { getCurrentUser } from "@/lib/auth"
import { resolveSubModulePermission, canDelete, canEdit, type CrudPermissions } from "@/lib/types/permissions"
import prisma from "@/lib/prisma"

/**
 * 判断用户能否查看全局记录
 * true = 能看到所有人的记录；false = 只能看到自己创建的
 */
export async function canReadAll(rolePerms: CrudPermissions, moduleKey: string): Promise<boolean> {
  if (rolePerms.read) return true
  // read:false 时，只能查看自己的记录
  return false
}

/**
 * 解析当前用户对指定模块的 CRUD 权限
 */
export async function resolveCurrentUserPermission(
  moduleKey: string,
  subModuleKey?: string
): Promise<{ userId: string; perms: CrudPermissions } | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // admin 不受权限限制
  if (user.username === "admin") {
    return { userId: user.id, perms: { create: true, read: true, update: true, delete: true } }
  }

  // 合并所有角色的权限
  const rolePerms = {
    modulePermissions: user.roles.reduce((acc, r) => {
      try {
        const parsed = typeof r.modulePermissions === "string"
          ? JSON.parse(r.modulePermissions)
          : r.modulePermissions
        return { ...acc, ...parsed }
      } catch { return acc }
    }, {} as Record<string, CrudPermissions>),
    subModuleOverrides: {} as Record<string, Partial<CrudPermissions>>,
    isGlobalVisible: user.roles.some(r => r.isGlobalVisible),
  }

  const perms = subModuleKey
    ? resolveSubModulePermission(rolePerms, moduleKey, subModuleKey)
    : (rolePerms.modulePermissions[moduleKey] || { create: false, read: false, update: false, delete: false })

  return { userId: user.id, perms }
}
```

- [x] **Step 1: 创建文件**

将上面的代码写入 `src/lib/permission-check.ts`。

- [x] **Step 2: 提交**

```bash
git add src/lib/permission-check.ts
git commit -m "feat: add permission check helper"
```

---

### Task 10-22: 改造各业务模块的 DELETE/PUT 路由

以下每个 Task 改造一个业务模块的 `[id]/route.ts`，模式相同：

1. 在 DELETE handler 中加入 `canDelete()` 校验
2. 在 PUT handler 中加入 `canEdit()` 校验
3. 需要确认记录是否有 `lastModifiedBy` 或类似的创建人字段（如果没有，需查第一条 ApprovalAction 中 action="initiate" 的 approverId）

**注意：** 当前大部分业务模型没有 `createdById` 字段。需要根据实际情况处理：
- 如果模型有 `lastModifiedBy`，且创建时设为创建人 ID，则用它
- 否则查 `ApprovalAction` 表的 initiate 记录获取创建人
- 对于无流程模块，需要在模型中新增 `createdById` 字段

**由于涉及大量模型字段新增和 API 改造，建议分批执行：**

#### 第一批：有审批流的模块（状态驱动，优先级高）

| Task | API 路由 | moduleKey | 状态字段 |
|------|----------|-----------|----------|
| 10 | `expense-contracts/[id]` | `expense_contract` | `status` |
| 11 | `income-contracts/[id]` | `income_contract` | `status` |
| 12 | `non-contract-expenses/[id]` | `non_contract_expense` | `status` |
| 13 | `payment-applications/[id]` | `payment_application` | `status` |
| 14 | `lending-outs/[id]` | `lending_out` | `status` |
| 15 | `expense-reports/[id]` | `expense_report` | `status` |
| 16 | `salary-payments/[id]` | `salary_payment` | `status` |
| 17 | `borrowing-return-applications/[id]` | `borrowing_return_application` | `status` |
| 18 | `inquiries/[id]` | `inquiries` | `inquiryStatus` |
| 19 | `purchase-requests/[id]` | `purchase_request` | `status` |
| 20 | `projects/outsourcing/[id]` | `outsourcing` | `approvalStatus` |
| 21 | `suppliers/[id]` | `supplier` | `approvalStatus` |
| 22 | `other-borrowings/[id]` | `other_borrowing` | `status` |

#### 第二批：无审批流的模块（角色权限驱动）

| Task | API 路由 | moduleKey |
|------|----------|-----------|
| 23 | `customers/[id]` | `customers` |
| 24 | `hr/employees/[id]` | `hr_employees` |
| 25 | `certificates/[id]` | `certificates` |
| 26 | `seals/[id]` | `seals` |
| 27 | `office-supplies/[id]` | `office_supplies` |
| 28 | `projects/[id]` | `projects_list` |

**每个 Task 的改造模板（以 Task 10 为例）：**

**Files:**
- Modify: `src/app/api/expense-contracts/[id]/route.ts`

- [x] **Step 1: 在 DELETE handler 中添加权限校验**

在现有状态检查之前，添加：

```typescript
import { resolveCurrentUserPermission, canDelete, canEdit } from "@/lib/permission-check"

// DELETE handler 中，找到记录之后：
const permResult = await resolveCurrentUserPermission("contracts", "contracts.expense")
if (!permResult) return NextResponse.json({ error: "未登录" }, { status: 401 })

// 获取创建人（从 ApprovalAction 查 initiate 记录）
const initiateAction = await prisma.approvalAction.findFirst({
  where: { instance: { businessId: id }, action: "initiate" },
  select: { approverId: true },
})

if (!await canDelete(permResult.perms, "expense_contract", existing.status, permResult.userId, initiateAction?.approverId || null)) {
  return NextResponse.json({ error: "无权删除该记录" }, { status: 403 })
}
```

- [x] **Step 2: 在 PUT handler 中添加权限校验**

类似逻辑，使用 `canEdit()` 替代 `canDelete()`。

- [x] **Step 3: 验证**

手动测试或运行回归脚本。

- [x] **Step 4: 提交**

---

## Phase 4: 前端页面改造

### Task 29: 用户会话中预加载 hasFlow 信息

**Files:**
- Modify: `src/lib/auth.ts` — `CurrentUser` 接口新增 `moduleFlowStatus` 字段
- Modify: `src/lib/auth.ts` — `getCurrentUser()` 中查询并附加 hasFlow 信息

- [x] **Step 1: CurrentUser 接口新增字段**

```typescript
export interface CurrentUser {
  // ... 现有字段
  moduleFlowStatus: Record<string, boolean>  // moduleKey → hasFlow
}
```

- [x] **Step 2: getCurrentUser 中查询 hasFlow**

在返回之前，查询所有模块的 hasFlow 状态：

```typescript
// 查询所有活跃的审批流定义
const flowDefs = await prisma.approvalFlowDefinition.findMany({
  where: { isActive: true },
  select: { businessType: true },
  distinct: ["businessType"],
})
const moduleFlowStatus: Record<string, boolean> = {}
for (const fd of flowDefs) {
  moduleFlowStatus[fd.businessType] = true
}

return {
  // ... 现有字段
  moduleFlowStatus,
}
```

- [x] **Step 3: 提交**

```bash
git add src/lib/auth.ts
git commit -m "feat: preload moduleFlowStatus in user session"
```

---

### Task 30-41: 改造各业务列表页的删除/编辑按钮

每个页面的改造模式相同：

1. 从 session 读取 `moduleFlowStatus` 和角色权限
2. 用 `canDelete()` / `canEdit()` 的**同步版本**判断按钮是否显示
3. 替换当前硬编码的状态判断逻辑

**前端同步版本的 canDelete/canEdit/canReadAll（不查数据库）：**

由于 hasFlow 已在登录时预加载，前端可以直接写同步判断：

```typescript
// 前端用的同步判断函数

// 判断能否查看全局记录
function canReadAllFrontend(hasFlow: boolean, rolePerms: CrudPermissions): boolean {
  if (rolePerms.read) return true  // 读权限决定能否看全局
  return false                      // read:false → 只能看自己的
}

function canDeleteFrontend(
  hasFlow: boolean,
  rolePerms: CrudPermissions,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null
): boolean {
  const isOwner = currentUserId === recordCreatorId
  if (!isOwner) return false
  if (hasFlow) return recordStatus === "草稿" || recordStatus === "已驳回"
  return rolePerms.delete === true
}

function canEditFrontend(
  hasFlow: boolean,
  rolePerms: CrudPermissions,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null
): boolean {
  const isOwner = currentUserId === recordCreatorId
  if (!isOwner) return false
  if (hasFlow) return recordStatus === "草稿" || recordStatus === "已驳回"
  return rolePerms.update === true
}
```

建议将这两个函数放在 `src/lib/types/permissions.ts` 中导出。

**涉及的页面列表（与后端 Task 对应）：**

| Task | 页面 | moduleKey |
|------|------|-----------|
| 30 | `contracts/expense/page.tsx` | `expense_contract` |
| 31 | `contracts/income/page.tsx` | `income_contract` |
| 32 | `finance/expense/page.tsx` | 各子模块 |
| 33 | `finance/income/page.tsx` | 各子模块 |
| 34 | `procurement/requests/page.tsx` | `purchase_request` |
| 35 | `procurement/inquiries/page.tsx` | `inquiries` |
| 36 | `projects/outsourcing/page.tsx` | `outsourcing` |
| 37 | `business/suppliers/page.tsx` | `supplier` |
| 38 | `business/customers/page.tsx` | `customers` |
| 39 | `hr/employees/page.tsx` | `hr_employees` |
| 40 | `contracts/non-contract/page.tsx` | `non_contract_expense` |
| 41 | `business/project-leads/page.tsx` | `project_leads` |

**每个 Task 的改造模式（以 Task 30 为例）：**

**Files:**
- Modify: `src/app/(dashboard)/contracts/expense/page.tsx`

- [x] **Step 1: 导入前端判断函数**

```typescript
import { canDeleteFrontend, canEditFrontend, type CrudPermissions } from "@/lib/types/permissions"
```

- [x] **Step 2: 获取当前用户信息**

从 session context 或 API 获取当前用户 ID、角色权限、moduleFlowStatus。

- [x] **Step 3: 替换删除按钮的判断逻辑**

将现有的：
```typescript
if (deleteConfirm.status !== "草稿" && deleteConfirm.status !== "已驳回" && !isAdminUser) {
```

替换为：
```typescript
const hasFlow = user.moduleFlowStatus["expense_contract"] ?? true
if (!canDeleteFrontend(hasFlow, rolePerms, deleteConfirm.status, user.id, deleteConfirm.createdBy)) {
```

- [x] **Step 4: 替换编辑按钮的判断逻辑**

类似替换。

- [x] **Step 5: 验证**

手动在浏览器中测试各状态下的按钮显示。

- [x] **Step 6: 提交**

---

## Phase 5: 最终验证

### Task 42: 构建验证 + 回归测试

- [x] **Step 1: 运行完整回归脚本**

```bash
bash scripts/verify.sh
```

Expected: 全部通过。

- [x] **Step 2: 手动功能测试**

1. 用管理员账号登录
2. 进入角色设置，新增一个测试角色，仅勾选「财务管理」的 create 和 read 权限（update/delete 不勾选）
3. 创建一个测试用户并分配该角色
4. 用测试用户登录，验证：
   - 能创建费用报销草稿 ✓
   - 能看到别人的费用报销 ✓
   - **不能编辑**别人的费用报销 ✓
   - 草稿状态下**能编辑/删除**自己的 ✓
   - 提交审批后**不能编辑/删除** ✓
5. 用管理员驳回该审批
6. 验证已驳回状态下**能编辑/删除**自己的 ✓

---

## 注意事项

1. **createdById 字段缺失**：当前大部分业务模型没有记录创建人的字段。有流程模块可以从 `ApprovalAction` 的 `initiate` 记录反查，但无流程模块无法获取创建人。Phase 3 的第二批任务可能需要给相关模型新增 `createdById` 字段。
2. **admin 免检**：所有权限校验函数中，admin 用户始终返回 `true`，不受限制。
3. **性能考虑**：`hasApprovalFlow()` 每次查数据库，高频场景可考虑缓存（但审批流配置变更频率极低，当前方案足够）。
