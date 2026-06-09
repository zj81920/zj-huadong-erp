// src/lib/import/types.ts

/** 导入模块标识 */
export type ImportModule =
  | "customers"
  | "suppliers"
  | "projects"
  | "income-contracts"
  | "expense-contracts"
  | "invoices"
  | "receivables"
  | "payables";

/** 列映射状态 */
export type MappingStatus = "auto" | "confirm" | "manual" | "skip";

/** 单列映射 */
export interface ColumnMapping {
  excelColumn: string;
  targetField: string;
  confidence: number;
  status: MappingStatus;
  /** lookup 类型字段的查找配置 */
  lookup?: {
    type: "customer" | "supplier" | "project" | "contract" | "organization";
    nameField: string;
    idField: string;
  };
  /** 字段格式 */
  format?: "date" | "decimal" | "string";
  /** 枚举值映射（旧值→新值） */
  enumMapping?: Record<string, string>;
}

/** AI 分析结果 */
export interface AnalyzeResult {
  module: ImportModule;
  moduleName: string;
  fileName: string;
  columns: string[];
  suggestedMappings: ColumnMapping[];
  unmatchedColumns: string[];
  rowCount: number;
  attachmentFiles: string[];
}

/** 预览数据行 */
export interface PreviewRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: ImportError[];
  warnings: string[];
}

/** 导入错误 */
export interface ImportError {
  field: string;
  message: string;
  type: "required" | "not_found" | "duplicate" | "format" | "enum";
}

/** 导入结果 */
export interface ImportResult {
  module: ImportModule;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
}

/** 导入配置 - 用户确认后的映射 */
export interface ConfirmedMapping {
  module: ImportModule;
  fileIndex: number;
  columnMappings: ColumnMapping[];
}

/** 导入执行请求 */
export interface ExecuteRequest {
  confirmToken: string;
}

/** 导入执行响应 */
export interface ExecuteResponse {
  imported: Record<string, number>;
  errors: Array<{ module: string; row: number; message: string }>;
  attachments: { uploaded: number; failed: number };
}
