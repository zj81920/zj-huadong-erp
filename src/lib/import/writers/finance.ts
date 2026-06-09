// src/lib/import/writers/finance.ts
import type { WriteResult } from "./base";
import { PrismaClient } from "@prisma/client";
import { lookupProjectId, lookupIncomeContractId, lookupExpenseContractId, parseDate, parseDecimal, lookupOrganizationId } from "./base";

const prisma = new PrismaClient();

// ==================== 应收款 ====================

export interface ReceivableImportRow {
  sourceType: string;
  sourceContractNo: string;
  projectSourceId?: string;
  dueDate: string;
  amount: string | number;
  paidAmount?: string | number;
  status?: string;
  organizationName?: string;
}

export async function writeReceivables(
  rows: ReceivableImportRow[],
): Promise<WriteResult> {
  const result: WriteResult = { successCount: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const sourceId = await lookupIncomeContractId(row.sourceContractNo);
      if (!sourceId) {
        result.errors.push({ row: i + 1, message: `收入合同 "${row.sourceContractNo}" 不存在` });
        continue;
      }

      let projectSourceId: string | null = null;
      if (row.projectSourceId) {
        projectSourceId = await lookupProjectId(row.projectSourceId);
      }

      const dueDate = parseDate(row.dueDate);
      if (!dueDate) {
        result.errors.push({ row: i + 1, message: `到期日 "${row.dueDate}" 格式错误` });
        continue;
      }

      const amount = parseDecimal(row.amount);
      if (amount === null) {
        result.errors.push({ row: i + 1, message: "金额格式错误" });
        continue;
      }

      const paidAmount = parseDecimal(row.paidAmount ?? "0") ?? 0;
      const orgId = row.organizationName ? await lookupOrganizationId(row.organizationName) : undefined;

      await prisma.receivable.create({
        data: {
          sourceType: row.sourceType || "income_contract",
          sourceId,
          projectSourceId: projectSourceId || undefined,
          dueDate,
          amount,
          paidAmount,
          status: row.status || "未收",
          organizationId: orgId || undefined,
        },
      });

      result.successCount++;
    } catch (e) {
      result.errors.push({
        row: i + 1,
        message: `应收款导入失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return result;
}

// ==================== 应付款 ====================

export interface PayableImportRow {
  sourceType: string;
  sourceContractNo: string;
  projectSourceId?: string;
  dueDate: string;
  amount: string | number;
  paidAmount?: string | number;
  status?: string;
  organizationName?: string;
}

export async function writePayables(
  rows: PayableImportRow[],
): Promise<WriteResult> {
  const result: WriteResult = { successCount: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const sourceId = await lookupExpenseContractId(row.sourceContractNo);
      if (!sourceId) {
        result.errors.push({ row: i + 1, message: `支出合同 "${row.sourceContractNo}" 不存在` });
        continue;
      }

      let projectSourceId: string | null = null;
      if (row.projectSourceId) {
        projectSourceId = await lookupProjectId(row.projectSourceId);
      }

      const dueDate = parseDate(row.dueDate);
      if (!dueDate) {
        result.errors.push({ row: i + 1, message: `到期日 "${row.dueDate}" 格式错误` });
        continue;
      }

      const amount = parseDecimal(row.amount);
      if (amount === null) {
        result.errors.push({ row: i + 1, message: "金额格式错误" });
        continue;
      }

      const paidAmount = parseDecimal(row.paidAmount ?? "0") ?? 0;
      const orgId = row.organizationName ? await lookupOrganizationId(row.organizationName) : undefined;

      await prisma.payable.create({
        data: {
          sourceType: row.sourceType || "expense_contract",
          sourceId,
          projectSourceId: projectSourceId || undefined,
          dueDate,
          amount,
          paidAmount,
          status: row.status || "未付",
          organizationId: orgId || undefined,
        },
      });

      result.successCount++;
    } catch (e) {
      result.errors.push({
        row: i + 1,
        message: `应付款导入失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return result;
}
