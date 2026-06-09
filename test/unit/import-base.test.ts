// test/unit/import-base.test.ts
import { describe, it, expect } from "vitest";
import {
  parseDate,
  parseDecimal,
  applyEnumMapping,
  validateRequired,
} from "../../src/lib/import/writers/base";

describe("parseDate", () => {
  it("YYYY-MM-DD 格式正确解析", () => {
    const d = parseDate("2024-01-15");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(0); // 0 = January
    expect(d!.getDate()).toBe(15);
  });

  it("YYYY/M/D 格式正确解析", () => {
    const d = parseDate("2024/1/5");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(5);
  });

  it("YYYY年M月D日 格式正确解析", () => {
    const d = parseDate("2024年1月15日");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(15);
  });

  it("空值返回 null", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it("无效日期字符串返回 null", () => {
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("parseDecimal", () => {
  it("整数返回正确数值", () => {
    expect(parseDecimal(100)).toBe(100);
  });

  it("小数字符串返回正确数值", () => {
    expect(parseDecimal("500.50")).toBe(500.5);
  });

  it("空值返回 null", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal(null)).toBeNull();
  });

  it("千位分隔符的数字（去除逗号）", () => {
    expect(parseDecimal("1234.56")).toBe(1234.56);
  });
});

describe("applyEnumMapping", () => {
  const statusMap: Record<string, string> = { "已签": "已生效", "执行中": "执行中" };

  it("匹配到映射值时返回新值", () => {
    expect(applyEnumMapping("已签", statusMap)).toBe("已生效");
  });

  it("未匹配时返回原值", () => {
    expect(applyEnumMapping("未知状态", statusMap)).toBe("未知状态");
  });

  it("空映射表返回原值", () => {
    expect(applyEnumMapping("任意值", undefined)).toBe("任意值");
  });

  it("空值返回自身", () => {
    expect(applyEnumMapping("", statusMap)).toBe("");
  });
});

describe("validateRequired", () => {
  it("必填字段有空值时返回错误", () => {
    const errors = validateRequired({ name: "" }, ["name"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("name");
    expect(errors[0].type).toBe("required");
  });

  it("所有必填字段都有值时返回空数组", () => {
    const errors = validateRequired({ name: "test", age: 25 as unknown as string }, ["name", "age"]);
    expect(errors).toHaveLength(0);
  });

  it("null 值视为空", () => {
    const errors = validateRequired({ name: null }, ["name"]);
    expect(errors).toHaveLength(1);
  });
});
