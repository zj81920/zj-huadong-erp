# 角色权限与流程设置重构方案

日期：2026-06-03

## 概述

对 ERP 系统的角色设置、权限控制和流程设置进行重构，解决现有系统中角色与审批概念耦合、权限数据分散、UI 臃肿等问题，同时引入操作级（CRUD）权限体系和业务表单草稿功能。

## 1. 设置导航重组

### 现状
8 个设置页面平铺在侧边栏，无分组。

### 改造
将设置菜单按功能域分为 4 组：

```
系统设置
├── 用户与权限
│   ├ 用户设置
│   ├ 角色设置
│   └ 部门设置
├── 审批配置
│   ├ 流程设置
│   └ 审批调试
├── 基础数据
│   ├ 个人设置
│   └ 往来信息管理
└── 系统
    └ AI 模型配置
```

## 2. 数据模型变更

### 2.1 Role 模型

```prisma
model Role {
  id            String   @id @default(cuid())
  code          String   @unique
  name          String
  description   String?
  departmentId  String?  @map("department_id")

  // isProjectRole 字段移除（取消项目关联角色功能）

  // modulePermissions 替代 accessibleModules
  // 存储模块级 CRUD 配置：{ "business": { "create":true, "read":true, "update":true, "delete":false }, ... }
  modulePermissions    String   @default("{}") @map("module_permissions")

  // subModuleOverrides 存储子模块例外覆写
  // 只存与模块级默认不同的配置：{ "business.customers": { "delete":true }, "finance.expense.report": { "create":true, "update":true } }
  subModuleOverrides   String   @default("{}") @map("sub_module_overrides")

  // isGlobalVisible 保留（全局可见 = 拥有所有模块全部 CRUD 权限）
  isGlobalVisible    Boolean     @default(false) @map("is_global_visible")

  // level 替代 sort，仅用于角色列表排序，不参与审批逻辑
  level              Int         @default(0)

  isActive           Boolean     @default(true) @map("is_active")
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")
  lastModifiedBy     String?     @map("last_modified_by")

  department Department? @relation(fields: [departmentId], references: [id])
  users      UserRole[]

  @@map("roles")
}
```

### 2.2 权限数据统一

**现状**：模块定义在 3 个文件中重复（`module-permissions.ts`、角色页面、流程页面均硬编码）。

**改造**：所有模块定义只保留在 `src/lib/module-permissions.ts`，角色页面和流程页面从此文件读取。

### 2.3 业务表单草稿

业务表增加 `draft` 状态支持：

- 各业务表（采购需求、费用报销、合同等）增加一个公共的 `status` 字段枚举：`draft | pending | approved | rejected | archived`
- 或使用独立的 `DraftRecord` 泛型表存储草稿数据（待实现时选定方案）

## 3. 角色设置页面重构

### 3.1 角色列表页

**现状**：表格视图 + 编辑模态框

**改造**：卡片式布局

- 每张卡片展示：角色名称、部门、权限标签（显示模块名+计数）、用户数、最后修改时间
- 项目关联标记已移除
- admin 角色灰色背景表示系统内定不可编辑
- 点击「编辑」→ 跳转到角色详情页（非模态框）
- 支持搜索过滤

### 3.2 角色详情页（分 Tab）

三个 Tab：

1. **基本信息**：名称、部门、描述、全局可见开关、等级（数字，替代 sort）
2. **权限配置**：CRUD 权限矩阵（见 3.3）
3. **审批引用**：只读，显示此角色出现在哪些审批流的哪个节点中，可点击跳转到流程设置

### 3.3 CRUD 权限矩阵

**操作级权限**：每个模块/子模块可独立设置「查看 / 新增 / 编辑 / 删除」四个操作。

**混合模式规则**：
- 模块级设置默认 CRUD，子模块自动继承
- 点击子模块任一操作可独立覆写，覆写后该行高亮标记「已覆写」
- 点击「已覆写」标签可重置回继承模块级默认
- 保存时只存储模块级配置 + 子模块差异（`subModuleOverrides`）

**关键规则**：
- `新增(Create)` 权限 = 可发起该模块业务的审批流程
- 没有某个子模块的新增权限，即使审批流中配置为审批人，也无法发起该类型审批

## 4. 审批引擎变更

### 4.1 移除项目关联角色

- 删除 `isProjectRole` 字段及所有相关逻辑
- 删除 `resolveProjectManager()` 和 `resolveDesignManager()` 函数
- 删除 `shouldSkipNode()` 中的项目角色硬编码分支
- 角色解析逻辑简化为：根据 roleCode 查找全局分配的用户

### 4.2 发起人自动跳过

**规则**：发起流程时，如果发起人属于某个节点的审批角色，则该节点自动跳过（标记为 `auto_skip`），不影响其他节点。

- 适用于所有角色，不硬编码
- 在 `startApprovalFlow()` 中处理，只在发起时执行一次
- 归档节点（`archive`）和支付节点（`payment`）不参与跳过逻辑
- `auto_skip` 动作记录到 `ApprovalAction` 表中，留审计痕迹

**不引入**：按角色等级跳过低级别节点的规则（因存在跨职能审批矛盾）。

### 4.3 角色等级

- `level` 字段仅用于角色列表排序（替代 `sort`）
- 不参与审批跳过逻辑

## 5. 流程设置页面优化

### 5.1 编辑缓存

- 切换业务模块时，当前编辑内容缓存在前端状态中，不丢失
- 保存成功后才清除对应模块的缓存
- 不引入「草稿」概念（流程配置要么已保存、要么未保存）

### 5.2 左侧业务模块列表

- 显示节点数（如「3 节点」），表示已配置
- 空表示未配置
- 数据源统一从 `module-permissions.ts` 读取

### 5.3 保存校验优化

- 保存时不强制要求所有节点填完审批角色（可部分保存）
- 仅在流程实际启用时（涉及审批发起）校验完整性

## 6. 业务表单草稿

### 6.1 入口

在**审批中心**增加「我的草稿」Tab，与现有「待处理 / 已处理 / 已发起」同级。

### 6.2 功能

- 显示当前用户所有业务类型（采购需求、费用报销、合同等）中状态为 `draft` 的记录
- 每条草稿显示：业务类型标签、标题、保存进度（如「保存了 3/8 项」）、上次编辑时间
- 点击「继续填写」→ 跳转到对应业务表单的编辑页面，回填已保存数据
- 支持删除草稿
- 草稿填完后点「提交审批」→ 状态变为 `pending`，进入审批流

## 7. 实现建议

### 7.1 实施顺序

1. 数据源统一（`module-permissions.ts`）
2. Role 模型变更（`modulePermissions` + `subModuleOverrides` + `level`，移除 `isProjectRole`）
3. 审批引擎调整（移除项目关联逻辑，增加发起人自动跳过）
4. 角色设置新 UI（列表卡片 + 详情页分 Tab + CRUD 矩阵）
5. 流程设置 UI 优化（编辑缓存 + 数据源统一）
6. 设置导航分组
7. 业务表单草稿功能

### 7.2 兼容性

- 现有 `accessibleModules` 数据迁移：将 JSON 字符串中的模块 key 列表转换为 `modulePermissions` 格式（所有列出的模块赋予完整 CRUD，未列出的赋予空操作）
- 现有 `sort` 数据迁移到 `level` 字段
- `isProjectRole=true` 的角色：迁移时忽略该标记，审批引擎不再走项目级解析
