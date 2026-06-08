/**
 * 审批 AI 智能辅助 - TDD 测试
 *
 * 测试场景：
 * 1. 不同业务类型的数据摘要生成
 * 2. 异常检测逻辑（超预算、供应商异常等）
 * 3. 风险等级判定
 * 4. AI 返回结果解析
 */
import { describe, it, expect } from "vitest";
import {
  generateBusinessSummary,
  detectAnomalies,
  evaluateRiskLevel,
  generateSuggestion,
} from "@/lib/approval-assistant";

describe("审批 AI 辅助 - 核心逻辑", () => {
  describe("generateBusinessSummary", () => {
    it("收入合同生成摘要", () => {
      const summary = generateBusinessSummary("income_contract", {
        totalAmount: 100000,
        applicantName: "张三",
      });
      expect(summary).toContain("收入合同");
      expect(summary).toContain("张三");
      expect(summary).toContain("100,000");
    });

    it("费用报销生成摘要", () => {
      const summary = generateBusinessSummary("expense_report", {
        amount: 3500,
        realName: "李四",
      });
      expect(summary).toContain("费用报销");
      expect(summary).toContain("李四");
      expect(summary).toContain("3,500");
    });

    it("未知业务类型使用原始 key", () => {
      const summary = generateBusinessSummary("custom_type", {});
      expect(summary).toContain("custom_type");
    });

    it("无金额时省略金额信息", () => {
      const summary = generateBusinessSummary("supplier", {
        applicantName: "王五",
      });
      expect(summary).toContain("供应商审批");
      expect(summary).toContain("王五");
      expect(summary).not.toContain("¥");
    });
  });

  describe("detectAnomalies", () => {
    it("高额报销触发中等风险预警", () => {
      const alerts = detectAnomalies("expense_report", {
        totalAmount: 15000,
      });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe("高额报销");
      expect(alerts[0].level).toBe("medium");
    });

    it("低额报销无异常", () => {
      const alerts = detectAnomalies("expense_report", {
        totalAmount: 500,
      });
      expect(alerts.length).toBe(0);
    });

    it("超额支付触发高风险", () => {
      const alerts = detectAnomalies("payment_application", {
        totalAmount: 10000,
        paidAmount: 12000,
      });
      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe("high");
      expect(alerts[0].type).toBe("超额支付");
    });

    it("高额采购触发中等风险", () => {
      const alerts = detectAnomalies("purchase_request", {
        estimatedAmount: 80000,
      });
      expect(alerts.length).toBe(1);
      expect(alerts[0].level).toBe("medium");
      expect(alerts[0].type).toBe("高额采购");
    });

    it("正常合同支付无异常", () => {
      const alerts = detectAnomalies("expense_contract", {
        totalAmount: 100000,
        paidAmount: 30000,
      });
      expect(alerts.length).toBe(0);
    });

    it("报销项过多触发低风险", () => {
      const alerts = detectAnomalies("expense_report", {
        totalAmount: 500,
        itemCount: 15,
      });
      expect(alerts.some((a) => a.type === "报销项过多")).toBe(true);
      expect(alerts.find((a) => a.type === "报销项过多")!.level).toBe("low");
    });
  });

  describe("evaluateRiskLevel", () => {
    it("有 high 级别预警时返回 high", () => {
      const alerts = [
        { level: "low" as const },
        { level: "high" as const },
      ];
      expect(evaluateRiskLevel(alerts)).toBe("high");
    });

    it("只有 medium 级别预警时返回 medium", () => {
      const alerts = [
        { level: "low" as const },
        { level: "medium" as const },
      ];
      expect(evaluateRiskLevel(alerts)).toBe("medium");
    });

    it("只有 low 级别预警时返回 low", () => {
      const alerts = [
        { level: "low" as const },
      ];
      expect(evaluateRiskLevel(alerts)).toBe("low");
    });

    it("无预警时返回 low", () => {
      expect(evaluateRiskLevel([])).toBe("low");
    });
  });

  describe("generateSuggestion", () => {
    it("高风险给出谨慎建议", () => {
      const suggestion = generateSuggestion("high");
      expect(suggestion).toContain("高风险");
      expect(suggestion).toContain("仔细核实");
    });

    it("中风险给出关注建议", () => {
      const suggestion = generateSuggestion("medium");
      expect(suggestion).toContain("中等风险");
      expect(suggestion).toContain("关注异常");
    });

    it("低风险建议通过", () => {
      const suggestion = generateSuggestion("low");
      expect(suggestion).toContain("低风险");
      expect(suggestion).toContain("建议通过");
    });
  });
});
