import { describe, it, expect } from 'vitest';

interface ProjectFormData {
  projectCode: string;
  name: string;
  customerId: string;
  projectContent: string;
  address: string;
  projectCategory: string;
  designPhases: string[];
  status: string;
  designManagerId: string;
  supervisorLeaderId: string;
}

function validateProjectForm(form: ProjectFormData): string | null {
  if (!form.projectCode.trim()) return "项目编号不能为空";
  if (!form.name.trim()) return "项目名称不能为空";
  if (!form.customerId) return "请选择客户";
  if (!form.projectContent.trim()) return "项目内容描述不能为空";
  if (!form.address.trim()) return "地址不能为空";
  if (!form.projectCategory) return "请选择类别";
  if (!form.designPhases || form.designPhases.length === 0) return "请选择设计阶段";
  if (!form.status) return "请选择状态";
  if (!form.designManagerId) return "请选择设计经理";
  if (!form.supervisorLeaderId) return "请选择主管领导";
  return null;
}

describe("validateProjectForm", () => {
  const valid: ProjectFormData = {
    projectCode: "P001", name: "项目A", customerId: "c1",
    projectContent: "内容", address: "北京", projectCategory: "设计",
    designPhases: ["方案设计"], status: "执行", designManagerId: "u1", supervisorLeaderId: "u2",
  };

  it("returns error when projectContent is empty", () => {
    expect(validateProjectForm({ ...valid, projectContent: "" })).toBe("项目内容描述不能为空");
  });
  it("returns error when address is empty", () => {
    expect(validateProjectForm({ ...valid, address: "" })).toBe("地址不能为空");
  });
  it("returns error when projectCategory is empty", () => {
    expect(validateProjectForm({ ...valid, projectCategory: "" })).toBe("请选择类别");
  });
  it("returns error when designPhases is empty", () => {
    expect(validateProjectForm({ ...valid, designPhases: [] })).toBe("请选择设计阶段");
  });
  it("returns error when designManagerId is empty", () => {
    expect(validateProjectForm({ ...valid, designManagerId: "" })).toBe("请选择设计经理");
  });
  it("returns error when supervisorLeaderId is empty", () => {
    expect(validateProjectForm({ ...valid, supervisorLeaderId: "" })).toBe("请选择主管领导");
  });
  it("returns null when all fields valid", () => {
    expect(validateProjectForm(valid)).toBeNull();
  });
});
