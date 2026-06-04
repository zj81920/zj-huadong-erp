// 合同变更单 - 业务逻辑函数

/**
 * 计算金额差额
 */
export function calculateAmountDifference(
  previousAmount: number,
  newAmount: number
): number {
  return parseFloat((newAmount - previousAmount).toFixed(2));
}

/**
 * 检查是否超收（金额减少时，已收金额 > 新金额）
 */
export function checkOverCollection(input: {
  paidAmount: number;
  newAmount: number;
}): { isOver: boolean; overAmount: number } {
  const over = input.paidAmount - input.newAmount;
  if (over > 0) {
    return { isOver: true, overAmount: parseFloat(over.toFixed(2)) };
  }
  return { isOver: false, overAmount: 0 };
}

export interface FinancialRecord {
  amount: number;
  paidAmount: number;
  status: string;
}

export interface AdjustmentResult {
  amount: number;
  hasOverCollection: boolean;
  overCollectionAmount?: number;
}

/**
 * 变更单审批通过后，调整应收/应付记录的金额
 * 返回调整结果，含超收标记
 */
export function applyFinancialAdjustment(
  record: FinancialRecord,
  newAmount: number
): AdjustmentResult {
  const result: AdjustmentResult = {
    amount: newAmount,
    hasOverCollection: false,
  };

  if (record.paidAmount > newAmount) {
    result.hasOverCollection = true;
    result.overCollectionAmount = parseFloat(
      (record.paidAmount - newAmount).toFixed(2)
    );
  }

  return result;
}

/**
 * 合并归档文件：原文件 + 新增文件
 * 原文件保留不可删除（审计需要），新文件追加到数组尾部
 */
export function mergeArchivedFiles(
  existingArchivedUrl: string | null,
  newFiles: string[]
): string[] {
  const existing: string[] = [];
  if (existingArchivedUrl) {
    try {
      const parsed = JSON.parse(existingArchivedUrl);
      if (Array.isArray(parsed)) existing.push(...parsed);
      else existing.push(existingArchivedUrl);
    } catch {
      // 如果是单个URL而非JSON数组
      existing.push(existingArchivedUrl);
    }
  }
  return [...existing, ...newFiles];
}
