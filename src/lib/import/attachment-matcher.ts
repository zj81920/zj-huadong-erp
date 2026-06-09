// src/lib/import/attachment-matcher.ts
import type { ImportModule } from "./types";

/** 匹配结果 */
export interface AttachmentMatch {
  filePath: string;
  matchedId: string;
  confidence: "high" | "medium" | "low";
}

/** 目录名→模块映射 */
const DIR_MODULE_MAP: Record<string, ImportModule> = {
  "客户": "customers",
  "customer": "customers",
  "customers": "customers",
  "供应商": "suppliers",
  "supplier": "suppliers",
  "suppliers": "suppliers",
  "项目": "projects",
  "project": "projects",
  "projects": "projects",
  "收入合同": "income-contracts",
  "收入": "income-contracts",
  "income": "income-contracts",
  "income-contracts": "income-contracts",
  "支出合同": "expense-contracts",
  "支出": "expense-contracts",
  "expense": "expense-contracts",
  "expense-contracts": "expense-contracts",
  "发票": "invoices",
  "invoice": "invoices",
  "invoices": "invoices",
  "应收款": "receivables",
  "receivable": "receivables",
  "receivables": "receivables",
  "应付款": "payables",
  "payable": "payables",
  "payables": "payables",
};

/**
 * 从目录名检测所属模块
 */
export function detectModuleFromDirName(dirName: string): ImportModule | null {
  const cleaned = dirName.trim().toLowerCase();
  return DIR_MODULE_MAP[cleaned] ?? DIR_MODULE_MAP[dirName.trim()] ?? null;
}

/**
 * 从文件路径中提取纯文件名
 */
function extractFileName(filePath: string): string {
  // 处理 Windows 和 Unix 路径分隔符
  const parts = filePath.replace(/\\/g, "/").split("/");
  const fullName = parts[parts.length - 1];
  // 去除扩展名
  const dotIndex = fullName.lastIndexOf(".");
  return dotIndex > 0 ? fullName.substring(0, dotIndex) : fullName;
}

/**
 * 将附件文件与业务编号进行匹配
 *
 * 匹配规则：
 * 1. 文件名以编号开头 → high confidence
 * 2. 文件名包含编号 → medium confidence
 *
 * @param filePaths - 附件文件路径列表
 * @param ids - 业务编号列表（如合同编号、项目编号）
 * @returns 匹配结果列表（仅包含成功匹配的）
 */
export function matchAttachments(
  filePaths: string[],
  ids: string[],
): AttachmentMatch[] {
  const results: AttachmentMatch[] = [];

  for (const filePath of filePaths) {
    const fileName = extractFileName(filePath);

    for (const id of ids) {
      // 精确：文件名以编号开头
      if (fileName.startsWith(id)) {
        results.push({ filePath, matchedId: id, confidence: "high" });
        break;
      }
      // 文件名包含编号
      if (fileName.includes(id)) {
        results.push({ filePath, matchedId: id, confidence: "medium" });
        break;
      }
    }
    // 未能匹配的文件不加入结果
  }

  return results;
}
