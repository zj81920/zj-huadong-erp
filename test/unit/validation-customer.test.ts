import { describe, it, expect } from 'vitest';

interface CustomerFormData {
  name: string;
  ownershipType: string;
  customerGrade: string;
}

function validateCustomerForm(form: CustomerFormData): string | null {
  if (!form.name.trim()) return "客户名称不能为空";
  if (!form.ownershipType) return "请选择客户属性";
  if (!form.customerGrade) return "请选择客户等级";
  return null;
}

describe("validateCustomerForm", () => {
  it("returns error when ownershipType is empty", () => {
    const form: CustomerFormData = { name: "测试客户", ownershipType: "", customerGrade: "C" };
    expect(validateCustomerForm(form)).toBe("请选择客户属性");
  });

  it("returns error when customerGrade is empty", () => {
    const form: CustomerFormData = { name: "测试客户", ownershipType: "国有", customerGrade: "" };
    expect(validateCustomerForm(form)).toBe("请选择客户等级");
  });

  it("returns null when all fields valid", () => {
    const form: CustomerFormData = { name: "测试客户", ownershipType: "民营", customerGrade: "A" };
    expect(validateCustomerForm(form)).toBeNull();
  });

  it("returns error when name is empty", () => {
    const form: CustomerFormData = { name: "", ownershipType: "国有", customerGrade: "A" };
    expect(validateCustomerForm(form)).toBe("客户名称不能为空");
  });
});
