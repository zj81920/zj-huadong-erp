# 全模块列表分页 + 行状态底色设计

## 1. 背景

当前各模块列表存在两个问题：

- **无分页**：前端用 `pageSize=200` 一次性拉取全部数据，数据量增大后加载缓慢。后端约 42 个列表 API 已支持 `page`/`pageSize`，但前端未真正利用。
- **无底色区分**：表格行均为白色，状态仅通过 `ios-badge` 小标签展示，不够醒目。

## 2. 目标

- 为约 25 个列表页面接入真正的后端分页，创建可复用 `usePagination` hook + `PaginationBar` 组件
- 为有 `status` 字段的列表页增加状态行底色，集中管理状态-颜色映射
- 筛选条件变化时自动重置到第 1 页

## 3. 核心决策

| 决策点 | 选择 |
|--------|------|
| 分页风格 | 传统分页 + 每页条数可选（20/50/100），默认 20 条 |
| 实现方案 | 共享 Hook + 组件 |
| 改造范围 | 全量改造 25+ 页面，排除系统设置 |
| 筛选联动 | 筛选条件变化时自动 `setPage(1)` |
| 行底色方案 | 柔和整行底色（与 badge 同色系但更淡） |
| 无状态模块 | 不加底色，保持白色 |
| 待办-待处理 | 按优先级分色（紧急=淡红、重要=淡黄、普通=白） |
| 待办-已处理 | 按审批状态正常映射 |
| TDD | hook (`usePagination`) + 工具函数 (`getRowStatusClass`) 用 TDD，UI 组件和页面不测 |

## 4. 架构

### 4.1 新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/types/pagination.ts` | PaginationInfo、PaginationParams 类型定义 |
| `src/hooks/usePagination.ts` | 分页状态管理 hook |
| `src/components/shared/PaginationBar.tsx` | 分页栏 UI 组件 |
| `src/lib/status-colors.ts` | 状态→行底色 class 的集中映射 + 工具函数 |

### 4.2 类型定义（`src/lib/types/pagination.ts`）

```typescript
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

### 4.3 usePagination Hook（`src/hooks/usePagination.ts`）

```typescript
interface UsePaginationOptions {
  defaultPageSize?: number;  // 默认 20
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  pagination: PaginationInfo | null;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setPagination: (info: PaginationInfo) => void;
  resetPage: () => void;  // 筛选联动：重置到第1页
}
```

Hook 维护 `page`、`pageSize`、`pagination` 三个状态。`setPageSize` 时自动重置 `page=1`。

### 4.4 PaginationBar 组件（`src/components/shared/PaginationBar.tsx`）

UI 布局：`总数 | [上一页] 1 2 3 ... N [下一页] | 每页 [20▾] 条`

- 当前页高亮，首尾页始终显示，中间用 `...` 省略
- 上一页/下一页在边界时禁用
- pageSize 切换时抛 `onPageSizeChange` 回调

```typescript
interface PaginationBarProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];  // 默认 [20, 50, 100]
}
```

### 4.5 数据流

```
页面 usePagination(page, pageSize)
  → fetch(`/api/items?page=${page}&pageSize=${pageSize}&filters...`)
  → API: parseInt(page), parseInt(pageSize)
  → Prisma: findMany({ skip, take }) + count({ where })
  → 返回 { data, pagination: { page, pageSize, total, totalPages } }
  → 页面: setPagination(res.pagination)
  → PaginationBar 渲染
```

### 4.6 筛选联动

```typescript
// 页面中，筛选条件变化时：
const handleFilterChange = (newFilters) => {
  setFilters(newFilters);
  setPage(1);  // 自动重置第一页，防止「筛完空页面」
};
```

### 4.7 API 改动

仅 `GET /api/inter-org-contracts` 需补充 `page`/`pageSize` 参数和 `skip`/`take`/`count` 逻辑。其余 42 个列表 API 已支持分页，无需改动。组织列表和供应商变更记录 API 数据量小，不加分页。

### 4.8 行底色 CSS（`src/app/globals.css`）

```css
/* 行底色区分 — 极淡背景，与 badge 同色系 */
.row-status-draft    { background: #FAFAF9; }  /* 草稿 - 默认白 */
.row-status-pending  { background: #FEF9E7; }  /* 审批中 - 极淡黄 */
.row-status-approved { background: #F0FDF4; }  /* 已批准 - 极淡绿 */
.row-status-rejected { background: #FEF2F2; }  /* 已驳回 - 极淡红 */
.row-status-archived { background: #F0F4FF; }  /* 已归档 - 极淡蓝 */
.row-status-overdue  { background: #FFF7ED; }  /* 逾期 - 极淡橙 */
```

### 4.9 状态颜色映射（`src/lib/status-colors.ts`）

```typescript
export const STATUS_ROW_COLORS: Record<string, string> = {
  // 通用审批状态
  "草稿":   "row-status-draft",
  "审批中": "row-status-pending",
  "已批准": "row-status-approved",
  "已驳回": "row-status-rejected",
  "已归档": "row-status-archived",
  "合同归档": "row-status-archived",
  "已生效": "row-status-archived",

  // 应收应付
  "未收":     "row-status-pending",  "部分收款": "row-status-pending",
  "已收":     "row-status-approved", "逾期":     "row-status-overdue",
  "未付":     "row-status-pending",  "部分付款": "row-status-pending",
  "已付":     "row-status-approved",

  // 供应商/报价/项目/计划/借入借出/发票/工资
  "当前有效": "row-status-approved", "已失效": "row-status-rejected",
  "跟踪": "row-status-draft",  "落地": "row-status-approved",  "放弃": "row-status-rejected",
  "执行": "row-status-approved", "暂停": "row-status-pending", "关闭": "row-status-rejected",
  "未开始": "row-status-draft", "进行中": "row-status-pending", "已完成": "row-status-approved",
  "未还清": "row-status-pending", "已还清": "row-status-approved",
  "已登记": "row-status-draft",
  "已支付": "row-status-approved", "已发放": "row-status-approved",
};

export function getRowStatusClass(status: string | null | undefined): string {
  return status ? (STATUS_ROW_COLORS[status] ?? "") : "";
}
```

### 4.10 页面集成模式

```tsx
// 分页：引入 hook + 组件
const { page, pageSize, setPage, setPageSize, pagination, setPagination }
  = usePagination({ defaultPageSize: 20 });

const fetchData = async () => {
  const res = await fetch(`/api/items?page=${page}&pageSize=${pageSize}`);
  const { data, pagination } = await res.json();
  setItems(data);
  setPagination(pagination);
};

// 表格：每行加底色 class
{items.map(item => (
  <tr key={item.id} className={getRowStatusClass(item.status)}>
    ...
  </tr>
))}

// 分页栏
<PaginationBar pagination={pagination} onPageChange={setPage} onPageSizeChange={setPageSize} />
```

### 4.11 待办页特殊处理

```tsx
// 待处理：按优先级
const PRIORITY_ROW_COLORS: Record<string, string> = {
  "紧急": "row-status-rejected",
  "重要": "row-status-pending",
  "普通": "",
};
<tr className={PRIORITY_ROW_COLORS[item.priority] ?? ""}>

// 已处理：按审批状态
<tr className={getRowStatusClass(item.status)}>
```

## 5. 页面改造清单（约 27 个页面）

### P1（8 个）：合同管理 + 采购管理
contracts/income, contracts/expense, contracts/internal-settlement, contracts/non-contract, contracts/change-orders, procurement/requests, procurement/inquiries, procurement/deliveries

### P2（10 个）：财务管理 + 商务管理
finance/income, finance/expense, finance/invoices, finance/reports, finance/bank-accounts, business/customers, business/suppliers, business/project-leads, business/quotations, business/biddings

### P3（9 个）：项目管理 + HR/行政 + 审批
projects, projects/plans, projects/progress, projects/outsourcing, hr/employees, admin/certificates, admin/seals, admin/supplies, approvals

### 排除
settings/*（4 个，数据量小）, settings/profile, settings/ai-model

## 6. 改造步骤

1. 创建 `src/lib/types/pagination.ts`
2. TDD：写 `test/unit/usePagination.test.ts` → 实现 `src/hooks/usePagination.ts`
3. TDD：写 `test/unit/status-colors.test.ts` → 实现 `src/lib/status-colors.ts`
4. 实现 `PaginationBar` 组件
5. 补充 `globals.css` 行底色 class
6. 补充 `GET /api/inter-org-contracts` 分页
7. 按 P1→P2→P3 批量改造页面
8. 分批跑 `npx next build` 验证

## 7. 验证

- `npx vitest run test/unit/usePagination.test.ts test/unit/status-colors.test.ts` — TDD 测试
- `npx next build` — 确保无类型错误
- `bash scripts/verify.sh` — 回归验证
- 手动测试：翻页、切换每页条数、筛选自动回第 1 页、各行底色正确
