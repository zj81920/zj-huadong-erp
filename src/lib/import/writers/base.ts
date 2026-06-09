// src/lib/import/writers/base.ts
import type { ImportError, PreviewRow } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ==================== 工具函数 ====================

/** 解析日期字符串 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  if (!str) return null;

  // 尝试多种中文日期格式
  const cnMatch = str.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (cnMatch) {
    return new Date(Number(cnMatch[1]), Number(cnMatch[2]) - 1, Number(cnMatch[3]));
  }

  // 标准化分隔符为 -
  const normalized = str.replace(/\//g, "-").replace(/\./g, "-");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** 解析十进制数 */
export function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const str = String(value).replace(/,/g, "").trim();
  const num = Number(str);
  return isNaN(num) ? null : num;
}

/** 应用枚举值映射 */
export function applyEnumMapping(
  value: string,
  enumMap?: Record<string, string>,
): string {
  if (!enumMap || Object.keys(enumMap).length === 0) return value;
  return enumMap[value] ?? value;
}

/** 校验必填字段 */
export function validateRequired(
  row: Record<string, unknown>,
  requiredFields: string[],
): ImportError[] {
  const errors: ImportError[] = [];
  for (const field of requiredFields) {
    const val = row[field];
    if (val === null || val === undefined || String(val).trim() === "") {
      errors.push({ field, message: `${field} 为必填项`, type: "required" });
    }
  }
  return errors;
}

// ==================== Lookup 缓存（避免重复查询） ====================

/** 客户名称 → ID */
const customerCache = new Map<string, string>();
/** 供应商名称 → ID */
const supplierCache = new Map<string, string>();
/** 项目编号 → projectSourceId */
const projectCache = new Map<string, string>();
/** 收入合同编号 → ID */
const incomeContractCache = new Map<string, string>();
/** 支出合同编号 → ID */
const expenseContractCache = new Map<string, string>();
/** 组织名称 → ID */
const orgCache = new Map<string, string>();

/** 查找客户 ID */
export async function lookupCustomerId(name: string): Promise<string | null> {
  if (customerCache.has(name)) return customerCache.get(name)!;
  const row = await prisma.customer.findFirst({
    where: { name },
    select: { id: true },
  });
  if (row) {
    customerCache.set(name, row.id);
    return row.id;
  }
  return null;
}

/** 查找供应商 ID */
export async function lookupSupplierId(name: string): Promise<string | null> {
  if (supplierCache.has(name)) return supplierCache.get(name)!;
  const row = await prisma.supplier.findFirst({
    where: { name },
    select: { id: true },
  });
  if (row) {
    supplierCache.set(name, row.id);
    return row.id;
  }
  return null;
}

/** 查找项目 projectSourceId */
export async function lookupProjectId(projectCode: string): Promise<string | null> {
  if (projectCache.has(projectCode)) return projectCache.get(projectCode)!;
  const row = await prisma.project.findFirst({
    where: { projectCode },
    select: { projectSourceId: true },
  });
  if (row) {
    projectCache.set(projectCode, row.projectSourceId);
    return row.projectSourceId;
  }
  return null;
}

/** 查找收入合同 ID */
export async function lookupIncomeContractId(contractNo: string): Promise<string | null> {
  if (incomeContractCache.has(contractNo)) return incomeContractCache.get(contractNo)!;
  const row = await prisma.income_contract.findFirst({
    where: { contractNo },
    select: { id: true },
  });
  if (row) {
    incomeContractCache.set(contractNo, row.id);
    return row.id;
  }
  return null;
}

/** 查找支出合同 ID */
export async function lookupExpenseContractId(contractNo: string): Promise<string | null> {
  if (expenseContractCache.has(contractNo)) return expenseContractCache.get(contractNo)!;
  const row = await prisma.expense_contract.findFirst({
    where: { contractNo },
    select: { id: true },
  });
  if (row) {
    expenseContractCache.set(contractNo, row.id);
    return row.id;
  }
  return null;
}

/** 查找组织 ID */
export async function lookupOrganizationId(name: string): Promise<string | null> {
  if (orgCache.has(name)) return orgCache.get(name)!;
  const row = await prisma.organization.findFirst({
    where: { name },
    select: { id: true },
  });
  if (row) {
    orgCache.set(name, row.id);
    return row.id;
  }
  return null;
}

/** 清空所有缓存 */
export function clearLookupCaches(): void {
  customerCache.clear();
  supplierCache.clear();
  projectCache.clear();
  incomeContractCache.clear();
  expenseContractCache.clear();
  orgCache.clear();
}

// ==================== 通用写入器基类 ====================

/** 写入结果 */
export interface WriteResult {
  successCount: number;
  errors: Array<{ row: number; message: string }>;
}

/** 生成预览行 */
export function buildPreviewRows(
  rawRows: Record<string, string>[],
  requiredFields: string[],
): PreviewRow[] {
  return rawRows.map((row, i) => {
    const errors = validateRequired(row, requiredFields);
    return {
      rowIndex: i + 1,
      data: row,
      errors,
      warnings: [],
    };
  });
}
