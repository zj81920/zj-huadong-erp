import { describe, it, expect } from 'vitest';

interface SupplierFormData {
  name: string;
  supplierType: string;
  contactPerson: string;
  phone: string;
  bankName: string;
  bankAccount: string;
  address: string;
}

function validateSupplierForm(form: SupplierFormData): string | null {
  if (!form.name.trim()) return "供应商名称不能为空";
  if (!form.supplierType) return "请选择供应商性质";
  if (!form.contactPerson.trim()) return "联系人不能为空";
  if (!form.phone.trim()) return "电话不能为空";
  if (!form.bankName.trim()) return "开户行信息不能为空";
  if (!form.bankAccount.trim()) return "开户行账号不能为空";
  if (!form.address.trim()) return "地址不能为空";
  return null;
}

describe("validateSupplierForm", () => {
  const valid: SupplierFormData = { name: "测试", supplierType: "企业", contactPerson: "张三", phone: "138", bankName: "工行", bankAccount: "6222", address: "北京" };

  it("returns error when supplierType is empty", () => {
    expect(validateSupplierForm({ ...valid, supplierType: "" })).toBe("请选择供应商性质");
  });
  it("returns error when contactPerson is empty", () => {
    expect(validateSupplierForm({ ...valid, contactPerson: "" })).toBe("联系人不能为空");
  });
  it("returns error when phone is empty", () => {
    expect(validateSupplierForm({ ...valid, phone: "" })).toBe("电话不能为空");
  });
  it("returns error when bankName is empty", () => {
    expect(validateSupplierForm({ ...valid, bankName: "" })).toBe("开户行信息不能为空");
  });
  it("returns error when bankAccount is empty", () => {
    expect(validateSupplierForm({ ...valid, bankAccount: "" })).toBe("开户行账号不能为空");
  });
  it("returns error when address is empty", () => {
    expect(validateSupplierForm({ ...valid, address: "" })).toBe("地址不能为空");
  });
  it("returns null when all fields valid", () => {
    expect(validateSupplierForm(valid)).toBeNull();
  });
});
