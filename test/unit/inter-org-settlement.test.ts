import { describe, it, expect } from 'vitest';
import { calculateSettlementAmount } from '../../src/lib/inter-org-settlement';

describe('calculateSettlementAmount', () => {
  it('正常计算：主合同金额100，管理费10，税费0，其他费用0，结算额=90', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 0,
      otherFee: 0,
    });
    expect(result).toBe(90);
  });

  it('含税费承担：主合同100，管理费10，税费5，其他费用0，结算额=85', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 5,
      otherFee: 0,
    });
    expect(result).toBe(85);
  });

  it('含其他费用：主合同100，管理费10，税费0，其他费用3，结算额=87', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 0,
      otherFee: 3,
    });
    expect(result).toBe(87);
  });

  it('所有费用都为0，结算额=主合同金额', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 0,
      taxBurden: 0,
      otherFee: 0,
    });
    expect(result).toBe(100);
  });

  it('管理费=主合同金额，结算额=0', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 100,
      taxBurden: 0,
      otherFee: 0,
    });
    expect(result).toBe(0);
  });

  it('费用总和>主合同金额，结算额可为负数', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 80,
      taxBurden: 30,
      otherFee: 10,
    });
    expect(result).toBe(-20);
  });

  it('金额为字符串格式也能正常计算', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: '100.00',
      managementFee: '10.50',
      taxBurden: '5.00',
      otherFee: '2.50',
    });
    expect(result).toBe(82);
  });

  it('管理费为负数时抛错', () => {
    expect(() => calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: -1,
      taxBurden: 0,
      otherFee: 0,
    })).toThrow('管理费不能为负数');
  });

  it('其他费用>0时函数只做计算，不校验说明字段', () => {
    const result = calculateSettlementAmount({
      mainContractAmount: 100,
      managementFee: 10,
      taxBurden: 0,
      otherFee: 5,
    });
    expect(result).toBe(85);
  });
});
