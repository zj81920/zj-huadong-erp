// src/lib/import/writers/income-contracts.ts
import type { WriteResult } from "./base";
import prisma from "@/lib/prisma";
import { lookupCustomerId, lookupProjectId, parseDate, parseDecimal, lookupOrganizationId } from "./base";

export interface IncomeContractImportRow {
  contractNo: string;
  customerName: string;
  projectSourceId?: string;
  signedDate?: string;
  totalAmount: string | number;
  taxRate?: string;
  pricingMethod?: string;
  contractSummary?: string;
  paymentTerms?: string;
  organizationName?: string;
  status?: string;
}

export async function writeIncomeContracts(
  rows: IncomeContractImportRow[],
): Promise<WriteResult> {
  const result: WriteResult = { successCount: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const customerId = await lookupCustomerId(row.customerName);
      if (!customerId) {
        result.errors.push({ row: i + 1, message: `客户 "${row.customerName}" 不存在` });
        continue;
      }

      let projectSourceId: string | null = null;
      if (row.projectSourceId) {
        projectSourceId = await lookupProjectId(row.projectSourceId);
        if (!projectSourceId) {
          result.errors.push({ row: i + 1, message: `项目 "${row.projectSourceId}" 不存在` });
          continue;
        }
      }

      const orgId = row.organizationName
        ? await lookupOrganizationId(row.organizationName)
        : undefined;

      const totalAmount = parseDecimal(row.totalAmount);
      if (totalAmount === null) {
        result.errors.push({ row: i + 1, message: `合同金额 "${row.totalAmount}" 格式错误` });
        continue;
      }

      // 去重检查
      const existing = await prisma.incomeContract.findUnique({
        where: { contractNo: row.contractNo },
        select: { id: true },
      });
      if (existing) {
        result.successCount++;
        continue;
      }

      await prisma.incomeContract.create({
        data: {
          contractNo: row.contractNo,
          customerId,
          projectSourceId: projectSourceId || undefined,
          signedDate: parseDate(row.signedDate),
          totalAmount,
          taxRate: row.taxRate || undefined,
          pricingMethod: row.pricingMethod || undefined,
          contractSummary: row.contractSummary || undefined,
          paymentTerms: row.paymentTerms || undefined,
          status: row.status || "已生效",
          organizationId: orgId || undefined,
        },
      });

      result.successCount++;
    } catch (e) {
      result.errors.push({
        row: i + 1,
        message: `收入合同 "${row.contractNo}" 导入失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return result;
}
