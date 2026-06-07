# 华东工程 ERP 系统 — 工作流全景报告

> 生成日期：2026-06-07 | 基于代码静态分析

---

## 目录

- [第一部分：审批流全景报告](#第一部分审批流全景报告)
  - [1.1 审批引擎核心模型](#11-审批引擎核心模型)
  - [1.2 审批状态机流转](#12-审批状态机流转)
  - [1.3 节点类型与权限矩阵](#13-节点类型与权限矩阵)
  - [1.4 业务模块审批流注册表](#14-业务模块审批流注册表)
  - [1.5 审批流配置与管理流程](#15-审批流配置与管理流程)
  - [1.6 会签机制](#16-会签机制)
  - [1.7 发起人自动跳过策略](#17-发起人自动跳过策略)
- [第二部分：业务操作流报告](#第二部分业务操作流报告)
  - [2.1 商务管理域](#21-商务管理域)
  - [2.2 项目管理域](#22-项目管理域)
  - [2.3 项目采购域](#23-项目采购域)
  - [2.4 合同管理域](#24-合同管理域)
  - [2.5 财务管理域](#25-财务管理域)
  - [2.6 人事行政域](#26-人事行政域)
  - [2.7 特殊流程](#27-特殊流程)
- [第三部分：技术架构流报告](#第三部分技术架构流报告)
  - [3.1 审批引擎核心调用链](#31-审批引擎核心调用链)
  - [3.2 前后端权限映射链](#32-前后端权限映射链)
  - [3.3 API 路由数据流](#33-api-路由数据流)
  - [3.4 组件复用体系](#34-组件复用体系)
  - [3.5 数据删除清理链](#35-数据删除清理链)
  - [3.6 文件架构与模块依赖](#36-文件架构与模块依赖)

---

## 第一部分：审批流全景报告

### 1.1 审批引擎核心模型

审批系统基于 4 个 Prisma 模型构建，全部位于 `prisma/schema.prisma`：

| 模型 | 表名 | 职责 |
|------|------|------|
| `ApprovalFlowDefinition` | `approval_flow_definitions` | 审批流定义——每个 businessType 的多节点审批流程模板 |
| `ApprovalInstance` | `approval_instances` | 审批实例——某条业务记录运行时产生的审批流程实例 |
| `ApprovalAction` | `approval_actions` | 审批动作——每一步审批操作的记录（通过/驳回/归档/支付/跳过/重提） |
| `ApprovalDelegate` | `approval_delegates` | 审批委托——A 委托 B 在指定时间段内代为审批 |

**ApprovalFlowDefinition 核心字段：**

```
businessType   → 业务模块标识（如 "supplier"、"expense_contract"）
flowLevel      → 流程级别（默认 "common"）
nodeOrder      → 节点顺序号（1, 2, 3...）
nodeName       → 节点显示名称（如 "部门负责人审批"）
approverRole   → 审批角色 code（逗号分隔支持多角色）
nodeType       → 节点类型：approval | archive | payment
```

**ApprovalInstance 核心字段：**

```
businessType / businessId  → 关联的业务记录
flowLevel                  → 流程级别
currentNode                → 当前所在节点 order
status                     → 审批中 | 已批准 | 已驳回 | 待归档 | 待支付 | 已生效 | 已归档
parentInstanceId           → 父实例 ID（支持审批链，如变更单链接到原合同审批）
businessTitle              → 业务标题（通知中展示）
```

### 1.2 审批状态机流转

```
  [草稿] ──提交审批──▶ [审批中] ──通过(最后一节点)──▶ [已批准]
    ▲                     │                              │
    │                     ├──通过(下一节点=archive)──▶ [待归档] ──归档──▶ [已归档]
    │                     │                              │
    │                     ├──通过(下一节点=payment)──▶ [待支付] ──支付──▶ [已生效]
    │                     │
    │                     └──驳回──────────────────▶ [已驳回]
    │                                                      │
    └────────────────────重提─────────────────────────────┘

状态含义：
  审批中  → 流程正在进行，等待审批人操作
  已批准  → 所有审批节点通过，但可能有后续归档/支付节点
  待归档  → 审批通过，等待归档人上传扫描件
  待支付  → 审批通过，等待支付人执行付款
  已驳回  → 审批被驳回，发起人可重新提交
  已归档  → 归档完成
  已生效  → 支付完成
```

### 1.3 节点类型与权限矩阵

审批流支持三种节点类型，每种对应不同的操作权限：

| 节点类型 | 允许操作 | 操作者角色 | 发起人能否操作自己 | 说明 |
|----------|---------|-----------|-------------------|------|
| `approval` | 通过 / 驳回 | approverRole 匹配 | **否**（禁止） | 标准审批节点，支持会签 |
| `archive` | 归档 | approverRole 匹配 | **是** | 上传扫描件归档，发起人不跳过 |
| `payment` | 支付 | approverRole 匹配 | **是** | 执行付款操作，发起人不跳过 |

**设计要点：**
- 发起人在 `approval` 节点上 `canApprove/canReject` 均为 false（防止自己审批自己）
- 发起人在 `archive`/`payment` 节点上例外：`canArchive/canPayment = true`（否则流程卡死）
- 典型场景：出纳发起报销后自己执行支付、财务发起申请后自己归档

### 1.4 业务模块审批流注册表

共 16 个业务模块配置了审批流（`MODULE_CONFIG`），分布在 5 个业务域：

#### 商务管理（2 个）

| businessType | 名称 | 页面路由 | DetailCard |
|-------------|------|---------|------------|
| `supplier` | 供应商审批 | `/business/suppliers` | `SupplierDetailCard` |
| `supplier_change` | 供应商变更 | `/business/suppliers` (tab) | `SupplierChangeDetailCard` |

#### 项目管理（1 个）

| businessType | 名称 | 页面路由 | DetailCard |
|-------------|------|---------|------------|
| `outsourcing` | 设计外包 | `/projects/outsourcing` | `OutsourcingDetailCard` |

#### 项目采购（3 个）

| businessType | 名称 | 页面路由 | DetailCard |
|-------------|------|---------|------------|
| `purchase_request` | 采购需求 | `/procurement/requests` | `PurchaseRequestDetailCard` |
| `inquiries` | 采购单 | `/procurement/inquiries` | `InquiryDetailCard` |
| `delivery_receipt` | 到货验收 | `/procurement/deliveries` | `DeliveryReceiptDetailCard` |

#### 合同管理（4 个）

| businessType | 名称 | 页面路由 | DetailCard | 批准后自动操作 |
|-------------|------|---------|------------|--------------|
| `income_contract` | 收入合同 | `/contracts/income` | `IncomeContractDetailCard` | 创建应收记录 |
| `expense_contract` | 支出合同 | `/contracts/expense` | `ExpenseContractDetailCard` | 创建应付记录 + 更新采购需求为"已采购" |
| `inter_org_contract` | 内部结算合同 | `/contracts/internal-settlement` | `InterOrgContractDetailCard` | 创建应收 + 关联收入合同 |
| `contract_change_order` | 合同变更 | `/contracts/change-orders` | `ContractChangeOrderDetailCard` | 更新合同金额、应收应付、合并归档文件 |

#### 财务管理（6 个）

| businessType | 名称 | 页面路由 | DetailCard | 支付后自动操作 |
|-------------|------|---------|------------|--------------|
| `non_contract_expense` | 其他支付 | `/finance/expense` (tab) | `NonContractExpenseDetailCard` | 同步往来单位信息 |
| `payment_application` | 合同支付 | `/finance/expense` (tab) | `PaymentApplicationDetailCard` | 创建支付凭证 + 更新应付已付金额 |
| `lending_out` | 借出款 | `/finance/expense` (tab) | `LendingOutDetailCard` | — |
| `expense_report` | 费用报销 | `/finance/expense` (tab) | `ExpenseReportDetailCard` | — |
| `salary_payment` | 工资发放 | `/finance/expense` (tab) | `SalaryPaymentDetailCard` | 记录发放时间 |
| `borrowing_return_application` | 借入资金归还 | `/finance/expense` (tab) | `BorrowingReturnDetailCard` | 创建归还记录 + 更新出资/借入余量 |

### 1.5 审批流配置与管理流程

```
管理员 ──▶ 进入 "流程设置" 页面（/settings/approval-flow）
         │
         ├── GET /api/approval-flows?businessType=xxx
         │   获取当前模块的审批流配置
         │
         ├── POST /api/approval-flows
         │   保存审批流（事务内 deleteMany + createMany）
         │   - 校验 nodes.length > 0（禁止保存空数组）
         │   - 校验无活跃审批实例（有则返回 409）
         │
         ├── POST /api/approval-flows/apply
         │   批量复制审批流到其他模块（每个 target 独立事务）
         │
         ├── POST /api/approval-flows/business-types
         │   初始化审批流模板（按默认 4 节点创建）
         │
         └── GET /api/approval-flows/business-types
             获取可用业务类型和审批角色列表
```

### 1.6 会签机制

当前节点配置多角色或角色下有多个用户时，触发会签逻辑（`checkCountersignComplete`）：

- **多角色间"或签"**：任一角色的所有成员审批完成即可推进
- **同角色内"会签"**：该角色下所有用户都需审批通过
- **轮次感知**：只看最后一轮（最近一次 `initiate`/`resubmit` 之后）的 `approve` 动作
- **自动排除 admin**：admin 用户不参与会签计数

### 1.7 发起人自动跳过策略

`autoSkipInitiator()` + `skipConsecutiveSelfNodes()` 实现：

- 发起审批流时，检查发起人角色是否匹配当前节点
- 匹配则自动创建 `auto_skip` action 跳过
- **不跳过** `archive` 和 `payment` 节点（即使角色匹配）
- 每次推进到新节点时也会检查并连续跳过后续匹配节点

---

## 第二部分：业务操作流报告

### 2.1 商务管理域

#### 2.1.1 供应商管理流程

```
[创建供应商] ──▶ [提交审批] ──▶ [审批流] ──▶ [审批通过] ──▶ [状态 → "当前有效"]
      │                  │              │
      │                  │              └── 驳回 → 状态 → "已驳回" → 可重新提交
      │                  │
      │                  └── 自动创建 ApprovalInstance + 发起人跳过 + 通知审批人
      │
      └── 支持批量删除（先清理审批数据）
```

#### 2.1.2 供应商变更流程

```
[选择供应商] ──▶ [填写变更信息] ──▶ [提交审批] ──▶ [审批流] ──▶ [通过/驳回]
                      │
                      └── 记录变更前后数据对比
```

#### 2.1.3 市场开发 → 投标 → 报价链路

```
[客户管理] ──▶ [市场开发（项目线索）] ──▶ [投标统计] ──▶ [报价统计] ──▶ [提交审批]
                                                             │
                                                             └── 审批通过 → 进入项目/合同阶段
```

### 2.2 项目管理域

#### 2.2.1 项目立项流程

```
[市场开发通过] ──▶ [项目立项] ──▶ [创建项目编号] ──▶ [关联客户、组织]
                         │
                         ├──▶ [项目计划] ──▶ [设置关键节点]
                         │
                         ├──▶ [项目进度] ──▶ [跟踪实际进度 vs 计划]
                         │
                         └──▶ [设计外包] ──▶ [提交审批] ──▶ [审批流] ──▶ [通过/驳回]
```

### 2.3 项目采购域

#### 2.3.1 采购全链路

```
[采购需求] ──▶ [提交审批] ──▶ [审批通过]
    │
    ├──▶ [创建采购单（询价）] ──▶ [选择供应商] ──▶ [发布询价]
    │         │
    │         ├──▶ [供应商在线报价]  ← 公开页面 /inquiry/quote?token=xxx
    │         │
    │         └──▶ [比价/定标] ──▶ [生成支出合同]
    │
    └──▶ [支出合同审批通过] → 采购需求状态自动更新为 "已采购"

[支出合同] ──▶ [到货验收] ──▶ [提交审批] ──▶ [审批通过]
                     │
                     └── 记录实收数量、验收金额、发票金额
```

### 2.4 合同管理域

#### 2.4.1 收入合同流程

```
[创建收入合同] ──▶ [关联项目、客户] ──▶ [设置分期收款 plan]
      │
      ├──▶ [提交审批] ──▶ [审批通过]
      │         │
      │         └── 自动创建应收记录（按分期拆分或整笔）
      │
      ├──▶ [合同变更] ──▶ [审批通过]
      │         │
      │         └── 自动更新合同金额 + 同步调整应收
      │
      └──▶ [内部结算] ──▶ [关联收入合同] ──▶ [审批通过]
                │
                └── 自动创建应收 + 标记关联收入合同
```

#### 2.4.2 支出合同流程

```
[采购单定标] ──▶ [创建支出合同] ──▶ [关联供应商、采购单]
      │
      ├──▶ [提交审批] ──▶ [审批通过]
      │         │
      │         └── 自动创建应付记录 + 更新采购需求为 "已采购"
      │
      ├──▶ [合同变更] ──▶ [审批通过]
      │         │
      │         └── 自动更新合同金额 + 同步调整应付
      │
      └──▶ [到货验收] ──▶ [合同支付]
```

### 2.5 财务管理域

#### 2.5.1 财务收入 — 多 Tab 聚合页面

```
/finance/income 页面（Tab 切换）：
  ├── [合同收款] → 基于应收记录创建收款凭证
  ├── [其他收入] → non_contract_income → 提交审批
  ├── [股东出资] → capital_contribution → 记录 → 返还
  └── [其他借入款] → other_borrowing → 提交审批 → 归还
```

#### 2.5.2 财务支出 — 多 Tab 聚合页面

```
/finance/expense 页面（Tab 切换）：
  ├── [合同支付] → payment_application → 审批通过 → 自动创建支付凭证 + 更新应付
  ├── [其他支付] → non_contract_expense → 审批（自动同步往来单位信息）
  ├── [借出款]   → lending_out → 审批 → 归还
  ├── [费用报销] → expense_report → 审批
  ├── [工资发放] → salary_payment → 审批
  └── [借入资金归还] → borrowing_return_application → 支付后自动创建归还记录 + 更新余量
```

#### 2.5.3 发票管理流程

```
[收入/支出完成] ──▶ [登记发票] ──▶ [关联来源（合同/非合同/薪资）]
                         │
                         └── 记录发票号、金额、税率、税额
```

### 2.6 人事行政域

人事行政模块**无审批流**，为直接操作型：

| 模块 | 操作 | 特殊说明 |
|------|------|---------|
| 员工档案 | CRUD + 附件管理 | 禁用使用软删除（`isActive: false`） |
| 办公用品 | 出入库管理 | — |
| 证照管理 | CRUD + 到期提醒 | — |
| 印章管理 | CRUD + 借用归还 | — |

### 2.7 特殊流程

#### 2.7.1 审批委托

```
A 用户 ──▶ 设置委托 ──▶ [委托给 B] ──▶ [时间段]
                                  │
                                  └── 期间 B 可代为审批 A 的待办
```

#### 2.7.2 管理员强制推进

```
管理员 ──▶ POST /api/approval-flows/force-advance
        │
        └── 跳过当前会签 → 直接推进到下一节点 → 记录 force_advance 动作
```

#### 2.7.3 批量删除

```
用户选择多条记录 ──▶ POST /api/batch-delete
                  │
                  ├── 逐条调用 cleanupBusinessApprovalRecords (清理审批数据)
                  │
                  └── 逐条物理删除业务记录
```

---

## 第三部分：技术架构流报告

### 3.1 审批引擎核心调用链

审批引擎集中在 `src/lib/approval-engine.ts`（1657 行），核心函数调用关系：

```
                    ┌─────────────────────────────────────┐
                    │        startApprovalFlow()          │ ← 发起审批流
                    │  1. 检查已驳回实例 → 复用+重提      │
                    │  2. 检查活跃实例 → 拒绝重复提交    │
                    │  3. 创建 ApprovalInstance          │
                    │  4. 创建 initiate action           │
                    │  5. autoSkipInitiator() 发起人跳过  │
                    │  6. 通知第一站审批人               │
                    └──────────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ skipConsecutive  │  │ resolveApprover  │  │ getPending       │
   │ SelfNodes()      │  │ Ids()            │  │ Approvals()      │
   │ 连续跳过发起人   │  │ 解析审批人列表   │  │ 获取待审批列表   │
   └──────────────────┘  └──────────────────┘  └──────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ processApproval  │  │ checkCountersign │  │ updateBusiness   │
   │ Action()         │  │ Complete()       │  │ Status()         │
   │ 执行审批动作     │  │ 会签完成检查     │  │ 更新业务状态     │
   └────────┬─────────┘  └──────────────────┘  └────────┬─────────┘
            │                                           │
            │  权限校验                                  │ 业务副作用
            ▼                                           ▼
   ┌──────────────────┐                    ┌──────────────────────────┐
   │ resolveUser      │                    │ 22个 businessType 的     │
   │ Approval         │                    │ switch 分支处理：        │
   │ Capabilities()   │                    │ • 创建应收/应付          │
   │ 6个权限标志      │                    │ • 创建支付凭证           │
   └──────────────────┘                    │ • 更新合同金额           │
                                           │ • 同步往来单位信息       │
                                           │ • 创建归还记录           │
                                           └──────────────────────────┘
```

**关键设计原则：**

1. **后端驱动权限**：`resolveUserApprovalCapabilities` 是唯一的权限真相源，返回 6 个标志位
2. **前端不计算权限**：`ApprovalActionButton` 直接从 API 返回的 instance 对象读取权限
3. **事务保证**：审批流配置保存和状态推进均使用 `prisma.$transaction`
4. **幂等防重**：创建应收/应付/凭证前先检查是否已存在

### 3.2 前后端权限映射链

权限解析使用三层映射链，确保角色配置的 `modulePermissions` JSON 能正确应用到前端页面和后端 API：

```
┌──────────────────────────────────────────────────────────────────────┐
│ 角色配置 modulePermissions JSON                                      │
│ { "business": { "create": true, "read": true, ... }, ... }          │
│ （使用父模块 key，如 "business"、"finance"）                         │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 前端页面查权限：getUserModulePerms(roles, "supplier")                │
│                                                                      │
│ ① 通过 API_TO_SUB_MODULE["supplier"] → "business.suppliers"         │
│ ② 通过 SUB_MODULE_MAP["business.suppliers"] → parent: "business"    │
│ ③ 查找 role.modulePermissions["business"] → 获取 CRUD 权限          │
│                                                                      │
│ 文件：src/lib/module-permissions.ts → src/lib/types/permissions.ts   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 后端 API 权限校验：permission-check.ts                               │
│                                                                      │
│ 同样通过 API_TO_SUB_MODULE → SUB_MODULE_MAP 映射链查找              │
│ （re-export from permissions.ts，禁止创建同名函数）                  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 审批发起权限：canInitiateFlow()                                     │
│                                                                      │
│ ① 通过 BUSINESS_TYPE_TO_MODULE_KEY["supplier"] → "business"         │
│ ② 检查角色 modulePermissions["business"].create                     │
│ ③ 兜底：审批流第一节点角色匹配                                      │
│                                                                      │
│ 文件：src/lib/approval-engine.ts                                    │
└──────────────────────────────────────────────────────────────────────┘
```

**BUSINESS_TYPE_TO_MODULE_KEY 映射表**（approval-engine.ts L1366-1385）：

| businessType | → 父模块 key |
|-------------|-------------|
| supplier, supplier_change | `business` |
| outsourcing | `projects` |
| purchase_request, inquiries, delivery_receipt | `procurement` |
| income_contract, expense_contract, inter_org_contract, contract_change_order | `contracts` |
| 其余 10 个财务类型 | `finance` |

### 3.3 API 路由数据流

#### 3.3.1 发起审批流

```
POST /api/approval-instances
  │
  ├── 1. 权限校验：canInitiateFlow(userId, businessType, flowLevel)
  │     ├── 检查审批流定义是否存在
  │     ├── 检查角色 modulePermissions 中父模块的 create 权限
  │     └── 兜底：检查是否匹配审批流第一节点角色
  │
  ├── 2. 自动填充 businessTitle（根据 businessType 从业务记录中提取）
  │
  ├── 3. 调用 startApprovalFlow()
  │     ├── 创建 ApprovalInstance（status="审批中"）
  │     ├── 创建 initiate action
  │     ├── autoSkipInitiator() 发起人跳过
  │     └── 通知当前节点审批人
  │
  └── 4. 返回创建的审批实例
```

#### 3.3.2 获取审批详情

```
GET /api/approval-instances/[id]
  │
  ├── 1. 查询 ApprovalInstance（含 actions、flowNodes）
  │
  ├── 2. 调用 resolveUserApprovalCapabilities(instanceId, userId)
  │     └── 返回 { canApprove, canReject, canArchive, canPayment, isInitiator, hasActedThisRound }
  │
  └── 3. 返回完整审批详情（含权限标志）
```

#### 3.3.3 执行审批动作

```
POST /api/approval-instances/[id]/actions
  { action: "approve"|"reject"|"archive"|"payment", ... }
  │
  ├── 1. 调用 processApprovalAction()
  │     │
  │     ├── 2. 内部调用 resolveUserApprovalCapabilities() 权限校验
  │     │
  │     ├── 3. 创建 ApprovalAction 记录
  │     │
  │     ├── 4. 根据 action 类型处理：
  │     │   ├── approve → 会签检查 → 推进/等待 → 通知
  │     │   ├── reject  → 实例标记"已驳回" → 通知发起人
  │     │   ├── archive → 实例标记"已批准" → updateBusinessStatus("已归档")
  │     │   └── payment → 实例标记"已批准" → updateBusinessStatus("已支付")
  │     │
  │     └── 5. updateBusinessStatus() 执行业务副作用
  │
  └── 6. 返回 { status, currentNode, nextApproverIds }
```

### 3.4 组件复用体系

#### 3.4.1 DetailCard 共享体系

```
src/components/detail-cards/
  │
  ├── index.ts                    ← DETAIL_CARD_MAP 注册中心（20 个注册项）
  │   └── export const DETAIL_CARD_MAP: Record<businessType, Component>
  │
  ├── DetailGrid.tsx              ← 通用字段网格渲染器
  ├── format.ts                   ← 格式化工具
  │
  ├── business/                   ← 商务相关 DetailCard（5 个）
  ├── contracts/                  ← 合同相关 DetailCard（4 个）
  ├── finance/                    ← 财务相关 DetailCard（8 个）
  └── suppliers/                  ← 供应商相关 DetailCard（2 个）

复用场景：
  ┌─────────────────────────────────────────────────────────┐
  │ 业务模块详情页弹窗                                       │
  │   → 直接 import XxxDetailCard                           │
  ├─────────────────────────────────────────────────────────┤
  │ 审批中心详情弹窗                                         │
  │   → 通过 DETAIL_CARD_MAP[businessType] 动态获取组件      │
  └─────────────────────────────────────────────────────────┘

新增模块时只需：
  1. 创建 XxxDetailCard.tsx
  2. 在 DETAIL_CARD_MAP 中注册
  3. 两处自动生效
```

#### 3.4.2 审批组件复用

```
src/components/
  ├── ApprovalComponents.tsx     ← 审批状态徽章、时间线、操作按钮
  │                                  （权限从 instance 对象读取，不自行计算）
  ├── ApprovalSection.tsx        ← 业务详情页审批区域容器
  └── DetailPageLayout.tsx       ← 详情页通用布局（内嵌 ApprovalSection）

hooks/
  └── useApprovalInstance.ts     ← 前端 hook，调 /api/approval-instances/[id]
```

### 3.5 数据删除清理链

所有业务模块的删除都遵循统一的物理删除流程：

```
DELETE /api/xxx/[id]
  │
  ├── 1. cleanupBusinessApprovalRecords(businessType, businessId)
  │     │  （src/lib/approval-cleanup.ts）
  │     │
  │     ├── 查询该业务的所有 ApprovalInstance
  │     ├── 删除所有关联 ApprovalAction
  │     ├── 删除所有关联 Notification（以 instance.id 为 relatedId）
  │     ├── 删除所有 ApprovalInstance
  │     └── 兜底删除以 business.id 为 relatedId 的通知
  │       （以上全部在 prisma.$transaction 中执行）
  │
  └── 2. prisma.xxx.delete({ where: { id } })
```

**支持物理删除的模块**（32 个，定义在 `batch-delete/route.ts` 的 `BUSINESS_MODELS` 中）：

| 域 | 模块 |
|----|------|
| 商务 | supplier, supplier_change, customer, project_lead, biddings, quotation |
| 项目 | project, project_plan, project_progress, outsourcing, design_task |
| 采购 | purchase_request, inquiry, delivery_receipt |
| 合同 | income_contract, expense_contract, inter_org_contract, contract_change_order, non_contract_income, non_contract_expense |
| 财务 | payable, receivable, payment_application, payment_voucher, receipt_voucher, invoice, expense_report, lending_out, other_borrowing, borrowing_return_application, salary_payment, bank_account |
| HR | office_supply, certificate, seal |

### 3.6 文件架构与模块依赖

```
src/lib/（核心库层）
  ├── approval-engine.ts         ← 审批引擎（1657行，核心）
  │   ├── 依赖：prisma.ts, approval-cleanup.ts
  │   └── 被依赖：api/approval-instances/, api/approval-flows/
  │
  ├── module-permissions.ts      ← 权限映射（296行）
  │   ├── 定义：API_TO_SUB_MODULE, SUB_MODULE_MAP, BUSINESS_MODULE_GROUPS
  │   └── 被依赖：permission-check.ts, Sidebar.tsx, 各 API 路由
  │
  ├── types/permissions.ts       ← 权限类型 + getUserModulePerms
  │   └── 被依赖：所有前端页面组件
  │
  ├── permission-check.ts        ← 后端权限检查（re-export）
  │   └── 被依赖：各 API 路由的 middleware
  │
  ├── approval-cleanup.ts        ← 审批数据清理
  │   └── 被依赖：各模块 DELETE API、batch-delete API
  │
  └── module-config.ts           ← 审批流模块配置（MODULE_CONFIG）
      └── 被依赖：审批流设置页面

src/app/api/（API 路由层）
  ├── approval-flows/            ← 审批流 CRUD（5 个端点）
  ├── approval-instances/        ← 审批实例操作（3 个端点）
  └── [各业务模块]/              ← 40+ 业务 API 模块

src/app/(dashboard)/（页面层）
  ├── approvals/                 ← 审批中心（待审批/已处理/我发起的）
  ├── business/                  ← 商务管理
  ├── projects/                  ← 项目管理
  ├── procurement/               ← 项目采购
  ├── contracts/                 ← 合同管理
  ├── finance/                   ← 财务管理
  ├── hr/                        ← 人事行政
  └── settings/                  ← 系统设置（审批流配置、角色管理等）

src/components/（组件层）
  ├── detail-cards/              ← 共享详情卡片（20 个） + 注册中心
  ├── Sidebar.tsx                ← 全局侧边栏
  ├── Header.tsx                 ← 全局头部
  └── ApprovalComponents.tsx     ← 审批流通用组件
```

---

## 附录：关键文件索引

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/lib/approval-engine.ts` | 1657 | 审批引擎核心——发起、推进、状态更新、权限判断 |
| `src/lib/module-permissions.ts` | 351 | 模块权限映射——三层映射链 + 业务模块分组 |
| `src/lib/types/permissions.ts` | ~120 | 权限类型定义 + `getUserModulePerms` 实现 |
| `src/lib/approval-cleanup.ts` | ~80 | 审批数据清理——物理删除审批实例、动作、通知 |
| `src/lib/module-config.ts` | 62 | 审批流模块配置——16 个业务模块注册 |
| `src/components/detail-cards/index.ts` | 72 | DetailCard 注册中心——20 个业务类型映射 |
| `src/app/api/batch-delete/route.ts` | ~200 | 批量删除——32 个业务模型统一入口 |
| `prisma/schema.prisma` | ~1440 | 数据库 Schema——47 个模型 |

---

> **报告结束** — 本报告基于代码静态分析生成，覆盖审批流引擎、22 个业务模块操作流程、前后端技术架构。如需更新，请在代码变更后重新生成。
