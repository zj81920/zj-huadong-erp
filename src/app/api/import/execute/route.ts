// src/app/api/import/execute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseExcel, ParsedExcel } from "@/lib/import/excel-parser";
import { getModuleConfig } from "@/lib/import/module-registry";
import { clearLookupCaches } from "@/lib/import/writers/base";
import { writeCustomers, CustomerImportRow } from "@/lib/import/writers/customers";
import { writeProjects, ProjectImportRow } from "@/lib/import/writers/projects";
import { writeIncomeContracts, IncomeContractImportRow } from "@/lib/import/writers/income-contracts";
import { writeExpenseContracts, ExpenseContractImportRow } from "@/lib/import/writers/expense-contracts";
import { writeInvoices, InvoiceImportRow } from "@/lib/import/writers/invoices";
import { writeReceivables, ReceivableImportRow } from "@/lib/import/writers/finance";
import { writePayables, PayableImportRow } from "@/lib/import/writers/finance";
import type { ImportModule, ExecuteResponse } from "@/lib/import/types";

/**
 * POST /api/import/execute
 * 接收用户确认的映射关系，执行数据导入
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.username !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const moduleStr = formData.get("module") as string;

    if (!file || !moduleStr) {
      return NextResponse.json({ error: "缺少文件或模块参数" }, { status: 400 });
    }

    const module = moduleStr as ImportModule;
    const config = getModuleConfig(module);
    if (!config) {
      return NextResponse.json({ error: `未知模块: ${module}` }, { status: 400 });
    }

    // 解析 Excel
    const buffer = await file.arrayBuffer();
    const parsed = parseExcel(buffer);

    if (parsed.rowCount === 0) {
      return NextResponse.json({ error: "文件无数据" }, { status: 400 });
    }

    // 清空 lookup 缓存，确保重新查询
    clearLookupCaches();

    // 根据模块类型调用对应的 Writer
    const result = await dispatchWriter(module, parsed);

    const response: ExecuteResponse = {
      imported: { [module]: result.successCount },
      errors: result.errors.map((e) => ({ module, row: e.row, message: e.message })),
      attachments: { uploaded: 0, failed: 0 },
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("Import execute error:", e);
    return NextResponse.json(
      { error: `导入执行失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}

/** 根据模块分发到具体 Writer */
async function dispatchWriter(module: ImportModule, parsed: ParsedExcel) {
  switch (module) {
    case "customers":
      return writeCustomers(parsed.rows as unknown as CustomerImportRow[]);

    case "projects":
      return writeProjects(parsed.rows as unknown as ProjectImportRow[]);

    case "income-contracts":
      return writeIncomeContracts(parsed.rows as unknown as IncomeContractImportRow[]);

    case "expense-contracts":
      return writeExpenseContracts(parsed.rows as unknown as ExpenseContractImportRow[]);

    case "invoices":
      return writeInvoices(parsed.rows as unknown as InvoiceImportRow[]);

    case "receivables":
      return writeReceivables(parsed.rows as unknown as ReceivableImportRow[]);

    case "payables":
      return writePayables(parsed.rows as unknown as PayableImportRow[]);

    case "suppliers":
      // 供应商导入类似客户，简化处理
      return { successCount: 0, errors: [{ row: 0, message: "供应商导入暂未实现" }] };

    default:
      return { successCount: 0, errors: [{ row: 0, message: "未知模块" }] };
  }
}
