import { describe, it, expect } from "vitest";
import { getRowStatusClass, STATUS_ROW_COLORS } from "@/lib/status-colors";

describe("STATUS_ROW_COLORS", () => {
  it("包含通用审批状态", () => {
    expect(STATUS_ROW_COLORS["草稿"]).toBe("row-status-draft");
    expect(STATUS_ROW_COLORS["审批中"]).toBe("row-status-pending");
    expect(STATUS_ROW_COLORS["已批准"]).toBe("row-status-approved");
    expect(STATUS_ROW_COLORS["已驳回"]).toBe("row-status-rejected");
    expect(STATUS_ROW_COLORS["已归档"]).toBe("row-status-archived");
  });

  it("合同归档和已生效映射到 archived", () => {
    expect(STATUS_ROW_COLORS["合同归档"]).toBe("row-status-archived");
    expect(STATUS_ROW_COLORS["已生效"]).toBe("row-status-archived");
  });

  it("应收应付映射正确", () => {
    expect(STATUS_ROW_COLORS["未收"]).toBe("row-status-pending");
    expect(STATUS_ROW_COLORS["部分收款"]).toBe("row-status-pending");
    expect(STATUS_ROW_COLORS["已收"]).toBe("row-status-approved");
    expect(STATUS_ROW_COLORS["逾期"]).toBe("row-status-overdue");
    expect(STATUS_ROW_COLORS["未付"]).toBe("row-status-pending");
    expect(STATUS_ROW_COLORS["已付"]).toBe("row-status-approved");
  });

  it("供应商状态映射正确", () => {
    expect(STATUS_ROW_COLORS["当前有效"]).toBe("row-status-approved");
    expect(STATUS_ROW_COLORS["已失效"]).toBe("row-status-rejected");
  });

  it("报价状态映射正确", () => {
    expect(STATUS_ROW_COLORS["跟踪"]).toBe("row-status-draft");
    expect(STATUS_ROW_COLORS["落地"]).toBe("row-status-approved");
    expect(STATUS_ROW_COLORS["放弃"]).toBe("row-status-rejected");
  });

  it("项目状态映射正确", () => {
    expect(STATUS_ROW_COLORS["执行"]).toBe("row-status-approved");
    expect(STATUS_ROW_COLORS["暂停"]).toBe("row-status-pending");
    expect(STATUS_ROW_COLORS["关闭"]).toBe("row-status-rejected");
  });
});

describe("getRowStatusClass", () => {
  it("返回已知状态的 CSS class", () => {
    expect(getRowStatusClass("已批准")).toBe("row-status-approved");
    expect(getRowStatusClass("审批中")).toBe("row-status-pending");
    expect(getRowStatusClass("已驳回")).toBe("row-status-rejected");
  });

  it("未知状态返回空字符串", () => {
    expect(getRowStatusClass("未知状态")).toBe("");
    expect(getRowStatusClass("不存在的状态")).toBe("");
  });

  it("null 返回空字符串", () => {
    expect(getRowStatusClass(null)).toBe("");
  });

  it("undefined 返回空字符串", () => {
    expect(getRowStatusClass(undefined)).toBe("");
  });
});
