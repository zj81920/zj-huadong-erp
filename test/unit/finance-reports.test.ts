import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  computeMoMChange,
  computeTotals,
  getMonthlyData,
  getProjectCostMap,
  getAgingBuckets,
  type ReceivableItem,
  type PayableItem,
  type NonContractIncomeItem,
  type NonContractExpenseItem,
  type CapitalContributionItem,
  type OtherBorrowingItem,
  type LendingOutItem,
  type SalaryPaymentItem,
  type ExpenseReportItem,
} from '../../src/lib/finance-reports-utils';

// ========== formatAmount ==========
describe('formatAmount', () => {
  it('1000 → ¥1,000.00', () => {
    expect(formatAmount(1000)).toBe('¥1,000.00');
  });

  it('1234.5 → ¥1,234.50', () => {
    expect(formatAmount(1234.5)).toBe('¥1,234.50');
  });

  it('0 → ¥0.00', () => {
    expect(formatAmount(0)).toBe('¥0.00');
  });

  it('-500 → ¥-500.00', () => {
    expect(formatAmount(-500)).toBe('¥-500.00');
  });

  it('12345678 → ¥12,345,678.00', () => {
    expect(formatAmount(12345678)).toBe('¥12,345,678.00');
  });
});

// ========== computeMoMChange ==========
describe('computeMoMChange', () => {
  it('上期为0返回null', () => {
    expect(computeMoMChange(120, 0)).toBeNull();
  });

  it('(120, 100) → 0.2', () => {
    expect(computeMoMChange(120, 100)).toBeCloseTo(0.2);
  });

  it('(80, 100) → -0.2', () => {
    expect(computeMoMChange(80, 100)).toBeCloseTo(-0.2);
  });

  it('(100, 100) → 0', () => {
    expect(computeMoMChange(100, 100)).toBe(0);
  });
});

// ========== computeTotals ==========
describe('computeTotals', () => {
  const emptyInputs = {
    receivables: [] as ReceivableItem[],
    payables: [] as PayableItem[],
    nonContractIncomes: [] as NonContractIncomeItem[],
    nonContractExpenses: [] as NonContractExpenseItem[],
    contributions: [] as CapitalContributionItem[],
    borrowings: [] as OtherBorrowingItem[],
    lendings: [] as LendingOutItem[],
    salaries: [] as SalaryPaymentItem[],
    expenseReports: [] as ExpenseReportItem[],
  };

  it('全部为空时所有字段为0', () => {
    const result = computeTotals(emptyInputs);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.totalReceivableAmount).toBe(0);
    expect(result.totalPayableAmount).toBe(0);
    expect(result.totalReceivablePaid).toBe(0);
    expect(result.totalPayablePaid).toBe(0);
  });

  it('一笔应收已收100 → totalReceivablePaid=100, totalReceivableAmount=0(amount默认0)', () => {
    const result = computeTotals({
      ...emptyInputs,
      receivables: [{ id: 'r1', sourceType: 'contract', sourceId: 's1', projectSourceId: null, dueDate: '2024-01-01', amount: 0, paidAmount: 100, status: 'partial' }],
    });
    expect(result.totalReceivablePaid).toBe(100);
    expect(result.totalIncome).toBe(100);
  });

  it('一笔应付已付80 → totalPayablePaid=80', () => {
    const result = computeTotals({
      ...emptyInputs,
      payables: [{ id: 'p1', sourceType: 'contract', sourceId: 's2', projectSourceId: null, dueDate: '2024-01-01', amount: 0, paidAmount: 80, status: 'partial' }],
    });
    expect(result.totalPayablePaid).toBe(80);
    expect(result.totalExpense).toBe(80);
  });

  it('其他收入50+注资200+借入100 → totalIncome=350', () => {
    const result = computeTotals({
      ...emptyInputs,
      nonContractIncomes: [{ id: 'nc1', amount: 50, transactionDate: '2024-01-01' }],
      contributions: [{ id: 'c1', amount: 200, contributeDate: '2024-01-01' }],
      borrowings: [{ id: 'b1', amount: 100, borrowingDate: '2024-01-01' }],
    });
    expect(result.totalNonContractIncome).toBe(50);
    expect(result.totalContribution).toBe(200);
    expect(result.totalBorrowing).toBe(100);
    expect(result.totalIncome).toBe(350);
  });

  it('综合：收入(应收100+非合同50)-支出(应付80+报销30)=40', () => {
    const result = computeTotals({
      ...emptyInputs,
      receivables: [{ id: 'r1', sourceType: 'contract', sourceId: 's1', projectSourceId: null, dueDate: '2024-01-01', amount: 0, paidAmount: 100, status: 'partial' }],
      nonContractIncomes: [{ id: 'nc1', amount: 50, transactionDate: '2024-01-01' }],
      payables: [{ id: 'p1', sourceType: 'contract', sourceId: 's2', projectSourceId: null, dueDate: '2024-01-01', amount: 0, paidAmount: 80, status: 'partial' }],
      expenseReports: [{ id: 'er1', amount: 30, createdAt: '2024-01-01' }],
    });
    expect(result.totalIncome).toBe(150);
    expect(result.totalExpense).toBe(110);
    expect(result.netProfit).toBe(40);
  });
});

// ========== getMonthlyData ==========
describe('getMonthlyData', () => {
  const emptyInputs = {
    receivables: [] as ReceivableItem[],
    payables: [] as PayableItem[],
    nonContractIncomes: [] as NonContractIncomeItem[],
    nonContractExpenses: [] as NonContractExpenseItem[],
    contributions: [] as CapitalContributionItem[],
    borrowings: [] as OtherBorrowingItem[],
    lendings: [] as LendingOutItem[],
    salaries: [] as SalaryPaymentItem[],
    expenseReports: [] as ExpenseReportItem[],
  };

  it('全部为空返回空数组', () => {
    expect(getMonthlyData(emptyInputs)).toEqual([]);
  });

  it('一笔收入在1月 → 返回1行 month=2024-01', () => {
    const result = getMonthlyData({
      ...emptyInputs,
      receivables: [{ id: 'r1', sourceType: 'contract', sourceId: 's1', projectSourceId: null, dueDate: '2024-01-15', amount: 0, paidAmount: 100, status: 'partial' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('2024-01');
    expect(result[0].income).toBe(100);
    expect(result[0].expense).toBe(0);
  });

  it('多种类型同月合并', () => {
    const result = getMonthlyData({
      ...emptyInputs,
      receivables: [{ id: 'r1', sourceType: 'contract', sourceId: 's1', projectSourceId: null, dueDate: '2024-03-10', amount: 0, paidAmount: 200, status: 'partial' }],
      payables: [{ id: 'p1', sourceType: 'contract', sourceId: 's2', projectSourceId: null, dueDate: '2024-03-20', amount: 0, paidAmount: 80, status: 'partial' }],
      nonContractIncomes: [{ id: 'nc1', amount: 50, transactionDate: '2024-03-05' }],
      salaries: [{ id: 'sal1', netSalary: 30, paymentDate: '2024-03-25' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('2024-03');
    expect(result[0].income).toBe(250); // 200(receivable) + 50(nonContract)
    expect(result[0].expense).toBe(110); // 80(payable) + 30(salary)
  });
});

// ========== getProjectCostMap ==========
describe('getProjectCostMap', () => {
  it('空数组返回空数组', () => {
    expect(getProjectCostMap([], [])).toEqual([]);
  });

  it('一个项目有应付和报销 → 合并计算', () => {
    const payables: PayableItem[] = [{
      id: 'p1', sourceType: 'contract', sourceId: 's1',
      projectSourceId: 'proj-1', dueDate: '2024-01-01',
      amount: 500, paidAmount: 300, status: 'partial',
      project: { name: '华东项目', projectSourceId: 'proj-1' },
    }];
    const expenseReports: ExpenseReportItem[] = [{
      id: 'er1', amount: 100, createdAt: '2024-01-01',
      projectSourceId: 'proj-1',
      project: { name: '华东项目', projectSourceId: 'proj-1' },
    }];
    const result = getProjectCostMap(payables, expenseReports);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('proj-1');
    expect(result[0].name).toBe('华东项目');
    expect(result[0].totalAmount).toBe(500);
    expect(result[0].paidAmount).toBe(300);
    expect(result[0].expenseReportAmount).toBe(100);
  });

  it('null projectSourceId 被过滤', () => {
    const payables: PayableItem[] = [{
      id: 'p1', sourceType: 'contract', sourceId: 's1',
      projectSourceId: null, dueDate: '2024-01-01',
      amount: 500, paidAmount: 300, status: 'partial',
    }];
    const result = getProjectCostMap(payables, []);
    expect(result).toHaveLength(0);
  });

  it('多个项目分别计算', () => {
    const payables: PayableItem[] = [
      { id: 'p1', sourceType: 'contract', sourceId: 's1', projectSourceId: 'A', dueDate: '2024-01-01', amount: 100, paidAmount: 50, status: 'partial', project: { name: '项目A', projectSourceId: 'A' } },
      { id: 'p2', sourceType: 'contract', sourceId: 's2', projectSourceId: 'B', dueDate: '2024-01-01', amount: 200, paidAmount: 100, status: 'partial', project: { name: '项目B', projectSourceId: 'B' } },
    ];
    const result = getProjectCostMap(payables, []);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 'A')!.totalAmount).toBe(100);
    expect(result.find(r => r.id === 'B')!.totalAmount).toBe(200);
  });
});

// ========== getAgingBuckets ==========
describe('getAgingBuckets', () => {
  it('空数组返回4个桶全部为0', () => {
    const result = getAgingBuckets([], 'receivable');
    expect(result).toHaveLength(4);
    result.forEach(b => {
      expect(b.amount).toBe(0);
      expect(b.count).toBe(0);
    });
  });

  it('未来日期 → 归入第一个桶（30天内）', () => {
    const futureDate = new Date(Date.now() + 10 * 86400000).toISOString();
    const items: ReceivableItem[] = [{
      id: 'r1', sourceType: 'contract', sourceId: 's1', projectSourceId: null,
      dueDate: futureDate, amount: 1000, paidAmount: 200, status: 'approved',
    }];
    const result = getAgingBuckets(items, 'receivable');
    expect(result[0].count).toBe(1);
    expect(result[0].amount).toBe(800); // remaining = 1000 - 200
  });

  it('逾期45天 → 归入第二个桶（30-60天）', () => {
    const dueDate = new Date(Date.now() - 45 * 86400000).toISOString();
    const items: PayableItem[] = [{
      id: 'p1', sourceType: 'contract', sourceId: 's1', projectSourceId: null,
      dueDate, amount: 500, paidAmount: 0, status: 'pending',
    }];
    const result = getAgingBuckets(items, 'payable');
    expect(result[1].count).toBe(1);
    expect(result[1].amount).toBe(500);
  });

  it('逾期75天 → 归入第三个桶（60-90天）', () => {
    const dueDate = new Date(Date.now() - 75 * 86400000).toISOString();
    const items: ReceivableItem[] = [{
      id: 'r1', sourceType: 'contract', sourceId: 's1', projectSourceId: null,
      dueDate, amount: 300, paidAmount: 100, status: 'approved',
    }];
    const result = getAgingBuckets(items, 'receivable');
    expect(result[2].count).toBe(1);
    expect(result[2].amount).toBe(200);
  });

  it('逾期100天 → 归入第四个桶（90天以上）', () => {
    const dueDate = new Date(Date.now() - 100 * 86400000).toISOString();
    const items: PayableItem[] = [{
      id: 'p1', sourceType: 'contract', sourceId: 's1', projectSourceId: null,
      dueDate, amount: 1000, paidAmount: 0, status: 'pending',
    }];
    const result = getAgingBuckets(items, 'payable');
    expect(result[3].count).toBe(1);
    expect(result[3].amount).toBe(1000);
  });

  it('已完成状态被排除', () => {
    const dueDate = new Date(Date.now() - 100 * 86400000).toISOString();
    const items: ReceivableItem[] = [{
      id: 'r1', sourceType: 'contract', sourceId: 's1', projectSourceId: null,
      dueDate, amount: 1000, paidAmount: 1000, status: 'completed',
    }];
    const result = getAgingBuckets(items, 'receivable');
    expect(result[3].count).toBe(0);
  });
});
