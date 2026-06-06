import { describe, it, expect } from 'vitest';
import {
  calculateAmountDifference,
  checkOverCollection,
  applyFinancialAdjustment,
  mergeArchivedFiles,
  isArchiveFileRequired,
} from '../../src/lib/change-order';

describe('calculateAmountDifference', () => {
  it('金额增加：100→120，差额=20', () => {
    expect(calculateAmountDifference(100, 120)).toBe(20);
  });

  it('金额减少：100→80，差额=-20', () => {
    expect(calculateAmountDifference(100, 80)).toBe(-20);
  });

  it('金额不变：100→100，差额=0', () => {
    expect(calculateAmountDifference(100, 100)).toBe(0);
  });
});

describe('checkOverCollection', () => {
  it('未超收：已收60，新金额100，返回false', () => {
    const result = checkOverCollection({ paidAmount: 60, newAmount: 100 });
    expect(result.isOver).toBe(false);
  });

  it('超收：已收60，新金额50，返回true且超收金额=10', () => {
    const result = checkOverCollection({ paidAmount: 60, newAmount: 50 });
    expect(result.isOver).toBe(true);
    expect(result.overAmount).toBe(10);
  });

  it('刚好相等：已收100，新金额100，不超收', () => {
    const result = checkOverCollection({ paidAmount: 100, newAmount: 100 });
    expect(result.isOver).toBe(false);
  });

  it('无已收金额：已收0，新金额80，不超收', () => {
    const result = checkOverCollection({ paidAmount: 0, newAmount: 80 });
    expect(result.isOver).toBe(false);
  });
});

describe('applyFinancialAdjustment', () => {
  it('收入合同金额增加时，应收金额更新为新金额', () => {
    const receivable = { amount: 100, paidAmount: 0, status: '未收' };
    const result = applyFinancialAdjustment(receivable, 120);
    expect(result.amount).toBe(120);
    expect(result.hasOverCollection).toBe(false);
  });

  it('收入合同金额减少但未超收，应收更新且状态不变', () => {
    const receivable = { amount: 100, paidAmount: 50, status: '部分收款' };
    const result = applyFinancialAdjustment(receivable, 80);
    expect(result.amount).toBe(80);
    expect(result.hasOverCollection).toBe(false);
  });

  it('收入合同金额减少且超收，应收更新并标记', () => {
    const receivable = { amount: 100, paidAmount: 70, status: '部分收款' };
    const result = applyFinancialAdjustment(receivable, 50);
    expect(result.amount).toBe(50);
    expect(result.hasOverCollection).toBe(true);
    expect(result.overCollectionAmount).toBe(20);
  });
});

describe('mergeArchivedFiles', () => {
  it('原无文件，新增一个文件，合并后只有一个', () => {
    const result = mergeArchivedFiles(null, ['https://oss.com/new.pdf']);
    expect(result).toEqual(['https://oss.com/new.pdf']);
  });

  it('原有2个文件，新增1个，合并后有3个', () => {
    const existing = ['https://oss.com/a.pdf', 'https://oss.com/b.pdf'];
    const result = mergeArchivedFiles(JSON.stringify(existing), ['https://oss.com/c.pdf']);
    expect(result).toHaveLength(3);
    expect(result).toContain('https://oss.com/a.pdf');
    expect(result).toContain('https://oss.com/c.pdf');
  });

  it('无新增文件，合并后不变', () => {
    const existing = ['https://oss.com/a.pdf'];
    const result = mergeArchivedFiles(JSON.stringify(existing), []);
    expect(result).toEqual(existing);
  });
});

describe('isArchiveFileRequired', () => {
  it('收入合同归档必须上传文件', () => {
    expect(isArchiveFileRequired('income_contract')).toBe(true);
  });

  it('支出合同归档必须上传文件', () => {
    expect(isArchiveFileRequired('expense_contract')).toBe(true);
  });

  it('内部结算合同归档必须上传文件', () => {
    expect(isArchiveFileRequired('inter_org_contract')).toBe(true);
  });

  it('合同变更归档不需要强制上传文件', () => {
    expect(isArchiveFileRequired('contract_change_order')).toBe(false);
  });

  it('未知类型默认需要上传文件（安全）', () => {
    expect(isArchiveFileRequired('unknown_type')).toBe(true);
  });
});
