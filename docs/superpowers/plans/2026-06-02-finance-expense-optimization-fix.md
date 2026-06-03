# 财务支出优化 - 问题修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复审批详情页缺银行信息、添加上下游搜索建议、优化自动保存反馈

**Architecture:**
- 抽取一个可复用的 `CounterpartySearch` 组件，输入名称时 debounce 搜索往来信息库，下拉建议选择后自动填充银行信息
- 在三个表单（其他支出、借出款、投标保证金）中替换普通 input 为搜索组件
- 在审批详情页的两个 DetailCard 中补充银行字段渲染

**Tech Stack:** Next.js App Router, React, Tailwind CSS

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `src/components/CounterpartySearch.tsx` | 往来信息搜索组件 |
| 修改 | `src/app/(dashboard)/approvals/page.tsx` | NonContractExpenseDetailCard + LendingOutDetailCard 补充银行字段 |
| 修改 | `src/app/(dashboard)/finance/expense/page.tsx` | 其他支出/借出款表单使用 CounterpartySearch 组件 |
| 修改 | `src/app/(dashboard)/business/project-leads/[id]/BiddingSection.tsx` | 保证金支付弹窗使用 CounterpartySearch 组件 |

---

### Task 1: 新增 CounterpartySearch 搜索组件

**Files:**
- Create: `src/components/CounterpartySearch.tsx`

- [ ] **Step 1: 创建组件文件**

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface CounterpartyRecord {
  id: string;
  name: string;
  bankName: string | null;
  bankAccount: string | null;
}

interface CounterpartySearchProps {
  /** 当前选中的对方名称 */
  value: string;
  /** 名称变化回调 */
  onChange: (name: string) => void;
  /** 选中记录时填充银行信息 */
  onSelect: (record: { bankName: string; bankAccount: string }) => void;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

export default function CounterpartySearch({
  value,
  onChange,
  onSelect,
  placeholder = "请输入名称搜索",
  disabled = false,
}: CounterpartySearchProps) {
  const [suggestions, setSuggestions] = useState<CounterpartyRecord[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(async (search: string) => {
    if (!search.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/counterparty?search=${encodeURIComponent(search.trim())}&pageSize=20`);
      const json = await res.json();
      if (res.ok && json.data) {
        setSuggestions(json.data);
        setShowDropdown(json.data.length > 0);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(newValue), 300);
  };

  const handleSelect = (record: CounterpartyRecord) => {
    onChange(record.name);
    onSelect({ bankName: record.bankName || "", bankAccount: record.bankAccount || "" });
    setShowDropdown(false);
  };

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 清理 debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        className="ios-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        disabled={disabled}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-[#1C1917]/30 border-t-[#1C1917] rounded-full animate-spin" />
        </div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-[#E7E5E4] max-h-48 overflow-y-auto">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full text-left px-4 py-2.5 text-[13px] text-[#1C1917] hover:bg-[#FAFAF9] border-b border-[#F5F5F4] last:border-b-0 transition-colors"
              onClick={() => handleSelect(item)}
            >
              <div className="font-medium">{item.name}</div>
              {(item.bankName || item.bankAccount) && (
                <div className="text-[11px] text-[#A8A29E] mt-0.5">
                  {item.bankName || "无开户行"} · {item.bankAccount ? `****${item.bankAccount.slice(-4)}` : "无账号"}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

后续任务中引用该组件时 IDE 会自动检查类型，暂无需单独验证。

---

### Task 2: 审批详情页补充银行信息

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx:184-222`

- [ ] **Step 1: 修改 NonContractExpenseDetailCard**

将：
```tsx
function NonContractExpenseDetailCard({ data }: { data: any }) {
  const fields = [
    { label: "项目", value: data?.project?.name },
    { label: "金额", value: data?.amount ? `¥${Number(data.amount).toLocaleString()}` : "-" },
    { label: "交易日期", value: data?.transactionDate ? formatDate(data.transactionDate) : "-" },
    { label: "对方单位", value: data?.counterparty },
  ];
  return <DetailGrid fields={fields} />;
}
```

改为：
```tsx
function NonContractExpenseDetailCard({ data }: { data: any }) {
  const fields = [
    { label: "项目", value: data?.project?.name },
    { label: "金额", value: data?.amount ? `¥${Number(data.amount).toLocaleString()}` : "-" },
    { label: "交易日期", value: data?.transactionDate ? formatDate(data.transactionDate) : "-" },
    { label: "对方单位", value: data?.counterparty },
    { label: "开户行", value: data?.counterpartyBankName || "-" },
    { label: "银行账号", value: data?.counterpartyBankAccount ? `****${String(data.counterpartyBankAccount).slice(-4)}` : "-" },
  ];
  return <DetailGrid fields={fields} />;
}
```

- [ ] **Step 2: 修改 LendingOutDetailCard**

将：
```tsx
function LendingOutDetailCard({ data }: { data: any }) {
  const fields = [
    { label: "借款人", value: data?.borrowerName },
    { label: "项目", value: data?.projectSourceId },
    { label: "金额", value: data?.amount ? `¥${Number(data.amount).toLocaleString()}` : "-" },
    { label: "借款日期", value: data?.lendingDate ? formatDate(data.lendingDate) : "-" },
    { label: "预计归还日期", value: data?.expectedReturnDate ? formatDate(data.expectedReturnDate) : "-" },
  ];
  return <DetailGrid fields={fields} />;
}
```

改为：
```tsx
function LendingOutDetailCard({ data }: { data: any }) {
  const fields = [
    { label: "借款人", value: data?.borrowerName },
    { label: "开户行", value: data?.borrowerBankName || "-" },
    { label: "银行账号", value: data?.borrowerBankAccount ? `****${String(data.borrowerBankAccount).slice(-4)}` : "-" },
    { label: "项目", value: data?.projectSourceId },
    { label: "金额", value: data?.amount ? `¥${Number(data.amount).toLocaleString()}` : "-" },
    { label: "借款日期", value: data?.lendingDate ? formatDate(data.lendingDate) : "-" },
    { label: "预计归还日期", value: data?.expectedReturnDate ? formatDate(data.expectedReturnDate) : "-" },
  ];
  return <DetailGrid fields={fields} />;
}
```

---

### Task 3: 其他支出表单集成 CounterpartySearch

**Files:**
- Modify: `src/app/(dashboard)/finance/expense/page.tsx`

- [ ] **Step 1: 在文件顶部引入组件**

在文件 import 区域（约第 1-40 行）添加：
```tsx
import CounterpartySearch from "@/components/CounterpartySearch";
```

- [ ] **Step 2: 替换对方名称和银行字段**

找到 `otherExpenseForm` 对应的表单项（约第 2592-2623 行），将：

```tsx
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
```

改为：
```tsx
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方</label>
  <CounterpartySearch
    value={otherExpenseForm.counterparty}
    onChange={(name) => setOtherExpenseForm((p) => ({ ...p, counterparty: name }))}
    onSelect={(bank) => setOtherExpenseForm((p) => ({ ...p, counterpartyBankName: bank.bankName, counterpartyBankAccount: bank.bankAccount }))}
    placeholder="请输入交易对方"
  />
</div>
```

并将后面的银行账号字段区域改为只读（当有值时），保持现有 input 并加上 `disabled={!!otherExpenseForm.counterpartyBankName}`：

```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">开户行</label>
    <input
      type="text"
      className="ios-input"
      placeholder="请输入开户行"
      value={otherExpenseForm.counterpartyBankName || ""}
      onChange={(e) => setOtherExpenseForm((p) => ({ ...p, counterpartyBankName: e.target.value }))}
      disabled={false} /* 让用户仍可手动修改 */
    />
  </div>
  <div>
    <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">银行账号</label>
    <input
      type="text"
      className="ios-input"
      placeholder="请输入银行账号"
      value={otherExpenseForm.counterpartyBankAccount || ""}
      onChange={(e) => setOtherExpenseForm((p) => ({ ...p, counterpartyBankAccount: e.target.value }))}
      disabled={false} /* 让用户仍可手动修改 */
    />
  </div>
</div>
```

这里保持银行字段可编辑（选中后自动填充但用户仍可修改），符合 spec 中的"自动填充，可修改"要求。

---

### Task 4: 借出款表单集成 CounterpartySearch

**Files:**
- Modify: `src/app/(dashboard)/finance/expense/page.tsx`

- [ ] **Step 1: 替换借入方名称和银行字段**

找到 `lendingOutForm` 对应的表单项（约第 2699-2728 行），将：

```tsx
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借入方 <span className="text-[#78716C]">*</span></label>
  <input
    type="text"
    className="ios-input"
    placeholder="请输入借入方"
    value={lendingOutForm.borrowerName}
    onChange={(e) => setLendingOutForm((p) => ({ ...p, borrowerName: e.target.value }))}
  />
</div>
```

改为：
```tsx
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">借入方 <span className="text-[#78716C]">*</span></label>
  <CounterpartySearch
    value={lendingOutForm.borrowerName}
    onChange={(name) => setLendingOutForm((p) => ({ ...p, borrowerName: name }))}
    onSelect={(bank) => setLendingOutForm((p) => ({ ...p, borrowerBankName: bank.bankName, borrowerBankAccount: bank.bankAccount }))}
    placeholder="请输入借入方"
  />
</div>
```

---

### Task 5: 投标保证金弹窗集成 CounterpartySearch

**Files:**
- Modify: `src/app/(dashboard)/business/project-leads/[id]/BiddingSection.tsx`

- [ ] **Step 1: 引入组件**

在文件顶部 import 区域添加：
```tsx
import CounterpartySearch from "@/components/CounterpartySearch";
```

- [ ] **Step 2: 替换弹窗中的交易对方名称字段**

找到保证金弹窗中的交易对方名称 input（约第 842-850 行），将：

```tsx
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方名称 <span className="text-[#78716C]">*</span></label>
  <input
    type="text"
    className="ios-input"
    placeholder="请输入收款方名称"
    value={bondForm.counterpartyName}
    onChange={(e) => setBondForm((p) => ({ ...p, counterpartyName: e.target.value }))}
  />
</div>
```

改为：
```tsx
<div>
  <label className="block text-[13px] font-semibold text-[#1C1917] mb-1.5">交易对方名称 <span className="text-[#78716C]">*</span></label>
  <CounterpartySearch
    value={bondForm.counterpartyName}
    onChange={(name) => setBondForm((p) => ({ ...p, counterpartyName: name }))}
    onSelect={(bank) => setBondForm((p) => ({ ...p, bankName: bank.bankName, bankAccount: bank.bankAccount }))}
    placeholder="请输入收款方名称"
  />
</div>
```

---

### Task 6: 优化自动保存到往来信息库的反馈

**Files:**
- Modify: `src/app/(dashboard)/finance/expense/page.tsx`

- [ ] **Step 1: 优化 handleSubmitOtherExpense 中的自动保存**

在当前 `POST /api/counterparty` 的 `.catch(() => {})` 改为带 console.error 日志：

找到（约第 903-914 行）：
```tsx
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
```

改为：
```tsx
if (otherExpenseForm.counterparty.trim()) {
  fetch("/api/counterparty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: otherExpenseForm.counterparty.trim(),
      bankName: otherExpenseForm.counterpartyBankName.trim() || null,
      bankAccount: otherExpenseForm.counterpartyBankAccount.trim() || null,
    }),
  }).catch((err) => console.error("自动保存往来信息失败:", err));
}
```

- [ ] **Step 2: 优化 handleSubmitLendingOut 中的自动保存**

同样找到（约第 979-988 行）：
```tsx
if (lendingOutForm.borrowerName.trim()) {
  fetch("/api/counterparty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: lendingOutForm.borrowerName.trim(),
      bankName: lendingOutForm.borrowerBankName.trim() || null,
      bankAccount: lendingOutForm.borrowerBankAccount.trim() || null,
    }),
  }).catch(() => {});
}
```

改为：
```tsx
if (lendingOutForm.borrowerName.trim()) {
  fetch("/api/counterparty", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: lendingOutForm.borrowerName.trim(),
      bankName: lendingOutForm.borrowerBankName.trim() || null,
      bankAccount: lendingOutForm.borrowerBankAccount.trim() || null,
    }),
  }).catch((err) => console.error("自动保存往来信息失败:", err));
}
```

---

### Task 7: 构建验证

- [ ] **Step 1: 运行 TypeScript 编译检查**

Run: `cd /Users/zj81920/应用开发/zj-huadong-erp && npx next build 2>&1 | head -50`
Expected: 无类型错误

- [ ] **Step 2: 如果编译有错误则修复**

根据错误信息定位修复，常见问题：
- CounterpartySearch 组件路径引用问题
- approvals/page.tsx 中 formatDate 可能未导入（已在文件上部导入）
