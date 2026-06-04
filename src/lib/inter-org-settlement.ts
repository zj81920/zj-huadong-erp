// 内部结算合同 - 结算金额计算逻辑

export interface SettlementInput {
  mainContractAmount: number | string;
  managementFee: number | string;
  taxBurden: number | string;
  otherFee: number | string;
}

/**
 * 计算内部结算合同额
 * 公式：结算额 = 主合同金额 - 管理费 - 税费承担 - 其他费用
 */
export function calculateSettlementAmount(input: SettlementInput): number {
  const main = typeof input.mainContractAmount === 'string'
    ? parseFloat(input.mainContractAmount)
    : input.mainContractAmount;
  const fee = typeof input.managementFee === 'string'
    ? parseFloat(input.managementFee)
    : input.managementFee;
  const tax = typeof input.taxBurden === 'string'
    ? parseFloat(input.taxBurden)
    : input.taxBurden;
  const other = typeof input.otherFee === 'string'
    ? parseFloat(input.otherFee)
    : input.otherFee;

  if (fee < 0) throw new Error('管理费不能为负数');
  if (tax < 0) throw new Error('税费承担不能为负数');
  if (other < 0) throw new Error('其他费用不能为负数');

  return parseFloat((main - fee - tax - other).toFixed(2));
}
