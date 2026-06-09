// src/lib/import/ai-mapper.ts
import type { ImportModule, ColumnMapping, AnalyzeResult } from "./types";
import { MODULE_REGISTRY, getTargetFieldDescriptions } from "./module-registry";
import { parseExcel } from "./excel-parser";

/** Levenshtein 编辑距离（用于模糊匹配） */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** 相似度（0-1，值越高越相似） */
function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.9;
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(aLower, bLower) / maxLen;
}

/** 中英文常见对照映射 */
const CN_EN_COMMON: Record<string, string[]> = {
  "编号": ["no", "code", "number", "id"],
  "名称": ["name", "title", "fullName"],
  "日期": ["date", "time", "day"],
  "金额": ["amount", "money", "total", "price", "value", "sum"],
  "客户": ["customer", "client", "buyer", "甲方"],
  "供应商": ["supplier", "vendor", "乙方", "供货商"],
  "项目": ["project"],
  "合同": ["contract", "agreement"],
  "联系人": ["contact", "contactPerson", "联系人"],
  "电话": ["phone", "tel", "mobile", "telephone"],
  "地址": ["address", "addr", "location"],
  "邮箱": ["email", "mail"],
  "状态": ["status", "state"],
  "类型": ["type", "category", "kind"],
  "税率": ["taxRate", "tax_rate", "tax"],
  "税额": ["taxAmount", "tax_amount"],
  "发票": ["invoice"],
  "备注": ["remark", "note", "memo", "comment", "desc"],
  "摘要": ["summary", "abstract"],
};

/**
 * 检测 Excel 中哪些中文词汇不太可能有直接英文对应，
 * 用于让用户确认映射关系时的提示
 */
function getCnKeywordHints(excelColumn: string): string[] {
  const hints: string[] = [];
  for (const [cn, enList] of Object.entries(CN_EN_COMMON)) {
    if (excelColumn.includes(cn)) {
      hints.push(...enList);
    }
  }
  return hints;
}

/** 计算 Excel 列名与目标字段的匹配得分 */
function scoreMatch(
  excelColumn: string,
  targetField: string,
  targetLabel: string,
): number {
  let totalScore = 0;

  // 精确匹配标签名（中文）
  if (excelColumn === targetLabel) {
    totalScore += 10;
  }

  // 精确匹配字段名（英文）
  if (excelColumn.toLowerCase() === targetField.toLowerCase()) {
    totalScore += 10;
  }

  // 包含匹配
  if (excelColumn.includes(targetLabel) || targetLabel.includes(excelColumn)) {
    totalScore += 5;
  }

  // 英文字段名模糊匹配
  const sim = similarity(excelColumn, targetField);
  if (sim > 0.6) {
    totalScore += Math.round(sim * 5);
  }

  // 中文标签模糊匹配
  const simCn = similarity(excelColumn, targetLabel);
  if (simCn > 0.5) {
    totalScore += Math.round(simCn * 4);
  }

  // 中英文常见词匹配
  const keywords = getCnKeywordHints(excelColumn);
  const fieldLower = targetField.toLowerCase();
  if (keywords.some((kw) => fieldLower.includes(kw))) {
    totalScore += 3;
  }
  if (keywords.some((kw) => targetLabel.includes(kw))) {
    totalScore += 2;
  }

  return totalScore;
}

/** 推断文件属于哪个模块（基于列名匹配度） */
function detectModule(
  headers: string[],
): { module: ImportModule; moduleName: string; confidence: number } | null {
  type ModuleScore = { module: ImportModule; moduleName: string; score: number; totalFields: number };

  const scores: ModuleScore[] = [];

  for (const [key, config] of Object.entries(MODULE_REGISTRY)) {
    let score = 0;
    for (const header of headers) {
      for (const field of config.fields) {
        const s = scoreMatch(header, field.field, field.label);
        if (s >= 7) score += s; // 只计高分匹配
      }
    }
    scores.push({
      module: key as ImportModule,
      moduleName: config.moduleName,
      score,
      totalFields: config.fields.length,
    });
  }

  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (best.score < 5) return null;

  const confidence = Math.min(1, best.score / (best.totalFields * 3));
  return { module: best.module, moduleName: best.moduleName, confidence };
}

/** 分析 Excel 文件并生成列映射建议 */
export function analyzeExcel(
  buffer: ArrayBuffer,
  fileName: string,
): { result: AnalyzeResult; mappings: ColumnMapping[] } {
  const parsed = parseExcel(buffer);

  // 推断模块
  const detected = detectModule(parsed.headers);
  if (!detected) {
    return {
      result: {
        module: "customers",
        moduleName: "未知",
        fileName,
        columns: parsed.headers,
        suggestedMappings: [],
        unmatchedColumns: parsed.headers,
        rowCount: parsed.rowCount,
        attachmentFiles: [],
      },
      mappings: [],
    };
  }

  const config = MODULE_REGISTRY[detected.module];
  const mappings: ColumnMapping[] = [];
  const unmatched: string[] = [];

  // 为每个列找到最佳映射
  for (const excelCol of parsed.headers) {
    let bestField: string | null = null;
    let bestScore = 0;
    let bestLabel = "";
    let bestFormat: "date" | "decimal" | "string" | undefined;
    let bestLookup: ColumnMapping["lookup"];

    for (const field of config.fields) {
      const s = scoreMatch(excelCol, field.field, field.label);
      if (s > bestScore) {
        bestScore = s;
        bestField = field.field;
        bestLabel = field.label;
        bestFormat = field.type === "date" ? "date" : field.type === "decimal" ? "decimal" : "string";
        bestLookup = field.lookup
          ? { type: field.lookup.type, nameField: field.lookup.nameField, idField: field.lookup.idField }
          : undefined;
      }
    }

    if (bestField && bestScore >= 3) {
      const confidence = Math.min(1, bestScore / 10);
      mappings.push({
        excelColumn: excelCol,
        targetField: bestField,
        confidence,
        status: confidence >= 0.8 ? "auto" : "confirm",
        format: bestFormat,
        lookup: bestLookup,
      });
    } else {
      unmatched.push(excelCol);
    }
  }

  return {
    result: {
      module: detected.module,
      moduleName: detected.moduleName,
      fileName,
      columns: parsed.headers,
      suggestedMappings: mappings,
      unmatchedColumns: unmatched,
      rowCount: parsed.rowCount,
      attachmentFiles: [],
    },
    mappings,
  };
}

/** 获取目标模块字段描述（供 AI 提示使用） */
export function getFieldDescriptionsForModule(module: ImportModule): string {
  const config = MODULE_REGISTRY[module];
  const lines: string[] = [`模块: ${config.moduleName}`];
  config.fields.forEach((f) => {
    const extra = f.required ? "必填" : "可选";
    const lookup = f.lookup ? `(关联查找: ${f.lookup.type})` : "";
    const def = f.defaultValue ? `默认值: ${f.defaultValue}` : "";
    lines.push(`  - ${f.field}: ${f.label} (${f.type}) ${extra} ${lookup} ${def}`);
  });
  return lines.join("\n");
}

/** 获取全部模块的 AI 提示上下文 */
export function getAllModuleContexts(): string {
  return getTargetFieldDescriptions();
}
