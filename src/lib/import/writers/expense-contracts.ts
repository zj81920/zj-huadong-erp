// src/lib/import/writers/expense-contracts.ts
import type { WriteResult } from "./base";
import prisma from "@/lib/prisma";
import { lookupSupplierId, lookupProjectId, parseDate, parseDecimal, lookupOrganizationId } from "./base";

export interface ExpenseContractImportRow {
  contractNo: string;
  supplierName: string;
  projectSourceId?: string;
  signedDate?: string;
  totalAmount: string | number;
  contractType?: string;
  taxRate?: string;
  paymentTerms?: string;
  organizationName?: string;
  status?: string;
}

export async function writeExpenseContracts(
  rows: ExpenseContractImportRow[],
): Promise<WriteResult> {
  const result: WriteResult = { successCount: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const supplierId = await lookupSupplierId(row.supplierName);
      if (!supplierId) {
        result.errors.push({ row: i + 1, message: `供应商 "${row.supplierName}" 不存在` });
        continue;
      }

      let projectSourceId: string | null = null;
      if (row.projectSourceId) {
        projectSourceId = await lookupProjectId(row.projectSourceId);
      }

      const orgId = row.organizationName
        ? await lookupOrganizationId(row.organizationName)
        : undefined;

      const totalAmount = parseDecimal(row.totalAmount);
      if (totalAmount === null) {
        result.errors.push({ row: i + 1, message: `合同金额 "${row.totalAmount}" 格式错误` });
        continue;
      }

      const existing = await prisma.expenseContract.findUnique({
        where: { contractNo: row.contractNo },
        select: { id: true },
      });
      if (existing) {
        result.successCount++;
        continue;
      }

      await prisma.expenseContract.create({
        data: {
          contractNo: row.contractNo,
          supplierId: supplierId || undefined,
          projectSourceId: projectSourceId || undefined,
          signedDate: parseDate(row.signedDate),
          totalAmount,
          contractType: row.contractType || "其他",
          taxRate: row.taxRate || undefined,
          paymentTerms: row.paymentTerms || undefined,
          status: row.status || "已生效",
          organizationId: orgId || undefined,
        },
      });

      result.successCount++;
    } catch (e) {
      result.errors.push({
        row: i + 1,
        message: `支出合同 "${row.contractNo}" 导入失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return result;
}
