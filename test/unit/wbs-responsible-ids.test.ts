import { describe, it, expect } from "vitest";
import { parseResponsibleIds, isOutsourcingEntry, getResponsibleNames, hasOutsourcingEntry, ResponsibleEntry } from "@/lib/wbs-utils";

describe("parseResponsibleIds", () => {
  it("兼容旧格式: string[]", () => {
    const result = parseResponsibleIds(["user_1", "user_2"]);
    expect(result).toEqual([
      { type: "person", id: "user_1", name: "" },
      { type: "person", id: "user_2", name: "" },
    ]);
  });

  it("兼容新格式: {type,id,name}[]", () => {
    const result = parseResponsibleIds([
      { type: "person", id: "user_1", name: "张三" },
      { type: "outsourcing", id: "out_1", name: "华东设计院" },
    ]);
    expect(result).toEqual([
      { type: "person", id: "user_1", name: "张三" },
      { type: "outsourcing", id: "out_1", name: "华东设计院" },
    ]);
  });

  it("空数组返回空数组", () => {
    expect(parseResponsibleIds([])).toEqual([]);
  });

  it("null/undefined 返回空数组", () => {
    expect(parseResponsibleIds(null as any)).toEqual([]);
    expect(parseResponsibleIds(undefined as any)).toEqual([]);
  });

  it("混合格式兼容（数组中同时有 string 和 object）", () => {
    const result = parseResponsibleIds([
      "user_1",
      { type: "outsourcing", id: "out_1", name: "华东设计院" },
    ]);
    expect(result).toEqual([
      { type: "person", id: "user_1", name: "" },
      { type: "outsourcing", id: "out_1", name: "华东设计院" },
    ]);
  });
});

describe("isOutsourcingEntry", () => {
  it("外包条目返回 true", () => {
    expect(isOutsourcingEntry({ type: "outsourcing", id: "out_1", name: "华东设计院" })).toBe(true);
  });

  it("人员条目返回 false", () => {
    expect(isOutsourcingEntry({ type: "person", id: "user_1", name: "张三" })).toBe(false);
  });
});

describe("getResponsibleNames", () => {
  it("提取所有名称（人员+外包）", () => {
    const parsed: ResponsibleEntry[] = [
      { type: "person", id: "user_1", name: "张三" },
      { type: "outsourcing", id: "out_1", name: "华东设计院" },
    ];
    expect(getResponsibleNames(parsed)).toEqual(["张三", "华东设计院"]);
  });

  it("旧格式人员没有 name 时显示 id", () => {
    const parsed: ResponsibleEntry[] = [{ type: "person", id: "user_1", name: "" }];
    expect(getResponsibleNames(parsed)).toEqual(["user_1"]);
  });
});

describe("hasOutsourcingEntry", () => {
  it("有外包条目返回 true", () => {
    expect(hasOutsourcingEntry([{ type: "outsourcing", id: "out_1", name: "华东设计院" }])).toBe(true);
  });

  it("无外包条目返回 false", () => {
    expect(hasOutsourcingEntry([{ type: "person", id: "user_1", name: "张三" }])).toBe(false);
  });

  it("特定外包 ID 匹配", () => {
    expect(hasOutsourcingEntry(
      [{ type: "outsourcing", id: "out_1", name: "华东设计院" }],
      "out_1"
    )).toBe(true);
    expect(hasOutsourcingEntry(
      [{ type: "outsourcing", id: "out_1", name: "华东设计院" }],
      "out_2"
    )).toBe(false);
  });
});
