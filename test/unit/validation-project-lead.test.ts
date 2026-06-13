import { describe, it, expect } from 'vitest';

interface LeadFormData {
  customerId: string;
  projectName: string;
  projectNature: string;
  implementationEntity: string;
}

function validateLeadForm(form: LeadFormData): string | null {
  if (!form.customerId) return "请选择客户";
  if (!form.projectName.trim()) return "项目名称不能为空";
  if (!form.projectNature) return "请选择项目性质";
  if (!form.implementationEntity.trim()) return "请选择实施主体";
  return null;
}

describe("validateLeadForm", () => {
  const valid: LeadFormData = { customerId: "c1", projectName: "线索A", projectNature: "设计", implementationEntity: "华东" };

  it("returns error when projectNature is empty", () => {
    expect(validateLeadForm({ ...valid, projectNature: "" })).toBe("请选择项目性质");
  });
  it("returns null when all fields valid", () => {
    expect(validateLeadForm(valid)).toBeNull();
  });
});
