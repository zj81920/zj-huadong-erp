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

新增模型，处理总分公司之间、挂靠公司与咨询公司之间的内部结算。

```
InterOrgContract
  id                    String    @id @default(cuid())
  contractNo            String    // 合同编号
  contractName          String    // 合同名称
  fromOrgId             String    // 收款方/开票方（如总公司、挂靠公司）
  toOrgId               String    // 付款方（如分公司、咨询公司）
  type                  String    // MANAGEMENT_FEE / INTERNAL_SERVICE / REIMBURSEMENT / OTHER
  settlementType        String    // NETTED（坐扣）/ SEPARATE（单独支付）
  relatedContractId     String?   // 关联外部合同ID
  relatedContractType   String?   // 关联外部合同类型（income_contract / expense_contract）
  projectId             String?   // 关联项目
  totalAmount           Decimal   // 合同总金额
  managementFeeRate     Decimal?  // 管理费率（%）
  managementFeeTotal    Decimal   // 管理费总额
  deductedAmount        Decimal   // 已扣管理费（坐扣模式追踪）
  remainingAmount       Decimal   // 剩余管理费
  status                String    // 待审批 / 已批准 / 执行中 / 已付款 / 已完成
  approvalInstanceId    String?
  remark                String?
  createdAt             DateTime
  updatedAt             DateTime
```

### 2.4 BankAccount 关联 Organization

```
BankAccount
  ...现有字段
  organizationId  String?  // 归属主体，null 表示共享账户
```

## 3. 业务场景映射

### 3.1 收入场景 1：客户签总公司（占90%）

```
客户 →[合同]→ 总公司（所属主体=总公司，签约方=客户）
客户 →[付款]→ 总公司账户
总公司 →[内部合同(管理费坐扣)]→ 分公司
总公司扣管理费后 →[净额]→ 分公司
分公司 →[发票]→ 总公司
```

操作流程：
1. 录收入合同 → 所属主体=总公司
2. 录内部结算合同 → type=MANAGEMENT_FEE, settlementType=NETTED
3. 关联内部结算到收入合同
4. 录入客户收款（总公司账户）
5. 录入本次扣管理费金额（人工输入）
6. 系统计算净额，生成待支付记录

### 3.2 收入场景 2a：客户签分公司，单独付管理费

```
客户 →[合同][付款][发票]→ 分公司
分公司 →[内部合同(管理费单独付)]→ 总公司
总公司 →[发票]→ 分公司
分公司 →[付款]→ 总公司
```

### 3.3 收入场景 2b：客户签分公司，管理费从场景1抵扣

```
客户 →[合同][付款][发票]→ 分公司
管理费从场景1的收款中抵扣（NETTED，关联到场景1的合同）
```

### 3.4 支出场景：总公司代付

```
总公司 →[合同]→ 供应商
总公司 →[付款]→ 供应商
分公司 →[内部合同(代付结算,SEPARATE)]→ 总公司
分公司 →[还款]→ 总公司
```

### 3.5 内部服务场景

```
总公司 →[内部合同(内部服务,SEPARATE)]→ 分公司
总公司 →[发票]→ 分公司
分公司 →[付款]→ 总公司
```

### 3.6 挂靠场景

```
客户 →[合同][付款][发票]→ 挂靠公司
挂靠公司 →[内部合同(管理费坐扣)]→ 咨询公司
挂靠公司扣管理费后 →[净额]→ 咨询公司
咨询公司 →[发票]→ 挂靠公司
```

## 4. 管理费坐扣逻辑

### 4.1 数据结构

InterOrgContract 中管理费相关字段：
- `managementFeeTotal`：合同约定的管理费总额
- `deductedAmount`：已扣管理费累计
- `remainingAmount`：剩余待扣管理费（= managementFeeTotal - deductedAmount）

### 4.2 操作流程

```
每笔收款凭证录入时：
  1. 选择所属主体（如总公司、挂靠公司）
  2. 选择对应的收入合同
  3. 系统检测该合同有关联的 InterOrgContract（type=MANAGEMENT_FEE, settlementType=NETTED）
  4. 显示：总管理费¥X，已扣¥Y，剩余¥Z
  5. 人工输入：本次扣管理费 ¥___
  6. 校验：本次扣 ≤ remainingAmount
  7. 确认后：
     - deductedAmount += 本次扣
     - remainingAmount -= 本次扣
     - 生成支付记录（总公司→分公司净额）
  8. 当 remainingAmount = 0 时，该内部合同状态→已完成
```

## 5. 发票管理

### 5.1 发票关联

Invoice.sourceType 新增 `inter_org_contract` 类型。

内部结算开票时：
- 所属主体 = 开票方（分公司、总公司、咨询公司等）
- sourceType = "inter_org_contract"
- sourceId = InterOrgContract.id
- sellerName / sellerTaxNo → 自动填入开票主体信息
- buyerName / buyerTaxNo → 自动填入收票主体信息

### 5.2 各场景发票流向

| 场景 | 开票方→收票方 | sourceType |
|------|-------------|-----------|
| 场景1 管理费 | 分公司→总公司 | inter_org_contract |
| 场景2a 管理费 | 总公司→分公司 | inter_org_contract |
| 技术服务费 | 总公司→分公司 | inter_org_contract |
| 挂靠结算 | 咨询公司→挂靠公司 | inter_org_contract |

## 6. 审批流

### 6.1 新增业务类型

在 module-config.ts 新增：
```
{ key: "inter_org_contract", name: "内部结算合同", group: "合同管理" }
```

### 6.2 审批节点

内部结算合同审批流可配置（与现有收入合同审批流一致）：
- 节点1：发起（申请人）
- 节点2~N：业务审批
- 节点N+1（可选）：支付节点（仅在 settlementType=SEPARATE 时需要）

### 6.3 坐扣类型无支付节点

settlementType=NETTED 类型的内部结算合同，审批通过后进入"执行中"状态，支付通过收款凭证录入时的坐扣操作触发，不走单独的付款审批。

## 7. 界面变更

### 7.1 列表页

各业务列表页（合同、发票、收付款）增加筛选条件：
- **所属主体**：下拉筛选（默认=分公司）

### 7.2 新增/编辑表单

所有合同、发票、收付款表单增加字段：
- **所属主体**（Organization）：下拉选择
- 默认值 = 分公司

### 7.3 新增菜单

侧边栏 **合同管理** 下新增：
- **内部结算** → `/contracts/internal-settlement`
  - 列表页：所有内部结算合同
  - 新增/编辑/详情页
  - 支持关联外部合同、查看坐扣进度

### 7.4 收款凭证录入增加坐扣操作

在收款凭证页，当关联的收入合同有 NETTED 类型的内部结算时：
- 显示"管理费坐扣"区块
- 展示：总管理费、已扣、剩余
- 可输入：本次扣管理费
- 自动计算：本次打款净额

## 8. 实施阶段

### 第一阶段：核心数据模型
- 创建 Organization 模型 + 种子数据
- 现有模型加 organizationId
- BankAccount 关联 Organization
- 运行 npx prisma validate + db push

### 第二阶段：业务流程改造
- 各模块表单增加"所属主体"字段
- 列表增加筛选器
- 报表增加主体维度

### 第三阶段：内部结算模块
- 创建 InterOrgContract 模型
- 审批流新增 inter_org_contract 类型
- 内部结算页面（CRUD + 审批流对接）
- 收款凭证坐扣操作

### 第四阶段：收尾
- 挂靠场景完整支持
- 发票关联 inter_org_contract
- 回归验证
