// ==================== 接口定义 ====================

export interface ReceivableItem {
  id: string;
  sourceType: string;
  sourceId: string;
  projectSourceId: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
  project?: { name: string; projectSourceId: string } | null;
}

export interface PayableItem {
  id: string;
  sourceType: string;
  sourceId: string;
  projectSourceId: string | null;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
  project?: { name: string; projectSourceId: string } | null;
}

export interface NonContractIncomeItem {
  id: string;
  amount: number;
  transactionDate: string;
  organizationId?: string;
}

export interface NonContractExpenseItem {
  id: string;
  amount: number;
  transactionDate: string;
  organizationId?: string;
}

export interface CapitalContributionItem {
  id: string;
  amount: number;
  contributeDate: string;
  organizationId?: string;
}

export interface OtherBorrowingItem {
  id: string;
  amount: number;
  borrowingDate: string;
  organizationId?: string;
}

export interface LendingOutItem {
  id: string;
  amount: number;
  lendingDate: string;
  organizationId?: string;
}

export interface SalaryPaymentItem {
  id: string;
  netSalary: number;
  paymentDate: string;
  organizationId?: string;
}

export interface ExpenseReportItem {
  id: string;
  amount: number;
  createdAt: string;
  projectSourceId?: string;
  project?: { name: string; projectSourceId: string } | null;
  organizationId?: string;
}

export interface MonthlyRow {
  month: string;
  income: number;
  expense: number;
}

export interface ProjectCostRow {
  id: string;
  name: string;
  totalAmount: number;
  paidAmount: number;
  expenseReportAmount: number;
}

export interface AgingBucket {
  label: string;
  range: string;
  amount: number;
  count: number;
  color: string;
}

export interface TotalsResult {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  totalReceivableAmount: number;
  totalPayableAmount: number;
  totalReceivablePaid: number;
  totalPayablePaid: number;
  totalNonContractIncome: number;
  totalContribution: number;
  totalBorrowing: number;
  totalNonContractExpense: number;
  totalLending: number;
  totalSalaryPaid: number;
  totalExpenseReport: number;
}

// ==================== 辅助类型 ====================

export interface FinanceReportInputs {
  receivables: ReceivableItem[];
  payables: PayableItem[];
  nonContractIncomes: NonContractIncomeItem[];
  nonContractExpenses: NonContractExpenseItem[];
  contributions: CapitalContributionItem[];
  borrowings: OtherBorrowingItem[];
  lendings: LendingOutItem[];
  salaries: SalaryPaymentItem[];
  expenseReports: ExpenseReportItem[];
}

// ==================== 函数实现 ====================

const sum = (arr: { [key: string]: number }[], field: string): number =>
  arr.reduce((acc, item) => acc + (item[field] ?? 0), 0);

/**
 * 格式化金额为 ¥ + 中文千分位格式，保留2位小数
 */
export function formatAmount(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `¥-${formatted}` : `¥${formatted}`;
}

/**
 * 计算环比变化率，上期为0时返回null
 */
export function computeMoMChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/**
 * 计算各项总计
 */
export function computeTotals(inputs: FinanceReportInputs): TotalsResult {
  const totalReceivableAmount = sum(inputs.receivables, 'amount');
  const totalReceivablePaid = sum(inputs.receivables, 'paidAmount');
  const totalPayableAmount = sum(inputs.payables, 'amount');
  const totalPayablePaid = sum(inputs.payables, 'paidAmount');
  const totalNonContractIncome = sum(inputs.nonContractIncomes, 'amount');
  const totalContribution = sum(inputs.contributions, 'amount');
  const totalBorrowing = sum(inputs.borrowings, 'amount');
  const totalNonContractExpense = sum(inputs.nonContractExpenses, 'amount');
  const totalLending = sum(inputs.lendings, 'amount');
  const totalSalaryPaid = sum(inputs.salaries, 'netSalary');
  const totalExpenseReport = sum(inputs.expenseReports, 'amount');

  const totalIncome = totalReceivablePaid + totalNonContractIncome + totalContribution + totalBorrowing;
  const totalExpense = totalPayablePaid + totalNonContractExpense + totalLending + totalSalaryPaid + totalExpenseReport;

  return {
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    totalReceivableAmount,
    totalPayableAmount,
    totalReceivablePaid,
    totalPayablePaid,
    totalNonContractIncome,
    totalContribution,
    totalBorrowing,
    totalNonContractExpense,
    totalLending,
    totalSalaryPaid,
    totalExpenseReport,
  };
}

/**
 * 按月汇总收支数据，按时间排序
 */
export function getMonthlyData(inputs: FinanceReportInputs): MonthlyRow[] {
  const map = new Map<string, { income: number; expense: number }>();

  // 应收：只计 paidAmount > 0 的，按 dueDate 分月
  for (const item of inputs.receivables) {
    if (item.paidAmount > 0) {
      const month = item.dueDate.slice(0, 7);
      const entry = map.get(month) ?? { income: 0, expense: 0 };
      entry.income += item.paidAmount;
      map.set(month, entry);
    }
  }

  // 应付：只计 paidAmount > 0 的，按 dueDate 分月
  for (const item of inputs.payables) {
    if (item.paidAmount > 0) {
      const month = item.dueDate.slice(0, 7);
      const entry = map.get(month) ?? { income: 0, expense: 0 };
      entry.expense += item.paidAmount;
      map.set(month, entry);
    }
  }

  // 非合同收入：按 transactionDate 分月
  for (const item of inputs.nonContractIncomes) {
    const month = item.transactionDate.slice(0, 7);
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    entry.income += item.amount;
    map.set(month, entry);
  }

  // 非合同支出：按 transactionDate 分月
  for (const item of inputs.nonContractExpenses) {
    const month = item.transactionDate.slice(0, 7);
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    entry.expense += item.amount;
    map.set(month, entry);
  }

  // 注资：按 contributeDate 分月
  for (const item of inputs.contributions) {
    const month = item.contributeDate.slice(0, 7);
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    entry.income += item.amount;
    map.set(month, entry);
  }

  // 借入：按 borrowingDate 分月
  for (const item of inputs.borrowings) {
    const month = item.borrowingDate.slice(0, 7);
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    entry.income += item.amount;
    map.set(month, entry);
  }

  // 借出：按 lendingDate 分月
  for (const item of inputs.lendings) {
    const month = item.lendingDate.slice(0, 7);
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    entry.expense += item.amount;
    map.set(month, entry);
  }

  // 工资：按 paymentDate 分月
  for (const item of inputs.salaries) {
    const month = item.paymentDate.slice(0, 7);
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    entry.expense += item.netSalary;
    map.set(month, entry);
  }

  // 报销：按 createdAt 分月
  for (const item of inputs.expenseReports) {
    const month = item.createdAt.slice(0, 7);
    const entry = map.get(month) ?? { income: 0, expense: 0 };
    entry.expense += item.amount;
    map.set(month, entry);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));
}

/**
 * 按项目汇总应付和报销金额
 */
export function getProjectCostMap(
  payables: PayableItem[],
  expenseReports: ExpenseReportItem[],
): ProjectCostRow[] {
  const projectMap = new Map<string, ProjectCostRow>();

  for (const item of payables) {
    if (!item.projectSourceId) continue;
    const existing = projectMap.get(item.projectSourceId);
    if (existing) {
      existing.totalAmount += item.amount;
      existing.paidAmount += item.paidAmount;
    } else {
      projectMap.set(item.projectSourceId, {
        id: item.projectSourceId,
        name: item.project?.name ?? item.projectSourceId,
        totalAmount: item.amount,
        paidAmount: item.paidAmount,
        expenseReportAmount: 0,
      });
    }
  }

  for (const item of expenseReports) {
    const projectId = item.projectSourceId;
    if (!projectId) continue;
    const existing = projectMap.get(projectId);
    if (existing) {
      existing.expenseReportAmount += item.amount;
    } else {
      projectMap.set(projectId, {
        id: projectId,
        name: item.project?.name ?? projectId,
        totalAmount: 0,
        paidAmount: 0,
        expenseReportAmount: item.amount,
      });
    }
  }

  return Array.from(projectMap.values());
}

/**
 * 账龄分析：按逾期天数分桶
 * direction: 'receivable' 或 'payable'，影响已完成状态的判断
 */
export function getAgingBuckets(
  items: ReceivableItem[] | PayableItem[],
  direction: 'receivable' | 'payable',
): AgingBucket[] {
  const completedStatuses = ['completed', '已完成', 'paid', '已付'];
  const now = new Date();

  const bucketDefs: { label: string; range: string; color: string; min: number; max: number }[] = [
    { label: '30天内', range: '0-30', color: '#52c41a', min: -Infinity, max: 30 },
    { label: '30-60天', range: '30-60', color: '#faad14', min: 30, max: 60 },
    { label: '60-90天', range: '60-90', color: '#fa8c16', min: 60, max: 90 },
    { label: '90天以上', range: '90+', color: '#f5222d', min: 90, max: Infinity },
  ];

  const buckets = bucketDefs.map(def => ({
    label: def.label,
    range: def.range,
    color: def.color,
    amount: 0,
    count: 0,
  }));

  for (const item of items) {
    // 已完成状态排除
    if (completedStatuses.includes(item.status)) continue;

    const remaining = item.amount - item.paidAmount;
    if (remaining <= 0) continue;

    const dueDate = new Date(item.dueDate);
    const diffMs = now.getTime() - dueDate.getTime();
    const overdueDays = Math.floor(diffMs / 86400000);

    for (let i = 0; i < bucketDefs.length; i++) {
      if (overdueDays >= bucketDefs[i].min && overdueDays < bucketDefs[i].max) {
        buckets[i].amount += remaining;
        buckets[i].count += 1;
        break;
      }
    }
  }

  return buckets;
}
