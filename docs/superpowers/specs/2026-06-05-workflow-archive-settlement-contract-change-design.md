# 内部结算合同与合同变更流程归档设计

## 1. 背景

当前系统中，收入合同 (`income_contract`) 和支出合同 (`expense_contract`) 的审批流终端节点自动设为 **归档 (archive)**，审批通过后必须上传盖章扫描件完成归档。而内部结算合同 (`inter_org_contract`) 和合同变更 (`contract_change_order`) 的审批流终端节点为普通审批节点，缺少归档步骤。

## 2. 目标

1. 内部结算合同和合同变更的审批流终端节点增加归档步骤，与收入/支出合同保持一致
2. 调整"发起变更"入口：在合同"已归档"状态下显示，非"已批准"状态
3. 合同变更归档：复用相同的文件上传窗口，但上传为可选（非必填）
4. 内部结算合同增加"发起变更"入口

## 3. 状态流转

### 3.1 收入/支出/内部结算合同

```
草稿 → 提交审批 → 审批节点通过 → 归档节点(必须上传扫描件) → 合同归档
                                                               ↓
                                                         发起变更
```

### 3.2 合同变更

```
草稿 → 提交审批 → 审批节点通过 → 归档节点(文件可选上传) → 已归档
```

## 4. 变更详情

### 4.1 流程设置 — CONTRACT_MODULES

**文件：** `src/app/(dashboard)/settings/approval-flow/page.tsx`

- 在 `CONTRACT_MODULES` 数组中添加 `"inter_org_contract"` 和 `"contract_change_order"`
- 这两个模块的终端节点自动变为 `"archive"` 类型
- 流程编辑器中自动显示"归档"标签

### 4.2 收入合同 — "发起变更"按钮迁移

**文件：** `src/app/(dashboard)/contracts/income/page.tsx`

- 当前：`contract.status === "已批准"` 时显示"发起变更"按钮
- 改为：`contract.status === "合同归档"` 时显示"发起变更"按钮
- 跳转目标不变：`/contracts/change-orders/new?contractType=income_contract&contractId=...`

### 4.3 支出合同 — "发起变更"按钮迁移

**文件：** `src/app/(dashboard)/contracts/expense/page.tsx`

- 同收入合同改动：`contract.status === "已批准"` → `contract.status === "合同归档"`
- 跳转目标不变

### 4.4 内部结算合同 — 新增归档弹窗 + "发起变更"按钮

**文件：** `src/app/(dashboard)/contracts/internal-settlement/page.tsx`

- **新增归档弹窗**：与收入合同归档弹窗行为一致
  - 弹出 Modal，要求上传盖章扫描件（至少1个文件）
  - 确认后调用 PUT API 更新状态为"合同归档"，保存 `archivedUrl`
  - 这个弹窗可以由"已批准"状态下的操作触发

- **新增"发起变更"按钮**：在 `contract.status === "合同归档"` 时显示
  - 跳转到 `/contracts/change-orders/new?contractType=inter_org_contract&contractId=...`

### 4.5 合同变更 — 新增归档弹窗

**文件：** `src/app/(dashboard)/contracts/change-orders/page.tsx`

- 当前变更单状态：草稿 → 待审批 → 已批准 → 已生效
- 新增状态：草稿 → 待审批 → 已批准 → 待归档 → 已归档
- 在审批通过进入归档节点后，变更单状态变为"待归档"
- 归档弹窗：
  - 同正常合同的归档上传窗口 UI
  - 上传文件为**可选**（按钮始终可用）
  - 若无文件上传 → 直接归档（标记为已归档）
  - 若有文件上传 → 文件保存到变更单的 `archivedUrl` 字段

### 4.6 审批引擎 — 合同变更归档适配

**文件：** `src/lib/approval-engine.ts`

当前 `updateBusinessStatus` 对 `contract_change_order` 的处理（"已批准"时）：
1. 更新关联合同金额
2. 调整应收/应付记录
3. 合并 `newFiles` 到原合同的 `archivedUrl`
4. 将变更单状态设为"已生效"

需要调整为：
- **审批通过时（"已批准"）**：执行 1-3 步业务逻辑，变更单状态设为"已批准"
- **归档执行时（"已归档"）**：变更单状态设为"已归档"（或"已生效"）

### 4.7 审批引擎 — 合同变更归档节点到达

- 当最后一个审批节点通过、下一节点是 `archive` 时：
  - `updateBusinessStatus(businessType, businessId, "已批准")` → 执行现有业务逻辑
  - 审批实例状态设为"审批中"，指向归档节点
  - 返回 `"待归档"`

- 用户执行归档动作时：
  - 若未上传文件 → `archivedUrl` 为 null
  - 若上传了文件 → `archivedUrl` 保存文件列表
  - 变更单状态更新为"已归档"

## 5. 涉及文件清单

| # | 文件 | 改动类型 | 说明 |
|---|------|----------|------|
| 1 | `src/app/(dashboard)/settings/approval-flow/page.tsx` | 修改 | `CONTRACT_MODULES` 加 2 个模块 |
| 2 | `src/app/(dashboard)/contracts/income/page.tsx` | 修改 | "发起变更"按钮移到"合同归档"状态 |
| 3 | `src/app/(dashboard)/contracts/expense/page.tsx` | 修改 | 同上 |
| 4 | `src/app/(dashboard)/contracts/internal-settlement/page.tsx` | 修改 | 新增归档弹窗 + "发起变更"按钮 |
| 5 | `src/app/(dashboard)/contracts/change-orders/page.tsx` | 修改 | 新增归档弹窗（可选上传） |
| 6 | `src/lib/approval-engine.ts` | 修改 | `contract_change_order` 的归档逻辑适配 |

## 6. 验证方式

1. **流程设置页面**：选择内部结算合同/合同变更，确认终端节点显示"归档"标签
2. **收入/支出合同**：审批通过进入"待归档" → 归档弹窗要求文件 → 归档后显示"合同归档" → 显示"发起变更"按钮
3. **内部结算合同**：同收入合同行为 + "发起变更"按钮
4. **合同变更**：审批通过进入"待归档" → 归档弹窗（文件可选）→ 归档后变为"已归档"
5. **回归验证**：确认现有收入/支出合同的归档行为不受影响
