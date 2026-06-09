// test/unit/attachment-matcher.test.ts
import { describe, it, expect } from "vitest";
import {
  matchAttachments,
  detectModuleFromDirName,
} from "../../src/lib/import/attachment-matcher";

describe("matchAttachments", () => {
  it("文件名以合同编号开头的精确匹配", () => {
    const files = ["收入合同/合同扫描件/HT-2024-001.pdf"];
    const ids = ["HT-2024-001", "HT-2024-002"];
    const result = matchAttachments(files, ids);
    expect(result).toHaveLength(1);
    expect(result[0].matchedId).toBe("HT-2024-001");
    expect(result[0].confidence).toBe("high");
  });

  it("文件名包含合同编号的模糊匹配", () => {
    const files = ["扫描件/合同扫描件-HT-2024-002.pdf"];
    const ids = ["HT-2024-001", "HT-2024-002"];
    const result = matchAttachments(files, ids);
    expect(result).toHaveLength(1);
    expect(result[0].matchedId).toBe("HT-2024-002");
    expect(result[0].confidence).toBe("medium");
  });

  it("无法匹配的文件不返回结果", () => {
    const files = ["合同扫描件/unknown.pdf"];
    const ids = ["HT-2024-001", "HT-2024-002"];
    const result = matchAttachments(files, ids);
    expect(result).toHaveLength(0);
  });

  it("多个文件同时匹配", () => {
    const files = ["HT-2024-001_scan.pdf", "HT-2024-002_scan.pdf"];
    const ids = ["HT-2024-001", "HT-2024-002"];
    const result = matchAttachments(files, ids);
    expect(result).toHaveLength(2);
  });

  it("从完整路径提取文件名匹配", () => {
    const files = ["收入合同/合同扫描件/HT-2024-001_盖章版.pdf"];
    const ids = ["HT-2024-001"];
    const result = matchAttachments(files, ids);
    expect(result).toHaveLength(1);
    expect(result[0].matchedId).toBe("HT-2024-001");
  });
});

describe("detectModuleFromDirName", () => {
  it("'客户' 映射到 customers", () => {
    expect(detectModuleFromDirName("客户")).toBe("customers");
  });
  it("'收入合同' 映射到 income-contracts", () => {
    expect(detectModuleFromDirName("收入合同")).toBe("income-contracts");
  });
  it("'invoice'（英文）映射到 invoices", () => {
    expect(detectModuleFromDirName("invoice")).toBe("invoices");
  });
  it("'财务' 映射到 finance", () => {
    expect(detectModuleFromDirName("财务")).toBe("finance");
  });
  it("未识别的目录名返回 null", () => {
    expect(detectModuleFromDirName("未知目录")).toBeNull();
  });
});
