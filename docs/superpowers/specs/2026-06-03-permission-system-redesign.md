# 权限系统一致性重构设计

## 1. 背景与问题

当前系统的角色 CRUD 权限存在三个问题：

1. **角色权限的 delete/update 后端从未校验**——即使设为 `false`，API 仍然允许操作
2. **前后端规则不一致**——前端显示"已驳回可删"，后端 API 却拒绝删除
3. **模块是否走审批流硬编码在代码中**——新模块需改代码才能加入流程配置

## 2. 整体设计

### 2.1 核心原则

- **所有操作均限"自己创建"的记录**——无流程和有流程模块都遵循
- **无流程模块**：CRUD 权限完全由角色权限控制
- **有流程模块**：create 控制能否发起；update/delete 由业务状态决定（草稿/已驳回可操作），不依赖角色权限
- **read 权限控制查看范围**：`read: true` 可查看全局记录；`read: false` 仅能看到自己创建的记录

### 2.2 权限作用域矩阵

| 权限 | 无流程模块 | 有流程模块 |
|------|-----------|-----------|
| **create** | 自己新建 | 自己新建（发起流程） |
| **read: true** | 全局可见 | 全局可见 |
| **read: false** | 仅见自己创建的 | 仅见自己创建的 |
| **update** | `update=true` + 仅自己 → 可编辑 | 草稿/已驳回 + 仅自己 → 可编辑 |
| **delete** | `delete=true` + 仅自己 → 可删除 | 草稿/已驳回 + 仅自己 → 可删除 |

## 3. Prisma Schema

新增 `approval_module_config` 表——模块清单配置表。

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

说明：
- 不设 `hasFlow` 字段——有无流程由 `ApprovalFlowDefinition` 表中是否存在节点决定
- `isActive` 用于软删除，新模块默认 `isActive=true`
- `groupName` 用于审批流程页面的左侧分组展示

## 4. 配置文件

新增 `src/lib/module-config.ts`——集中定义所有业务模块，作为唯一来源。

```typescript
// 新加模块时，只需在此处加一条记录
// 运行 seed 后自动同步到 approval_module_config 表
// 开发新功能时参照已有条目添加即可
export const MODULE_CONFIG = [
  // === 商务管理 ===
  { key: "customers",               name: "客户管理",         group: "商务管理" },
  { key: "suppliers",               name: "供应商管理",       group: "商务管理" },
  { key: "project_leads",           name: "市场开发",         group: "商务管理" },
  { key: "biddings",                name: "投标统计",         group: "商务管理" },
  { key: "quotations",              name: "商务报价（审批）", group: "商务管理" },
  // ... 完整列表见下方
]
```

所有定义模块都要包含在这里。现有的 `BUSINESS_MODULES` 和 `BUSINESS_MODULE_GROUPS` 都将废弃，统一从 `approval_module_config` 表读取。

## 5. 公共权限校验函数

在 `src/lib/types/permissions.ts` 中新增：

### 5.1 `hasApprovalFlow()`

```typescript
// 判断某个模块是否有审批流
// 数据库中有节点配置 → 有流程
// 无节点配置 → 无流程
export async function hasApprovalFlow(moduleKey: string): Promise<boolean> {
  const count = await prisma.approvalFlowDefinition.count({
    where: { businessType: moduleKey, isActive: true },
  })
  return count > 0
}
```

### 5.2 `canDelete()`

```typescript
export async function canDelete(
  rolePerms: CrudPermissions,   // 角色对该模块的 delete 权限
  moduleKey: string,             // 模块 key
  recordStatus: string,          // 业务记录当前状态
  currentUserId: string,         // 当前用户 ID
  recordCreatorId: string        // 业务记录的创建人 ID
): Promise<boolean> {
  const isOwner = currentUserId === recordCreatorId

  if (await hasApprovalFlow(moduleKey)) {
    // 有流程模块：草稿/已驳回 可删，仅限自己的
    return (recordStatus === "草稿" || recordStatus === "已驳回") && isOwner
  }

  // 无流程模块：角色 delete 权限 + 仅限自己
  return rolePerms.delete === true && isOwner
}
```

### 5.3 `canEdit()`

```typescript
export async function canEdit(
  rolePerms: CrudPermissions,   // 角色对该模块的 update 权限
  moduleKey: string,             // 模块 key
  recordStatus: string,          // 业务记录当前状态
  currentUserId: string,         // 当前用户 ID
  recordCreatorId: string        // 业务记录的创建人 ID
): Promise<boolean> {
  const isOwner = currentUserId === recordCreatorId

  if (await hasApprovalFlow(moduleKey)) {
    // 有流程模块：草稿/已驳回 可编辑，仅限自己的
    return (recordStatus === "草稿" || recordStatus === "已驳回") && isOwner
  }

  // 无流程模块：角色 update 权限 + 仅限自己
  return rolePerms.update === true && isOwner
}
```

## 6. 后端 API 改造

### 6.1 新建 API

**`GET /api/approval-module-config`**——返回所有模块清单

```typescript
// 返回 { data: [{ moduleKey, moduleName, groupName, hasFlow }] }
// hasFlow 根据 ApprovalFlowDefinition 是否有节点动态计算
```

### 6.2 修改 API

所有业务模块的 DELETE 和 PUT 路由增加权限校验：

```typescript
// 以 expense-contracts/[id]/route.ts 的 DELETE 为例
import { canDelete } from "@/lib/types/permissions"

export async function DELETE(request, { params }) {
  // ... 现有的查找记录逻辑
  const rolePerms = resolveSubModulePermission(roles, "contracts", "contracts.expense")

  if (!await canDelete(rolePerms, "expense_contract", existing.status, user.id, existing.createdById)) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 })
  }
  // ... 继续删除逻辑
}
```

涉及的 API 路由清单：

| API 路由 | 操作 |
|----------|------|
| `api/expense-contracts/[id]` | DELETE, PUT |
| `api/income-contracts/[id]` | DELETE, PUT |
| `api/non-contract-expenses/[id]` | DELETE, PUT |
| `api/payment-applications/[id]` | DELETE, PUT |
| `api/lending-outs/[id]` | DELETE, PUT |
| `api/expense-reports/[id]` | DELETE, PUT |
| `api/salary-payments/[id]` | DELETE, PUT |
| `api/borrowing-return-applications/[id]` | DELETE, PUT |
| `api/inquiries/[id]` | DELETE, PUT |
| `api/purchase-requests/[id]` | DELETE, PUT |
| `api/projects/outsourcing/[id]` | DELETE, PUT |
| `api/suppliers/[id]` | DELETE, PUT |
| `api/other-borrowings/[id]` | DELETE, PUT |

### 6.3 审批流程页面 API 改造

**`GET /api/approval-flows/business-types`**——修改为从 `approval_module_config` 表读取模块列表

## 7. 前端改造

### 7.1 业务列表页

所有业务列表页的删除/编辑按钮，改为调用 `canDelete()` / `canEdit()` 判断是否显示：

```typescript
// 前端调用与后端相同的逻辑（通过一个轻量 API 或直接引用公共函数）
// 但注意 hasApprovalFlow() 需要查数据库，所以前端实际通过 API 判断
// 方案：新增一个轻量校验 API 或前端预加载 hasFlow 信息
```

### 7.2 审批流程配置页

- 左侧模块列表改为从 `GET /api/approval-module-config` 获取，按 `groupName` 分组展示
- 不再使用硬编码的 `BUSINESS_MODULE_GROUPS` / `BUSINESS_MODULES`

## 8. Seed 脚本

在 `prisma/seed.ts` 中新增：

```typescript
import { MODULE_CONFIG } from "@/lib/module-config"

// 同步模块清单到 approval_module_config 表
for (const config of MODULE_CONFIG) {
  await prisma.approvalModuleConfig.upsert({
    where: { moduleKey: config.key },
    update: { moduleName: config.name, groupName: config.group, isActive: true },
    create: { moduleKey: config.key, moduleName: config.name, groupName: config.group },
  })
}

// 软删除不再存在的模块
await prisma.approvalModuleConfig.updateMany({
  where: { moduleKey: { notIn: MODULE_CONFIG.map(m => m.key) } },
  data: { isActive: false },
})
```

## 9. 前端预加载 hasFlow 方案

由于 `hasApprovalFlow()` 需要查数据库，前端不能直接引用。有两种方案：

### 方案 A：列表页加载时通过 API 获取

在每个业务列表页的 `useEffect` 中，调用 `GET /api/approval-module-config?moduleKey=xxx` 获取当前模块的 `hasFlow`。

### 方案 B：用户登录时一次性加载所有模块的 hasFlow

在 `getCurrentUser()` 返回的数据中，附上所有模块的 `hasFlow` 状态。前端直接使用。

**推荐方案 B**，减少请求次数。在 `CurrentUser` 接口中新增字段。

## 10. 变更影响范围

| 层面 | 变更 |
|------|------|
| Prisma Schema | 新增 `approval_module_config` 表 |
| 配置文件 | 新增 `src/lib/module-config.ts` |
| 权限函数 | `permissions.ts` 新增 `hasApprovalFlow()`, `canDelete()`, `canEdit()` |
| 后端 API | 新增 `GET /api/approval-module-config`，修改约 13 个 DELETE/PUT 路由，修改 `business-types` API |
| 前端页面 | 审批流程页、约 10+ 业务列表页的删除/编辑按钮判断逻辑 |
| 审批引擎 | 不改 |
| Midlleware | 不改 |

## 11. 未纳入范围

- 有流程模块关闭流程后，已有审批中实例的处理（继续走完，不受影响）
- admin 用户的超级权限（admin 不受本设计限制，始终拥有全部权限）

## 12. 开发新模块时的操作流程

以后开发新模块：

1. 在 `src/lib/module-config.ts` 加上一条记录 `{ key: "new_module", name: "新模块", group: "所属分组" }`
2. 运行 `npx prisma db push` + seed 脚本
3. 该模块自动出现在审批流程配置页面
4. 开发该模块的页面和 API 时，参照已有模块的 DELETE/PUT 路由写法，调用 `canDelete()` / `canEdit()`
