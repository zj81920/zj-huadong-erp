// src/lib/import/excel-parser.ts
import * as XLSX from "xlsx";

/** 解析后的 Excel 数据 */
export interface ParsedExcel {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
}

/** 从 Excel buffer 解析数据 */
export function parseExcel(buffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  const sheet = workbook.Sheets[sheetName];
  // sheet_to_json with header 1 returns an array of row arrays
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  if (rows.length === 0) {
    return { headers: [], rows: [], rowCount: 0 };
  }

  // 第一行是表头
  const headers = rows[0].map((h) => String(h ?? ""));
  // 剩余行是数据
  const dataRows = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = String(row[i] ?? "");
    });
    return obj;
  });

  return {
    headers,
    rows: dataRows,
    rowCount: dataRows.length,
  };
}

/** 仅获取行数（快速检查） */
export function getExcelRowCount(buffer: ArrayBuffer): number {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return 0;

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    blankrows: false,
  });
  return Math.max(0, rows.length - 1); // 减去表头行
}
