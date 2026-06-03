# 其他支出优化 实施计划

> **对于 agentic workers：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施此计划。步骤使用复选框 (`- [ ]`) 语法跟踪。

**目标：** 修复其他支出模块的 4 个问题：交易对方搜索、往来信息保存、详情页银行信息、发票登记与状态管理。

**架构：** 改动集中在 `finance/expense/page.tsx` 及相关后端路由。复用现有 `CounterpartySearch` 组件和 `Invoice` 模型。新增 `NonContractExpense.invoiceStatus` 追踪字段。

**技术栈：** Next.js 14 App Router, Prisma, TypeScript, React Hooks, Tailwind CSS

---

### 文件结构

| 文件 | 职责 | 改动类型 |
|------|------|---------|
| `prisma/schema.prisma` | Invoice 默认值调整 + NonContractExpense 新增字段 | 修改 |
| `src/app/api/counterparty/route.ts` | 放开 POST 的 admin 限制 | 修改 |
| `src/app/api/invoices/[id]/route.ts` | 作废发票时联动扣减 invoicedAmount | 修改 |
| `src/app/(dashboard)/finance/expense/page.tsx` | 四项全部改动 | 修改 |
| `src/app/(dashboard)/finance/invoices/page.tsx` | 作废按钮 + 待补票筛选 + badge | 修改 |
| `src/lib/approval-engine.ts` | non_contract_expense 终态同步往来信息 | 修改 |

---

### Task 1: Prisma Schema 变更

**Files:**
- Modify: `prisma/schema.prisma:666-689`
- Modify: `prisma/schema.prisma:887-916`

- [ ] **Step 1: Invoice.status 移除无用的"草稿"默认值，改为无默认值**

```prisma
// 修改前 (line 905)
  status             String   @default("草稿")

// 修改后
  status             String   @default("已登记")
```

- [ ] **Step 2: NonContractExpense 新增 invoiceStatus 字段**

在 `invoicedAmount` 字段后面（第 677 行后）新增：

```prisma
  invoicedAmount     Decimal  @default(0) @map("invoiced_amount") @db.Decimal(15, 2)
  invoiceStatus      String   @default("无需开票") @map("invoice_status") // 新增：无需开票 | 待补票 | 已收票
```

- [ ] **Step 3: 验证 Schema 并推送数据库**

```bash
npx prisma validate
npx prisma db push
```

Expected: 无错误，`non_contract_expenses` 表新增 `invoice_status` 列，默认值为 `"无需开票"`。

- [ ] **Step 4: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat: Invoice.status 默认值改为已登记，NonContractExpense 新增 invoiceStatus 字段"
```

---

### Task 2: 往来信息 API — 放开 POST admin 限制

**Files:**
- Modify: `src/app/api/counterparty/route.ts:46-51`

- [ ] **Step 1: 移除 POST 的 isAdmin 检查**

```typescript
// 修改前 (line 48-51)
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
    }

// 修改后 — 仅校验登录态
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 403 });
    }
```

DELETE 方法的 `isAdmin` 检查保持不变（仅管理员可删除往来信息）。

- [ ] **Step 2: 提交**

```bash
git add src/app/api/counterparty/route.ts
git commit -m "fix: 放开往来信息自动保存的 admin 权限限制，仅校验登录态"
```

---

### Task 3: 发票 API — 作废联动扣减 invoicedAmount

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts:26-72`

- [ ] **Step 1: 在 PUT 中增加作废联动逻辑**

当前 PUT 已支持 `status` 字段更新（第 44 行）。需要在更新后检测 status 变化并扣减：

```typescript
// 在现有 prisma.invoice.update 之后（第 65 行后），return 之前插入：

    // 作废联动：发票作废时扣减关联模块的 invoicedAmount
    if (body.status === "已作废" && existing.status !== "已作废") {
      await updateRelatedInvoicedAmount(
        existing.sourceType,
        existing.sourceId,
        Number(existing.totalAmount),
        "subtract"
      );
    }
```

同时需要从文件底部（或 `invoices/route.ts`）复制 `updateRelatedInvoicedAmount` 函数到此文件，或将其提取为共享函数。当前 `[id]/route.ts` 底部已有该函数（第 99-141 行），直接复用。

- [ ] **Step 2: 删除发票时跳过已作废的扣减（避免重复扣减）**

当前 DELETE 无条件调用 `updateRelatedInvoicedAmount` 做扣减。如果发票先作废再删除，会重复扣减。修改第 88 行：

```typescript
// 修改前
    await updateRelatedInvoicedAmount(existing.sourceType, existing.sourceId, Number(existing.totalAmount), "subtract");

// 修改后 — 仅"已登记"状态才扣减（已作废的已在作废时扣过）
    if (existing.status !== "已作废") {
      await updateRelatedInvoicedAmount(existing.sourceType, existing.sourceId, Number(existing.totalAmount), "subtract");
    }
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/invoices/[id]/route.ts
git commit -m "feat: 发票作废时联动扣减 invoicedAmount，删除时避免重复扣减"
```

---

### Task 4: 发票管理页 — 作废按钮 + 待补票状态

**Files:**
- Modify: `src/app/(dashboard)/finance/invoices/page.tsx:136-151`

- [ ] **Step 1: 更新 statusConfig 和 statusFilters，新增"待补票"**

```tsx
// 修改 statusConfig（第 137-140 行）
const statusConfig: Record<string, { color: string; label: string }> = {
  已登记: { color: "ios-badge-blue", label: "已登记" },
  已作废: { color: "ios-badge-red", label: "已作废" },
  待补票: { color: "ios-badge-yellow", label: "待补票" },  // 新增
};

// 修改 statusFilters（第 148-152 行）
const statusFilters = [
  { value: "", label: "全部" },
  { value: "已登记", label: "已登记" },
  { value: "待补票", label: "待补票" },  // 新增
  { value: "已作废", label: "已作废" },
];
```

- [ ] **Step 2: 在操作列增加"作废"按钮**

在编辑按钮之后、删除按钮之前（第 740 行后）插入：

```tsx
{inv.status === "已登记" && (
  <button
    className="ios-btn ios-btn-ghost ios-btn-sm text-[#F97316]!"
    onClick={async (e) => {
      e.stopPropagation();
      if (!confirm(`确定要作废发票 ${inv.invoiceNo} 吗？此操作将扣减关联金额。`)) return;
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "已作废" }),
      });
      if (res.ok) {
        fetchInvoices();
      } else {
        const json = await res.json();
        alert(json.error || "操作失败");
      }
    }}
  >
    <Ban className="w-3.5 h-3.5" />
    作废
  </button>
)}
```

需要在文件顶部 `import` 中加入 `Ban` 图标（从 `lucide-react`）。

- [ ] **Step 3: 提交**

```bash
git add src/app/(dashboard)/finance/invoices/page.tsx
git commit -m "feat: 发票管理页增加作废按钮和待补票状态筛选"
```

---

### Task 5: 其他支出页 — 交易对方替换为 CounterpartySearch（问题 1）

**Files:**
- Modify: `src/app/(dashboard)/finance/expense/page.tsx` — 需先确认 import CounterpartySearch

- [ ] **Step 1: 确认文件顶部已 import CounterpartySearch**

查看第 1-40 行，如果没有则添加：
```tsx
import CounterpartySearch from "@/components/CounterpartySearch";
```

- [ ] **Step 2: 替换交易对方 input 为 CounterpartySearch 组件**

修改第 2593-2601 行：

```tsx
{/* 修改前 */}
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方</label>
  <input
    type="text"
    className="ios-input"
    placeholder="请输入交易对方"
    value={otherExpenseForm.counterparty}
    onChange={(e) => setOtherExpenseForm((p) => ({ ...p, counterparty: e.target.value }))}
  />
</div>

{/* 修改后 */}
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方</label>
  <CounterpartySearch
    value={otherExpenseForm.counterparty}
    onChange={(name) => setOtherExpenseForm((p) => ({ ...p, counterparty: name }))}
    onSelect={(record) =>
      setOtherExpenseForm((p) => ({
        ...p,
        counterpartyBankName: record.bankName || p.counterpartyBankName,
        counterpartyBankAccount: record.bankAccount || p.counterpartyBankAccount,
      }))
    }
    placeholder="请输入交易对方（可从往来信息中选择）"
  />
</div>
```

- [ ] **Step 3: 提交**

```bash
git add src/app/(dashboard)/finance/expense/page.tsx
git commit -m "feat: 其他支出交易对方替换为 CounterpartySearch 搜索组件"
```

---

### Task 6: 其他支出页 — 往来信息保存修复（问题 2）

**Files:**
- Modify: `src/app/(dashboard)/finance/expense/page.tsx:895-904`

- [ ] **Step 1: 将 .catch(() => {}) 改为 await + 错误日志**

```typescript
// 修改前 (line 895-904)
        if (otherExpenseForm.counterparty.trim()) {
          fetch("/api/counterparty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: otherExpenseForm.counterparty.trim(),
              bankName: otherExpenseForm.counterpartyBankName.trim() || null,
              bankAccount: otherExpenseForm.counterpartyBankAccount.trim() || null,
            }),
          }).catch(() => {});
        }

// 修改后
        if (otherExpenseForm.counterparty.trim()) {
          await fetch("/api/counterparty", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: otherExpenseForm.counterparty.trim(),
              bankName: otherExpenseForm.counterpartyBankName.trim() || null,
              bankAccount: otherExpenseForm.counterpartyBankAccount.trim() || null,
            }),
          }).catch((err) => {
            console.error("保存往来信息失败:", err);
          });
        }
```

注意：这里加 `await` 会让提交多等一小段时间，但确保请求发出后再关闭弹窗。

- [ ] **Step 2: 提交**

```bash
git add src/app/(dashboard)/finance/expense/page.tsx
git commit -m "fix: 往来信息自动保存改用 await，避免静默失败"
```

---

### Task 7: 其他支出页 — 详情弹窗显示对方银行信息（问题 3）

**Files:**
- Modify: `src/app/(dashboard)/finance/expense/page.tsx:3215-3217`

- [ ] **Step 1: 在"关联项目"下方新增对方银行信息卡片**

在 `</div>` 闭合（当前第 3217 行）之后、`{detailOtherExpense.description ...` 之前插入：

```tsx
            {(detailOtherExpense.counterpartyBankName || detailOtherExpense.counterpartyBankAccount) && (
              <div className="col-span-2 p-3 rounded-xl bg-[#FAFAF9] mt-2">
                <p className="text-[12px] text-[#78716C] mb-1">对方银行信息</p>
                <div className="flex items-center gap-4 text-[13px] text-[#1C1917]">
                  {detailOtherExpense.counterpartyBankName && (
                    <span>开户行：{detailOtherExpense.counterpartyBankName}</span>
                  )}
                  {detailOtherExpense.counterpartyBankAccount && (
                    <span>账号：{detailOtherExpense.counterpartyBankAccount}</span>
                  )}
                </div>
              </div>
            )}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/(dashboard)/finance/expense/page.tsx
git commit -m "feat: 其他支出详情页增加对方银行信息展示"
```

---

### Task 8: 其他支出页 — 发票登记与补录（问题 4）

**Files:**
- Modify: `src/app/(dashboard)/finance/expense/page.tsx`

这是最复杂的改动，涉及 4 个子步骤。

- [ ] **Step 1: 扩展前端类型和表单状态**

在 `NonContractExpense` 接口（约第 103 行）中新增：

```typescript
interface NonContractExpense {
  // ... 现有字段 ...
  invoiceStatus?: string;  // 新增
}
```

在 `emptyOtherExpenseForm`（约第 357 行）中新增 `invoiceStatus: "无需开票"` 和临时发票表单字段：

```typescript
const [otherExpenseForm, setOtherExpenseForm] = useState({
  amount: "",
  counterparty: "",
  counterpartyBankName: "",
  counterpartyBankAccount: "",
  transactionDate: "",
  description: "",
  projectSourceId: "",
  invoiceStatus: "无需开票",  // 新增
});

// 新增：发票表单状态（独立的，在创建支出弹窗内使用）
const [hasInvoice, setHasInvoice] = useState(false);
const [inlineInvoiceForm, setInlineInvoiceForm] = useState({
  invoiceNo: "",
  invoiceDate: "",
  amount: "",
  taxRate: "6",
  attachments: [] as string[],
});
```

- [ ] **Step 2: 在创建/编辑弹窗底部新增"发票信息"区域**

在弹窗中 `ProjectPicker` 之后、按钮区域之前（约第 2651 行之前）插入：

```tsx
          {/* 新增：发票信息区域 */}
          <div className="border-t border-[#F5F5F4] pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-[#1C1917]">发票信息</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[13px] text-[#78716C]">有发票</span>
                <input
                  type="checkbox"
                  className="ios-toggle"
                  checked={hasInvoice}
                  onChange={(e) => {
                    setHasInvoice(e.target.checked);
                    if (!e.target.checked) {
                      setOtherExpenseForm(p => ({ ...p, invoiceStatus: "待补票" }));
                    } else {
                      setOtherExpenseForm(p => ({ ...p, invoiceStatus: "已收票" }));
                    }
                  }}
                />
              </label>
            </div>
            {hasInvoice && (
              <div className="space-y-3 p-3 rounded-xl bg-[#FAFAF9]">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">发票号码 <span className="text-[#78716C]">*</span></label>
                    <input
                      type="text"
                      className="ios-input text-[13px]"
                      placeholder="请输入发票号码"
                      value={inlineInvoiceForm.invoiceNo}
                      onChange={(e) => setInlineInvoiceForm(p => ({ ...p, invoiceNo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">开票日期 <span className="text-[#78716C]">*</span></label>
                    <input
                      type="date"
                      className="ios-input text-[13px]"
                      value={inlineInvoiceForm.invoiceDate}
                      onChange={(e) => setInlineInvoiceForm(p => ({ ...p, invoiceDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">不含税金额</label>
                    <input
                      type="number"
                      className="ios-input text-[13px]"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={inlineInvoiceForm.amount}
                      onChange={(e) => setInlineInvoiceForm(p => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[#78716C] mb-1">税率（%）</label>
                    <input
                      type="number"
                      className="ios-input text-[13px]"
                      placeholder="6"
                      min="0"
                      max="100"
                      value={inlineInvoiceForm.taxRate}
                      onChange={(e) => setInlineInvoiceForm(p => ({ ...p, taxRate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
```

- [ ] **Step 3: 修改提交函数，同时创建发票和支出**

在 `handleSubmitOtherExpense` 中（约第 893 行 `res.ok` 之后），增加发票创建逻辑：

```typescript
      if (res.ok) {
        const createdExpense = json.data;  // 获取创建/更新后的支出记录

        // 如果有发票则创建
        if (hasInvoice && inlineInvoiceForm.invoiceNo.trim()) {
          const taxRate = Number(inlineInvoiceForm.taxRate) / 100;
          const amount = Number(inlineInvoiceForm.amount) || 0;
          const taxAmount = amount * taxRate;
          const totalAmount = amount + taxAmount;
          await fetch("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invoiceNo: inlineInvoiceForm.invoiceNo.trim(),
              invoiceType: "增值税普通发票",
              invoiceCategory: "收票",
              invoiceDate: inlineInvoiceForm.invoiceDate || otherExpenseForm.transactionDate,
              amount,
              taxRate,
              taxAmount,
              totalAmount: totalAmount || Number(otherExpenseForm.amount),
              sourceType: "non_contract_expense",
              sourceId: editingOtherExpense?.id || createdExpense?.id,
              sellerName: otherExpenseForm.counterparty.trim() || null,
              attachments: inlineInvoiceForm.attachments,
              status: "已登记",
            }),
          }).catch((err) => {
            console.error("创建发票失败:", err);
          });
        }

        // 原有往来信息保存逻辑
        if (otherExpenseForm.counterparty.trim()) {
```

- [ ] **Step 4: 详情弹窗增加发票信息卡片**

在详情弹窗中（支付信息卡片之前/之后，约第 3226 行附近），插入：

```tsx
            {/* 新增：发票信息卡片 */}
            {detailOtherExpense.invoiceStatus && detailOtherExpense.invoiceStatus !== "无需开票" && (
              <div className="p-3 rounded-xl bg-[#FFF9F0] border border-[#1C1917]/8">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold text-[#1C1917]">
                    发票状态：
                    <span className={detailOtherExpense.invoiceStatus === "已收票" ? "text-green-600" : "text-[#F97316]"}>
                      {detailOtherExpense.invoiceStatus}
                    </span>
                  </p>
                  {detailOtherExpense.invoiceStatus === "待补票" && (
                    <button
                      className="ios-btn ios-btn-sm ios-btn-primary text-[12px]"
                      onClick={async () => {
                        // 补录发票弹窗
                        setModalType("supplementInvoice");
                      }}
                    >
                      补录发票
                    </button>
                  )}
                </div>
                {/* 显示已关联的发票列表 */}
                {detailOtherExpense.invoicedAmount > 0 && (
                  <p className="text-[12px] text-[#78716C]">
                    已收票金额：{formatAmount(detailOtherExpense.invoicedAmount)}
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 5: 新增补录发票弹窗（复用现有发票录入表单）**

新增一个 Modal `modalType === "supplementInvoice"`，表单字段与 step 2 中内嵌发票表单一致，提交时调用 `POST /api/invoices`，且同步更新支出 `invoiceStatus` 为 `"已收票"`。

补录发票弹窗代码（插入到其他 Modal 之后）：

```tsx
      {/* 补录发票弹窗 */}
      <Modal
        isOpen={modalType === "supplementInvoice"}
        onClose={() => setModalType(null)}
        title="补录发票"
        maxWidth="480px"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">发票号码 <span className="text-[#78716C]">*</span></label>
              <input
                type="text"
                className="ios-input text-[13px]"
                value={inlineInvoiceForm.invoiceNo}
                onChange={(e) => setInlineInvoiceForm(p => ({ ...p, invoiceNo: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">开票日期 <span className="text-[#78716C]">*</span></label>
              <input
                type="date"
                className="ios-input text-[13px]"
                value={inlineInvoiceForm.invoiceDate}
                onChange={(e) => setInlineInvoiceForm(p => ({ ...p, invoiceDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">不含税金额</label>
              <input
                type="number"
                className="ios-input text-[13px]"
                min="0" step="0.01"
                value={inlineInvoiceForm.amount}
                onChange={(e) => setInlineInvoiceForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[#78716C] mb-1">税率（%）</label>
              <input
                type="number"
                className="ios-input text-[13px]"
                min="0" max="100"
                value={inlineInvoiceForm.taxRate}
                onChange={(e) => setInlineInvoiceForm(p => ({ ...p, taxRate: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-[#F5F5F4]">
            <button className="ios-btn ios-btn-secondary" onClick={() => { setModalType(null); setInlineInvoiceForm({ invoiceNo: "", invoiceDate: "", amount: "", taxRate: "6", attachments: [] }); }}>取消</button>
            <button
              className="ios-btn ios-btn-primary"
              onClick={async () => {
                if (!inlineInvoiceForm.invoiceNo.trim() || !inlineInvoiceForm.invoiceDate) {
                  alert("请填写发票号码和开票日期");
                  return;
                }
                const taxRate = Number(inlineInvoiceForm.taxRate) / 100;
                const amount = Number(inlineInvoiceForm.amount) || 0;
                const taxAmount = amount * taxRate;
                const totalAmount = amount + taxAmount;
                const res = await fetch("/api/invoices", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    invoiceNo: inlineInvoiceForm.invoiceNo.trim(),
                    invoiceType: "增值税普通发票",
                    invoiceCategory: "收票",
                    invoiceDate: inlineInvoiceForm.invoiceDate,
                    amount,
                    taxRate,
                    taxAmount,
                    totalAmount: totalAmount || Number(detailOtherExpense!.amount),
                    sourceType: "non_contract_expense",
                    sourceId: detailOtherExpense!.id,
                    sellerName: detailOtherExpense!.counterparty || null,
                    status: "已登记",
                  }),
                });
                if (res.ok) {
                  // 更新支出 invoiceStatus
                  await fetch(`/api/non-contract-expenses/${detailOtherExpense!.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ invoiceStatus: "已收票" }),
                  });
                  setModalType(null);
                  setInlineInvoiceForm({ invoiceNo: "", invoiceDate: "", amount: "", taxRate: "6", attachments: [] });
                  fetchNonContractExpenses();
                  alert("发票补录成功");
                } else {
                  const json = await res.json();
                  alert(json.error || "补录失败");
                }
              }}
            >
              确认补录
            </button>
          </div>
        </div>
      </Modal>
```

- [ ] **Step 6: 在列表表格中显示 invoiceStatus**

在支出列表的表格列中（约第 1680-1710 行），在状态列后增加发票状态列：

```tsx
{/* 在状态列 <td> 之后 */}
<td className="ios-table-td">
  {expense.invoiceStatus === "待补票" && (
    <span className="ios-badge ios-badge-yellow">待补票</span>
  )}
  {expense.invoiceStatus === "已收票" && (
    <span className="ios-badge ios-badge-blue">已收票</span>
  )}
</td>
```

- [ ] **Step 7: 提交**

```bash
git add src/app/(dashboard)/finance/expense/page.tsx
git commit -m "feat: 其他支出发票登记功能 — 创建时录入发票、待补票标记、补录发票弹窗"
```

---

### Task 9: 审批引擎 — non_contract_expense 终态同步往来信息

**Files:**
- Modify: `src/lib/approval-engine.ts:745-749`

- [ ] **Step 1: 在终态更新后同步往来信息**

```typescript
// 修改前 (line 745-749)
    case "non_contract_expense":
      if (bankAccountId) updateData.bankAccountId = bankAccountId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      await prisma.nonContractExpense.update({ where: { id: businessId }, data: updateData });
      break;

// 修改后
    case "non_contract_expense": {
      if (bankAccountId) updateData.bankAccountId = bankAccountId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      const updated = await prisma.nonContractExpense.update({ where: { id: businessId }, data: updateData });
      // 同步往来信息到往来信息库
      if (updated.counterparty) {
        const existing = await prisma.counterpartyInfo.findFirst({
          where: {
            name: updated.counterparty,
            bankName: updated.counterpartyBankName ?? null,
            bankAccount: updated.counterpartyBankAccount ?? null,
          },
        });
        if (!existing) {
          await prisma.counterpartyInfo.create({
            data: {
              name: updated.counterparty,
              bankName: updated.counterpartyBankName ?? null,
              bankAccount: updated.counterpartyBankAccount ?? null,
            },
          });
        }
      }
      break;
    }
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/approval-engine.ts
git commit -m "feat: 审批终态时同步 non_contract_expense 的往来信息到 CounterpartyInfo"
```

---

### Task 10: 构建验证

- [ ] **Step 1: 运行构建验证**

```bash
npx next build
```

Expected: 构建成功，无类型错误，无 lint 错误。

- [ ] **Step 2: 检查 Prisma Client 类型**

```bash
npx prisma validate
```

Expected: Schema 验证通过。

---

## 实施顺序建议

按依赖关系：Task 1 → Task 2, 3 → Task 4, 5, 6, 7, 8, 9（并行） → Task 10

Task 5-8 都在同一文件 `finance/expense/page.tsx` 中改动，建议合并执行以避免冲突。
