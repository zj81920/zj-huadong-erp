// src/lib/import/writers/invoices.ts
import type { WriteResult } from "./base";
import { PrismaClient } from "@prisma/client";
import { lookupProjectId, lookupIncomeContractId, lookupExpenseContractId, parseDate, parseDecimal } from "./base";

const prisma = new PrismaClient();

export interface InvoiceImportRow {
  invoiceNo: string;
  invoiceCode?: string;
  invoiceType: string;
  invoiceCategory: string;
  invoiceDate: string;
  amount: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  sellerName?: string;
  sellerTaxNo?: string;
  buyerName?: string;
  buyerTaxNo?: string;
  projectSourceId?: string;
  sourceType: string;
  sourceContractNo?: string;
}

export async function writeInvoices(
  rows: InvoiceImportRow[],
): Promise<WriteResult> {
  const result: WriteResult = { successCount: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const invoiceDate = parseDate(row.invoiceDate);
      if (!invoiceDate) {
        result.errors.push({ row: i + 1, message: `开票日期 "${row.invoiceDate}" 格式错误` });
        continue;
      }

      const amount = parseDecimal(row.amount);
      const taxRate = parseDecimal(row.taxRate);
      const taxAmount = parseDecimal(row.taxAmount);
      const totalAmount = parseDecimal(row.totalAmount);
      if (amount === null || taxRate === null || taxAmount === null || totalAmount === null) {
        result.errors.push({ row: i + 1, message: "金额字段格式错误" });
        continue;
      }

      // 关联查找
      let projectSourceId: string | null = null;
      if (row.projectSourceId) {
        projectSourceId = await lookupProjectId(row.projectSourceId);
      }

      let sourceId: string | null = null;
      if (row.sourceContractNo) {
        if (row.sourceType === "income_contract") {
          sourceId = await lookupIncomeContractId(row.sourceContractNo);
        } else if (row.sourceType === "expense_contract") {
          sourceId = await lookupExpenseContractId(row.sourceContractNo);
        }
      }

      await prisma.invoice.create({
        data: {
          invoiceNo: row.invoiceNo,
          invoiceCode: row.invoiceCode || undefined,
          invoiceType: row.invoiceType,
          invoiceCategory: row.invoiceCategory,
          invoiceDate,
          amount,
          taxRate,
          taxAmount,
          totalAmount,
          sellerName: row.sellerName || undefined,
          sellerTaxNo: row.sellerTaxNo || undefined,
          buyerName: row.buyerName || undefined,
          buyerTaxNo: row.buyerTaxNo || undefined,
          projectSourceId: projectSourceId || undefined,
          sourceType: row.sourceType,
          sourceId: sourceId || undefined,
          status: "已登记",
          attachments: "[]",
        },
      });

      result.successCount++;
    } catch (e) {
      result.errors.push({
        row: i + 1,
        message: `发票 "${row.invoiceNo}" 导入失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return result;
}
