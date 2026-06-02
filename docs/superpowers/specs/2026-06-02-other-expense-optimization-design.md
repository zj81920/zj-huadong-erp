# 其他支出优化 — 设计方案

**日期**: 2026-06-02
**状态**: 已审批

---

## 背景

当前"其他支出"模块存在 4 个待修复问题：

1. 交易对方字段为普通 input，无法搜索/选择往来信息库中的记录
2. 提交/审批后交易对方信息未成功保存到往来信息库
3. 详情页不显示对方的银行账户信息
4. 发票登记时机不灵活：有时发起时就有发票，有时支付后才有发票

---

## 方案选择

采用**集中修复方案（方案 A）**，一次性修复全部 4 个问题。改动集中在 `finance/expense/page.tsx` 及相关后端路由。

---

## 模块一：交易对方搜索（问题 1）

### 当前状态

[`finance/expense/page.tsx` 第 2593-2601 行] 中交易对方字段为普通 `<input>`。

### 目标

替换为现有的 [`CounterpartySearch`] 组件，支持搜索往来信息库并自动回填银行信息。

### 实现

将普通 `<input>` 替换为 `CounterpartySearch` 组件，选中建议后自动回填 `counterpartyBankName` 和 `counterpartyBankAccount`。

---

## 模块二：往来信息保存修复（问题 2）

### 当前状态

[`/api/counterparty/route.ts`] POST 接口要求 `isAdmin` 权限（第 49 行）。非管理员提交支出时自动保存返回 403，被 [page.tsx 第 904 行] `.catch(() => {})` 静默吞掉。

### 目标和修复

- **POST `/api/counterparty`**：移除 `isAdmin` 检查，改为仅校验登录态（`getCurrentUser`），去重逻辑保持不变
- **前端自动保存**：`.catch(() => {})` 改为 `await` + `console.error` 显式日志
- **审批引擎**：[`approval-engine.ts`] `non_contract_expense` 终态处理中增加往来信息同步

> 手动管理往来信息（DELETE）仍保持 admin 限制。

---

## 模块三：详情页显示银行信息（问题 3）

### 当前状态

[`finance/expense/page.tsx` 第 3172-3244 行] 详情弹窗仅显示支出金额、日期、项目、说明和本方支付信息，不显示对方的 `counterpartyBankName` 和 `counterpartyBankAccount`。

### 实现

在基本信息区域新增"对方银行信息"卡片，跨两列布局，仅当有银行信息时显示，包含开户行和账号。

---

## 模块四：发票登记与状态管理（问题 4）

### 4.1 数据模型

**Invoice 表**：`status` 字段新增 `"待补票"` 值，移除无用的 `"草稿"` 默认值

**NonContractExpense 表**：新增字段

```prisma
invoiceStatus  String   @default("无需开票") @map("invoice_status")
// 枚举值：无需开票 | 待补票 | 已收票
```

### 4.2 状态流转

```
发起支出（有发票）──→ 录入发票 ──→ 发票=[已登记]  支出=[已收票]
发起支出（无发票）──→ 标记待补 ──→ 发票=无        支出=[待补票]
                                       │
                              支付后补录发票
                                       │
                                       ↓
                                 发票=[已登记]  支出=[已收票]
```

### 4.3 创建/编辑弹窗

表单底部新增"发票信息"区域：
- **有发票开关**：toggle，默认关闭
- **打开时**：显示简化的发票录入表单（发票号码、日期、金额、税率、扫描件上传），来源类型自动设为 `non_contract_expense`
- **关闭时**：支出 `invoiceStatus` = `"待补票"` 或 `"无需开票"`

### 4.4 详情弹窗

- 显示关联发票列表（通过 `/api/invoices?sourceType=non_contract_expense&sourceId=xxx`）
- **补录发票按钮**：当 `invoiceStatus === "待补票"` 时显示，补录后自动状态变为 `"已收票"`

### 4.5 发票管理页补充

- 筛选栏新增 `"待补票"` 筛选项
- 每条发票操作列增加**"作废"按钮**（仅"已登记"状态可作废）
- 作废发票时自动扣减关联模块的 `invoicedAmount`

### 4.6 发票状态完整定义

| 状态 | 说明 | 场景 |
|------|------|------|
| `待补票`（新增） | 发票尚未收到 | 发起其他支出时无发票，标记待补 |
| `已登记`（保留） | 发票已正常录入 | 发起时上传、或支付后补录 |
| `已作废`（补齐UI） | 发票无效 | 发票管理页手动作废，联动扣减 invoicedAmount |

---

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `prisma/schema.prisma` | Invoice.status 默认值调整；NonContractExpense 新增 invoiceStatus |
| `src/app/api/counterparty/route.ts` | POST 移除 isAdmin 限制 |
| `src/app/api/invoices/route.ts` | 兼容"待补票"状态 |
| `src/app/api/invoices/[id]/route.ts` | 作废时联动扣减 invoicedAmount |
| `src/app/(dashboard)/finance/expense/page.tsx` | 4 项全部改动 |
| `src/app/(dashboard)/finance/invoices/page.tsx` | 作废按钮 + 待补票筛选 + badge |
| `src/lib/approval-engine.ts` | non_contract_expense 终态同步往来信息 |

---

## 不变更项

- `CounterpartySearch.tsx`：组件已完善，直接复用
- `CounterpartyInfo` 模型：现有 name + bankName + bankAccount 去重逻辑已满足需求
- 审批引擎核心逻辑：不变，仅增加一行往来信息同步
