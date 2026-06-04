# 多经营主体（多组织）架构设计方案

## 1. 背景与目标

当前系统为单公司架构，以"安徽华东化工医药工程有限责任公司"分公司为主体。实际业务涉及多个法人实体之间的合同、发票、资金流转：

- **分公司**（非独立法人，独立核算）— 系统当前主体
- **总公司** — 分公司上级
- **咨询公司** — 独立法人，用户管理的另一经营主体
- **挂靠公司** — 偶发业务中的合作方

目标：在不改变系统单实例部署的前提下，支持多经营主体数据的录入、关联与报表分析。

## 2. 数据模型设计

### 2.1 Organization（经营主体）

新增模型，作为所有业务数据的归属根。

```
Organization
  id              String    @id @default(cuid())
  code            String    // 编码：HQ / BRANCH / CONSULT / AFFILIATED
  name            String    // 全称
  shortName       String?   // 简称
  taxId           String?   // 税号
  type            String    // PARENT / BRANCH / CONSULTING / AFFILIATED
  isActive        Boolean   @default(true)
  sort            Int       @default(0)
  createdAt       DateTime
  updatedAt       DateTime
```

种子数据：总公司（PARENT）、分公司（BRANCH）、咨询公司（CONSULTING）、挂靠公司（AFFILIATED）。

### 2.2 现有模型加 organizationId

以下模型新增 `organizationId` 字段（必填），标识数据归属：

| 模型 | 说明 |
|------|------|
| IncomeContract | 收入合同所属主体 |
| ExpenseContract | 支出合同所属主体 |
| Invoice | 发票所属主体（开票方） |
| Receivable | 应收所属主体 |
| Payable | 应付所属主体 |
| ReceiptVoucher | 收款凭证所属主体 |
| PaymentVoucher | 付款凭证所属主体 |
| Project | 项目所属主体 |

Customer、Supplier 共享（不归属特定主体），但在关联业务中通过 organizationId 确定上下文。

### 2.3 InterOrgContract（内部结算合同）

处理总分公司之间、挂靠公司与咨询公司之间的内部结算。

```
InterOrgContract
  id                    String    @id @default(cuid())
  contractNo            String    // 合同编号
  contractName          String    // 合同名称

  // 主体信息
  fromOrgId             String    // 收款方/开票方（如总公司、挂靠公司）
  toOrgId               String    // 付款方（如分公司、咨询公司）
  type                  String    // MANAGEMENT_FEE（仅此一种类型）

  // 关联主合同（仅限有项目的收入合同）
  relatedContractId     String?   // 关联收入合同ID
  mainContractAmount    Decimal?  // 主合同金额（自动带出，只读）

  // 费用字段（用户填写）
  managementFee         Decimal   // 管理费
  taxBurden             Decimal   // 税费承担
  otherFee              Decimal   // 其他费用
  otherFeeNote          String?   // 其他费用说明（otherFee>0时必填）

  // 自动计算（只读）
  settlementAmount      Decimal   // 结算合同额
                              // = mainContractAmount - managementFee - taxBurden - otherFee

  // 状态与归档
  status                String    // 草稿 / 待审批 / 已批准 / 已付款 / 已完成 / 已归档
  approvalInstanceId    String?
  archivedUrl           String?   // 归档扫描件（JSON数组）
  remark                String?
  createdAt             DateTime
  updatedAt             DateTime
```

字段说明：
- `type`：固定为 `MANAGEMENT_FEE`，不再有其他类型
- `relatedContractId`：仅关联**有项目（projectSourceId 不为空）的收入合同**
- `mainContractAmount`：从关联的收入合同自动带出，只读显示
- `settlementAmount`：自动计算 = 主合同金额 - 管理费 - 税费承担 - 其他费用，审批通过后按此金额生成应收记录
- `archivedUrl`：审批归档时存储扫描件 URL 的 JSON 数组，与收入合同归档机制一致

### 2.4 BankAccount 关联 Organization

```
BankAccount
  ...现有字段
  organizationId  String?  // 归属主体，null 表示共享账户
```

### 2.5 收入/支出合同加 organizationId 字段

IncomeContract 和 ExpenseContract 已有 `organizationId` 字段（数据库），前端表单补充"所属主体"下拉选择框，默认值=总公司。

选择所属主体后，收款/付款账户下拉列表自动筛选该主体下的银行账户。

### 2.6 关联合同标记

在 IncomeContract 上新增字段，标记是否已被内部结算合同关联，防止重复选择：

```
IncomeContract
  ...现有字段
  interOrgContractId  String?   // 关联的内部结算合同ID，null表示未关联
```

当内部结算合同状态=已批准/执行中时，写入该字段。
当内部结算合同被驳回/退回草稿时，清空该字段。

## 3. 业务场景映射

### 3.1 收入场景：客户签总公司（占90%）

```
客户 →[收入合同]→ 总公司（所属主体=总公司，签约方=客户）
客户 →[付款]→ 总公司账户

内部结算合同（关联此收入合同）：
  收款方=总公司，付款方=分公司
  主合同金额=¥100（自动带出）
  管理费=¥10（用户填写）
  税费承担=¥0（用户填写）
  其他费用=¥0（用户填写）
  结算合同额=¥90（自动计算）

内部结算合同审批通过后 → 生成应收记录 ¥90
出纳收款：分公司付款给总公司 ¥90
分公司开票给总公司 ¥10（管理费发票）
```

操作流程：
1. 录收入合同 → 所属主体=总公司，关联项目
2. 录内部结算合同 → 关联此收入合同，填写管理费等费用项
3. 系统自动计算结算合同额
4. 提交审批
5. 审批通过后 → 自动生成 Receivable（金额=结算合同额）
6. 出纳在「财务→收入」页面操作收款
7. 在内部结算合同详情页登记发票

### 3.2 挂靠场景

```
客户 →[收入合同][付款][发票]→ 挂靠公司
内部结算合同 → 挂靠公司（收款方）→ 咨询公司（付款方）
```

操作流程与3.1一致，主体不同。

## 4. 财务流程

### 4.1 审批通过后自动生成应收

在 `approval-engine.ts` 中增加 `inter_org_contract` 处理分支：

```
case "inter_org_contract":
  1. 更新 InterOrgContract 状态为"已批准"
  2. 检查是否已有 Receivable（防重复）
  3. 如无，按 settlementAmount 创建 Receivable：
     - sourceType = "inter_org_contract"
     - sourceId = interOrgContract.id
     - projectSourceId = 从关联收入合同继承
     - amount = settlementAmount
     - status = "未收"
```

### 4.2 收款操作

出纳在「财务→收入」页面操作收款，与收入合同收款流程完全一致：
1. 列表中展示 sourceType=inter_org_contract 的应收记录
2. 点击"收款" → 弹出收款登记弹窗
3. 填写收款金额、收款形式、账户等信息
4. 提交 → 创建 ReceiptVoucher，同步更新 Receivable.paidAmount 和 status

### 4.3 付款方视角

内部结算合同的付款方（如分公司）需要向收款方（如总公司）付款时：
- 走现有的付款申请流程（PaymentApplication）
- 付款申请的 sourceType 可关联到 inter_org_contract
- 审批通过后创建 PaymentVoucher

此链路与现有支出合同付款流程一致，后续可根据需要打通。

## 5. 发票管理

### 5.1 发票关联

Invoice.sourceType 新增 `inter_org_contract` 类型。

内部结算开票时：
- 所属主体 = 开票方（分公司、总公司、咨询公司等）
- sourceType = "inter_org_contract"
- sourceId = InterOrgContract.id
- sellerName / sellerTaxNo → 自动填入开票主体信息
- buyerName / buyerTaxNo → 自动填入收票主体信息

### 5.2 发票流向

| 场景 | 开票方→收票方 | sourceType |
|------|-------------|-----------|
| 管理费发票 | 开票方（收款方）→ 付款方 | inter_org_contract |

### 5.3 前端发票登记

在内部结算合同详情页增加"开票登记"按钮，与收入合同开票登记流程一致：
- 弹出开票登记弹窗
- 填写发票信息
- 提交 → POST /api/invoices

## 6. 审批流

### 6.1 业务类型注册

已在 module-config.ts 注册：
```
{ key: "inter_org_contract", name: "内部结算合同", group: "合同管理" }
```

需确认审批流配置页能正常展示此模块（如种子数据未同步则运行 seed）。

### 6.2 审批节点

与现有收入合同审批流一致：
- 节点1：发起（申请人）
- 节点2~N：业务审批
- 审批通过后 → 自动创建应收记录

### 6.3 合同归档

审批流中增加"归档"节点，与收入合同归档机制一致：
- 上传扫描件 → 调用 /api/upload → OSS → 获取URL
- 调用归档API → 更新 InterOrgContract.archivedUrl + 状态变"已归档"

## 7. 界面变更

### 7.1 收入/支出合同表单增加"所属主体"

收入合同新增/编辑表单（income/page.tsx）增加字段：
- **所属主体**（Organization）：下拉选择，默认=总公司
- 选择主体后，收款账户下拉列表自动筛选该主体下的银行账户

支出合同新增/编辑表单（expense/page.tsx）增加字段：
- **所属主体**（Organization）：下拉选择，默认=总公司
- 选择主体后，付款账户下拉列表自动筛选该主体下的银行账户

### 7.2 列表页增加筛选条件

各业务列表页（合同、发票、收付款）增加筛选条件：
- **所属主体**：下拉筛选（默认=总公司）

### 7.3 内部结算合同列表页统一操作栏

与收入合同列表页保持一致：
- **查看**：点击进入详情页
- **编辑**：权限控制，有条件显示（草稿/待审批状态可编辑）
- **删除**：权限控制，有条件显示（草稿状态可删除）
- **提交审批**：草稿状态时显示
- **合同归档**：已批准状态时显示（上传扫描件）

### 7.4 内部结算合同新增/编辑表单

```
基本信息
├── 合同编号（必填）
├── 合同名称（必填）
├── 收款方/开票方（下拉选择Organization，必填）
├── 付款方（下拉选择Organization，必填）

关联主合同
├── 选择收入合同（搜索选择器，仅显示有项目的收入合同，必填）
├── 主合同金额（自动带出，只读显示）

费用信息
├── 管理费（金额，必填）
├── 税费承担（金额，默认0）
├── 其他费用（金额，默认0）
├── 其他费用说明（文本框，其他费用>0时必填）
├── 结算合同额（自动计算，只读显示）
    = 主合同金额 - 管理费 - 税费承担 - 其他费用

备注（文本框，可选）
```

### 7.5 内部结算合同详情页

```
基本信息区块（同收入合同详情样式）

关联主合同区块
├── 主合同编号、名称、客户、金额、状态
├── 点击可跳转到主合同详情页

费用信息区块
├── 主合同金额（只读）
├── 管理费、税费承担、其他费用（含说明）
├── 结算合同额

管理费坐扣进度 → 移除（原设计已废弃）

收款记录区块
├── 关联的 Receivable 状态
├── 收款历史列表（ReceiptVoucher 列表）

发票记录区块
├── 已开发票列表
├── 开票登记按钮

扫描件/归档区块
├── 归档文件列表
├── 上传扫描件按钮（审批归档节点）

操作按钮
├── 编辑、删除（草稿状态）
├── 提交审批（草稿状态）
├── 合同归档（已批准状态）
```

### 7.6 新增菜单

侧边栏 **合同管理** 下新增：
- **内部结算** → `/contracts/internal-settlement`

## 8. 合同变更单（ContractChangeOrder）

### 8.1 需求背景

已批准/已归档的合同，因业务变化需要调整金额或其他字段时，当前系统通过审批流锁定合同，仅有管理员可直接修改（无记录）。需要为普通用户提供正规的合同变更通道，所有变更留痕可追溯。

### 8.2 数据模型

```
ContractChangeOrder
  id                  String    @id @default(cuid())
  changeNo            String    // 变更单编号（自动生成）
  contractType        String    // 合同类型：income_contract / expense_contract / inter_org_contract
  contractId          String    // 关联合同ID

  // 变更原因
  changeReason        String    // 变更原因（必填）

  // 变更前快照（发起时自动记录，只读）
  previousAmount      Decimal   // 变更前合同金额
  previousData        Json      // 变更前其他字段的快照

  // 变更后值（用户填写）
  newAmount           Decimal   // 变更后合同金额
  newData             Json      // 变更后的其他字段值，格式：{"fieldName": newValue, ...}
                                // 只存有变更的字段（合同概要、付款方式、税率、计价方式、分期方案等）

  // 差额
  amountDifference    Decimal   // newAmount - previousAmount（正增负减）

  // 超收标记（金额减少时）
  hasOverCollection   Boolean   // 是否超收（已收金额 > 新金额）
  overCollectionAmount Decimal? // 超收金额

  // 新文件
  newFiles            Json      // 新增的归档文件URL数组（可选，如补充协议扫描件）
                                // 审批通过后追加到原合同的 archivedUrl

  // 状态
  status              String    // 草稿→待审批→已批准→已生效 / 已驳回
  approvalInstanceId  String?
  remark              String?
  createdAt           DateTime
  updatedAt           DateTime
  createdById         String?
  lastModifiedBy      String?
```

### 8.3 业务流程

```
① 合同已批准 / 已归档
  │
  ├── 普通用户：操作栏"发起变更"按钮 → 新建变更单
  └── 管理员：可直接编辑（已有权限），也可走变更单
       │
       ↓
② 变更单表单
  ├── 关联合同信息（只读）
  ├── 变更原因（必填文本框）
  ├── 变更后金额（必填）
  ├── 其他可变更字段：
  │   ├── 合同概要（contractSummary）
  │   ├── 付款方式（paymentTerms）
  │   ├── 税率（taxRate）
  │   ├── 计价方式（pricingMethod）
  │   ├── 分期方案（splitStages，仅收入合同）
  │   └── 其他文本/金额字段
  ├── 新文件上传（可选，如补充协议扫描件）
  └── 提交审批
       │
       ↓
③ 审批流（与合同审批机制一致）
  ├── 节点1：发起
  ├── 节点2~N：业务审批
  └── 审批通过 / 驳回
       │
       ↓
④ 审批通过 → 自动执行变更
  ├── 1) 更新原合同字段
  │   ├── totalAmount = 变更单.newAmount
  │   └── 其他字段逐个应用（newData 中的字段）
  │
  ├── 2) 调整应收/应付记录
  │   ├── 查原 Receivable（收入合同）或 Payable（支出合同）
  │   ├── 更新 amount = 新合同金额
  │   ├── 如果已收金额 > 新金额：
  │   │   ├── hasOverCollection = true
  │   │   ├── overCollectionAmount = 已收 - 新金额
  │   │   └── 应收状态保持当前值不做回退
  │   └── 如果分期方案变了，重建分期应收记录
  │
  ├── 3) 归档文件处理
  │   ├── 原归档文件保留（不可删除，审计需要）
  │   └── 新文件追加到原合同 archivedUrl 数组尾部
  │
  ├── 4) 变更单状态 → "已生效"
  └── 5) 合同状态 → 不变（保持原状态）
       │
       ↓
⑤ 合同详情页
  ├── 显示最新合同金额
  └── "变更历史"区块：列出所有关联的变更单（含变更前后对比）
```

### 8.4 界面变更

**合同详情页操作栏**（收入/支出/内部结算合同）：

```
[查看] [编辑(草稿)] [删除(草稿)] [发起变更] [提交审批] [合同归档]
                                  ↑ 新增按钮
                                  仅在已批准/已归档状态显示
                                  普通用户和管理员均可见
```

**变更单列表页**：
- 新增菜单：合同管理 → 合同变更 `/contracts/change-orders`
- 列表展示：变更单编号、关联合同、变更前金额→变更后金额、差额、状态
- 操作栏：查看详情、编辑（草稿状态）、删除（草稿状态）、提交审批

**变更单详情页**：
- 关联合同信息（可跳转到原合同）
- 变更前后对比表（字段名 | 变更前值 | 变更后值）
- 变更原因
- 新文件列表
- 审批进度
- 超收标记（如有）

**合同详情页新增"变更历史"区块**：
- 展示该合同的所有变更单记录
- 每条显示：变更单编号、变更时间、变更前后金额、状态

### 8.5 审批流

- 审批流配置模块新增 `contract_change_order` 业务类型
- 可在 module-config.ts 注册：
  ```
  { key: "contract_change_order", name: "合同变更", group: "合同管理" }
  ```
- 审批节点与现有合同审批流一致

### 8.6 归档文件规则

| 操作 | 是否支持 | 说明 |
|------|---------|------|
| 归档前删除文件 | ✅ | 上传弹窗中每个文件有删除按钮 |
| 归档后删除文件 | ❌ | 不可删除，审计需要保留原始凭证 |
| 变更时追加文件 | ✅ | 新文件通过变更单上传，审批通过后追加到 archivedUrl |
| 变更后归档 | ✅ | 无新文件则点"归档确认"即可，原文件不变 |

## 9. 实施阶段

### 第一阶段：核心数据模型（已完成）
- [x] 创建 Organization 模型 + 种子数据
- [x] 现有模型加 organizationId
- [x] BankAccount 关联 Organization
- [x] 运行 npx prisma validate + db push

### 第二阶段：所属主体表单改造
- [ ] 收入合同表单增加"所属主体"下拉选择（默认=总公司）
- [ ] 支出合同表单增加"所属主体"下拉选择（默认=总公司）
- [ ] 收入/支出合同收款/付款账户按主体筛选
- [ ] 列表页增加"所属主体"筛选器

### 第三阶段：InterOrgContract 模型重构
- [ ] 更新 schema.prisma：修改 InterOrgContract 模型字段
  - 删除：type 枚举中的 INTERNAL_SERVICE、REIMBURSEMENT、OTHER
  - 删除：settlementType、managementFeeRate、deductedAmount、remainingAmount
  - 删除：relatedContractType（仅关联收入合同）
  - 新增：managementFee、taxBurden、otherFee、otherFeeNote、settlementAmount、mainContractAmount
  - 新增：archivedUrl
- [ ] 在 IncomeContract 上新增 interOrgContractId 字段（关联标记）
- [ ] 运行 npx prisma validate + db push
- [ ] 更新审批引擎 approval-engine.ts：增加 inter_org_contract 分支，审批通过后自动创建 Receivable
- [ ] 更新 Receivable API：支持查询 inter_org_contract 来源的应收记录（含关联合同信息）
- [ ] 更新 Invoice API：前端的 sourceTypeOptions 增加 inter_org_contract

### 第四阶段：内部结算模块重写
- [ ] 新建页面：重写表单，按新字段结构（关联主合同、管理费、税费承担、其他费用、结算合同额）
- [ ] 详情页：重写展示（关联主合同详情、收款历史、发票记录、归档文件）
- [ ] 列表页：统一操作栏（查看/编辑/删除/提交审批/归档）
- [ ] API 路由：更新 CRUD 逻辑
- [ ] 关联合同选择器：仅展示有项目的收入合同
- [ ] 关联合同标记逻辑：写入/清除 IncomeContract.interOrgContractId
- [ ] 内部结算合同发票登记（详情页开票按钮）
- [ ] 内部结算合同归档功能（扫描件上传）

### 第五阶段：合同变更单模块
- [ ] 创建 ContractChangeOrder 模型 + 运行 db push
- [ ] 注册 contract_change_order 审批业务类型（module-config.ts + seed）
- [ ] 变更单 CRUD API 路由
- [ ] 变更单列表页（`/contracts/change-orders`）
- [ ] 变更单新增/编辑/详情页
- [ ] 变更单审批流对接（审批引擎新增 contract_change_order 分支）
- [ ] 变更通过后自动更新合同字段逻辑
- [ ] 变更通过后自动调整应收/应付记录逻辑
- [ ] 变更通过后归档文件追加逻辑
- [ ] 原合同详情页"发起变更"按钮 + "变更历史"区块
- [ ] 超收标记处理

### 第六阶段：收尾
- [ ] 验证审批流配置页正常展示内部结算合同模块（如缺则运行 seed）
- [ ] 验证审批流配置页正常展示合同变更模块（如缺则运行 seed）
- [ ] 回归验证
