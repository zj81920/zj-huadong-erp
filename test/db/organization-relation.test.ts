import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Organization 关联', () => {
  const modelChecks: [string, string][] = [
    ['IncomeContract', 'organizationId'],
    ['ExpenseContract', 'organizationId'],
    ['Invoice', 'organizationId'],
    ['Receivable', 'organizationId'],
    ['Payable', 'organizationId'],
    ['ReceiptVoucher', 'organizationId'],
    ['PaymentVoucher', 'organizationId'],
    ['Project', 'organizationId'],
    ['BankAccount', 'organizationId'],
    ['Organization', 'code'],
    ['InterOrgContract', 'fromOrgId'],
    ['InterOrgContract', 'toOrgId'],
    ['InterOrgContract', 'managementFee'],
    ['InterOrgContract', 'taxBurden'],
    ['InterOrgContract', 'otherFee'],
    ['InterOrgContract', 'settlementAmount'],
    ['InterOrgContract', 'archivedUrl'],
    ['ContractChangeOrder', 'changeNo'],
    ['ContractChangeOrder', 'changeReason'],
    ['ContractChangeOrder', 'amountDifference'],
    ['ContractChangeOrder', 'hasOverCollection'],
    ['IncomeContract', 'interOrgContractId'],
  ];

  for (const [model, field] of modelChecks) {
    it(`${model} 应有 ${field} 字段`, () => {
      const rdm = (prisma as any)._runtimeDataModel;
      expect(rdm).toBeDefined();
      const models = rdm.models as Record<string, { fields: Array<{ name: string }> }>;
      const modelDef = models[model];
      expect(modelDef).toBeDefined();
      const fieldNames = modelDef.fields.map((f: any) => f.name);
      expect(fieldNames).toContain(field);
    });
  }
});
