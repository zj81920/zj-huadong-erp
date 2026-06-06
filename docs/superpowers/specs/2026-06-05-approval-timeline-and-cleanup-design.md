# 审批时间线补齐 + 流程模块清理设计方案

## 背景

- 部分模块已有"提交审批"功能，但详情弹窗未显示审批时间线，用户体验不一致
- 部分不在流程设置侧边栏的模块仍残留了审批流程相关功能，需清理
- 电子签名在审批时间线中已有完整实现（`SignatureImage` 组件），无需额外开发

## 改动清单

### 一、2 个模块补齐审批时间线（核心）

#### 1. 合同变更（`contract_change_order`）

**文件**: `src/app/(dashboard)/contracts/change-orders/page.tsx`

将详情 Modal 中的 `<ContractChangeOrderDetailCard>` 用 `<DetailPageLayout>` 包裹，参考收入合同的实现方式：

```
Before:
  <ContractChangeOrderDetailCard data={detailOrder} />

After:
  <DetailPageLayout
    title={detailOrder.changeNo}
    instanceId={detailOrder.approvalInstanceId}
    businessType="contract_change_order"
    businessId={detailOrder.id}
  >
    <ContractChangeOrderDetailCard data={detailOrder} />
  </DetailPageLayout>
```

同时需在接口类型 `ChangeOrder` 中添加 `approvalInstanceId` 字段。

#### 2. 内部结算合同（`inter_org_contract`）

**文件**: `src/app/(dashboard)/contracts/internal-settlement/page.tsx`

将详情 Modal 中的 `<InterOrgContractDetailCard>` 用 `<DetailPageLayout>` 包裹：

```
Before:
  <InterOrgContractDetailCard data={viewContract} />

After:
  <DetailPageLayout
    title={viewContract.contractName}
    instanceId={viewContract.approvalInstanceId}
    businessType="inter_org_contract"
    businessId={viewContract.id}
  >
    <InterOrgContractDetailCard data={viewContract} />
  </DetailPageLayout>
```

同时需在前端接口类型中添加 `approvalInstanceId` 字段。

### 二、供应商变更注册为独立审批流程

1. **`src/lib/module-config.ts`** — 在 MODULE_CONFIG 中添加 `supplier_change` 条目
2. **新增 `SupplierChangeDetailCard`** — 在 `src/components/detail-cards/` 下创建，注册到 DETAIL_CARD_MAP
3. **`src/lib/approval-engine.ts`** — 在 `updateBusinessStatus` 中添加 `supplier_change` case
4. **`src/app/(dashboard)/approvals/page.tsx`** — 在 `BUSINESS_TYPE_LABELS` 和 `BUSINESS_TYPE_API_MAP` 中添加 `supplier_change`

### 三、3 个模块简化成纯 CRUD

1. **报价管理（`quotation`）**
   - 去掉详情 Modal 中的 `DetailPageLayout` 包裹，改用普通 Modal + `QuotationDetailCard`
   - 去掉 `approvalStatus` 相关的状态筛选、状态徽章、统计卡片
   - 清理接口类型中的 `approvalStatus`、`approvalInstanceId` 字段
   - 清理审批页面（`approvals/page.tsx`）中对 `quotation` 的注册

2. **非合同收入（`non_contract_income`）**
   - 去掉审批页面中的 `non_contract_income` 注册
   - 保留 `AdminStatusOverride` 供管理员直接修改状态

3. **其他借款（`other_borrowing`）**
   - 去掉审批页面中的 `other_borrowing` 注册
   - 保留 `AdminStatusOverride` 供管理员直接修改状态

### 四、清理数据库废弃字段

清理以下模型中存在但无功能使用的审批相关字段：

| 模型 | 清理字段 |
|------|---------|
| `ProjectBudget` | `approvalStatus` + `approvalInstanceId` |
| `LoanRequest` | `approvalInstanceId` |
| `Invoice` | `approvalInstanceId` |

## 实现顺序

1. **数据库清理**（第四部分）— 先改 schema，确保 `prisma validate` + `prisma db push` 通过
2. **3 个模块简化**（第三部分）— 先去掉不用的功能，降低干扰
3. **SupplierChange 注册**（第二部分）— 补全新流程
4. **2 个模块加时间线**（第一部分）— 核心需求

## 验证方式

- `npx prisma validate` — Schema 合法性
- `npx prisma db push` — 数据库同步
- `npx next build` — 构建验证
- `npx vitest run test/unit/detail-cards-registration.test.ts` — DetailCard 注册验证
- `bash scripts/verify.sh` — 回归验证
