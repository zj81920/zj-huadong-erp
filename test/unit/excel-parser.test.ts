// test/unit/excel-parser.test.ts
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel, getExcelRowCount } from "../../src/lib/import/excel-parser";

/** 辅助函数：生成测试用的 Excel buffer */
function makeExcelBuffer(headers: string[], rows: unknown[][]): ArrayBuffer {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseExcel", () => {
  it("空 Excel 返回空结果", () => {
    const buf = makeExcelBuffer([], []);
    const result = parseExcel(buf);
    expect(result.rowCount).toBe(0);
  });

  it("3 行数据返回正确行数和表头", () => {
    const buf = makeExcelBuffer(["A", "B"], [
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
    const result = parseExcel(buf);
    expect(result.rowCount).toBe(3);
    expect(result.headers).toEqual(["A", "B"]);
    expect(result.rows[0]["A"]).toBe("1");
  });

  it("空值单元格返回空字符串", () => {
    const buf = makeExcelBuffer(["A", "B"], [["hello", undefined]]);
    const result = parseExcel(buf);
    expect(result.rows[0]["B"]).toBe("");
  });
});

describe("getExcelRowCount", () => {
  it("3 行数据返回 3", () => {
    const buf = makeExcelBuffer(["H"], [["1"], ["2"], ["3"]]);
    expect(getExcelRowCount(buf)).toBe(3);
  });

  it("空 Excel 返回 0", () => {
    const buf = makeExcelBuffer(["H"], []);
    expect(getExcelRowCount(buf)).toBe(0);
  });
});
