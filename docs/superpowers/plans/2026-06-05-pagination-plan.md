# 全模块列表分页 + 行状态底色 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为约 27 个列表页面接入后端分页（usePagination hook + PaginationBar 组件），为有 status 字段的列表行增加状态底色区分。

**Architecture:** 新增 4 个文件（类型、hook、组件、颜色映射），修改 1 个 API（inter-org-contracts），改造 27 个页面（分 3 批）。TDD 覆盖 hook 和工具函数。

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma, Tailwind CSS 4, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/types/pagination.ts` | 创建 | PaginationInfo/PaginationParams 类型 |
| `src/hooks/usePagination.ts` | 创建 | 分页状态管理 hook |
| `src/lib/status-colors.ts` | 创建 | 状态→CSS class 映射 + getRowStatusClass() |
| `src/components/PaginationBar.tsx` | 创建 | 页码/上一页/下一页/每页条数 UI |
| `test/unit/usePagination.test.ts` | 创建 | usePagination hook 测试 |
| `test/unit/status-colors.test.ts` | 创建 | getRowStatusClass 测试 |
| `src/app/globals.css` | 修改 | 新增 6 个 row-status-* class |
| `src/app/api/inter-org-contracts/route.ts` | 修改 | 补充分页参数和 skip/take/count |
| 27 个 `page.tsx` | 修改 | 引入 hook + 组件 + 行底色 |

---

### Task 1: 创建分页类型定义 ✅

**Files:**
- Create: `src/lib/types/pagination.ts`

- [x] **Step 1: 创建 PaginationInfo 和 PaginationParams 类型**

```typescript
// src/lib/types/pagination.ts

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}
```

- [x] **Step 2: 提交**

```bash
git add src/lib/types/pagination.ts
git commit -m "feat: add PaginationInfo/PaginationParams types"
```

---

### Task 2: TDD — 写 usePagination hook 测试（先写测试） ✅

**Files:**
- Create: `test/unit/usePagination.test.ts`

**测试用例覆盖：**
1. 默认初始值（page=1, pageSize=20, pagination=null）
2. 自定义 defaultPageSize
3. setPage 正常翻页
4. setPageSize 改变每页条数时自动重置 page=1
5. setPagination 设置分页信息后 pagination 正确更新
6. resetPage 重置到第 1 页
7. setPage 边界保护（不能设 0 或负数）
8. setPageSize 边界保护（不能设 0 或负数）

- [x] **Step 1: 写完整测试文件**（含 jsdom 环境注解）

- [x] **Step 2: 运行测试，确认测试可运行**

- [x] **Step 3: 提交测试**

---

### Task 3: TDD — 实现 usePagination hook（让测试通过） ✅

**Files:**
- Create: `src/hooks/usePagination.ts`

- [x] **Step 1: 实现 hook**

- [x] **Step 2: 运行测试，8/8 PASS**

- [x] **Step 3: 提交**

---

### Task 4: TDD — 写 status-colors 测试（先写测试） ✅

**Files:**
- Create: `test/unit/status-colors.test.ts`

- [x] **Step 1: 写完整测试文件**（10 个用例）

- [x] **Step 2: 运行测试，确认测试可运行**

- [x] **Step 3: 提交测试**

---

### Task 5: TDD — 实现 status-colors 工具函数（让测试通过） ✅

**Files:**
- Create: `src/lib/status-colors.ts`

- [x] **Step 1: 实现状态颜色映射和工具函数**

- [x] **Step 2: 运行测试，10/10 PASS**

- [x] **Step 3: 提交**

---

### Task 6: 新增 CSS 行底色 class ✅

**Files:**
- Modify: `src/app/globals.css`

- [x] **Step 1: 在 globals.css 中新增 6 个 row-status-* class**

- [x] **Step 2: 提交**

---

### Task 7: 实现 PaginationBar 组件 ✅

**Files:**
- Create: `src/components/PaginationBar.tsx`

- [x] **Step 1: 实现 PaginationBar 组件**

- [x] **Step 2: 提交**

---

### Task 8: API 改造 — inter-org-contracts 补充分页 ✅

**Files:**
- Modify: `src/app/api/inter-org-contracts/route.ts`

- [x] **Step 1: 为 GET 增加 page/pageSize 分页逻辑**

- [x] **Step 2: 提交**

---

### Task 9: 改造 P1 页面（合同管理 5 个 + 采购管理 3 个 = 8 个页面） ✅

- [x] **Step 1-8: 逐个改造 P1 的 8 个页面**

- [x] **Step 9: 构建验证通过**

- [x] **Step 10: 提交 P1 改造**

---

### Task 10: 改造 P2 页面（财务管理 5 个 + 商务管理 5 个 = 10 个页面） ✅

- [x] **Step 1-10: 逐个改造 P2 的 10 个页面**（含多 Tab 独立分页实例）

- [x] **Step 11: 构建验证通过**

- [x] **Step 12: 提交 P2 改造**

---

### Task 11: 改造 P3 页面（项目管理 4 个 + HR/行政 4 个 + 审批 1 个 = 9 个页面） ✅

- [x] **Step 1-9: 逐个改造 P3 的 9 个页面**（含审批页优先级底色）

- [x] **Step 10: 构建验证通过**

- [x] **Step 11: 提交 P3 改造**

---

### Task 12: 最终回归验证 ✅

- [x] **Step 1: 跑全部单元测试 — 90/90 PASS**

```
npx vitest run test/unit/
 Test Files  13 passed (13)
      Tests  90 passed (90)
```

- [x] **Step 2: 构建验证 — npx next build 通过**

- [ ] **Step 3: 手动功能检查清单**（需用户手动验证）

- 任意列表页：翻到第 2 页，确认数据显示不同
- 切换每页条数为 50，确认数据量变化且页码回到 1
- 修改筛选条件，确认页码自动回到 1
- 审批中的合同行底色为淡黄
- 已批准的合同行底色为淡绿
- 待办页：超过 48h 的审批行底色为淡红
