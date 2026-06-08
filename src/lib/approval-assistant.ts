/**
 * 审批 AI 智能辅助 - 核心逻辑
 *
 * 提供业务摘要生成、异常检测、风险评估和审批建议功能
 */

/** 审批预警项 */
export interface ApprovalAlert {
  type: string;
  message: string;
  level: "low" | "medium" | "high";
}

/** 审批摘要结果 */
export interface ApprovalSummary {
  summary: string;
  riskLevel: "low" | "medium" | "high";
  alerts: ApprovalAlert[];
  suggestion: string;
}

/** 业务类型 → 中文名称映射 */
const TYPE_LABELS: Record<string, string> = {
  income_contract: "收入合同",
  expense_contract: "支出合同",
  non_contract_expense: "其他支出",
  expense_report: "费用报销",
  supplier: "供应商审批",
  purchase_request: "采购需求",
  delivery_receipt: "到货验收",
  payment_application: "合同支付",
  lending_out: "借出款",
  salary_payment: "工资发放",
};

/**
 * 根据业务数据生成基础摘要文本
 */
export function generateBusinessSummary(
  businessType: string,
  data: Record<string, unknown>
): string {
  const label = TYPE_LABELS[businessType] || businessType;
  const amount = data.totalAmount || data.amount || 0;
  const applicant = data.applicantName || data.realName || "未知";

  if (amount) {
    return `${label} - ${applicant} 申请金额 ¥${Number(amount).toLocaleString()}`;
  }
  return `${label} - ${applicant}`;
}

/**
 * 检测数据中的异常点
 */
export function detectAnomalies(
  businessType: string,
  data: Record<string, unknown>
): ApprovalAlert[] {
  const alerts: ApprovalAlert[] = [];

  // 费用报销异常检测
  if (businessType === "expense_report") {
    const totalAmount = Number(data.totalAmount || data.amount || 0);
    if (totalAmount > 10000) {
      alerts.push({
        type: "高额报销",
        message: `报销金额 ¥${totalAmount.toLocaleString()}，超过 ¥10,000 阈值`,
        level: "medium",
      });
    }

    const itemCount = Number(data.itemCount || 0);
    if (itemCount > 10) {
      alerts.push({
        type: "报销项过多",
        message: `共 ${itemCount} 笔报销明细，建议核实`,
        level: "low",
      });
    }
  }

  // 合同支付异常检测
  if (
    businessType === "payment_application" ||
    businessType === "expense_contract"
  ) {
    const totalAmount = Number(data.totalAmount || 0);
    const paidAmount = Number(data.paidAmount || 0);
    const remaining = totalAmount - paidAmount;

    if (remaining < 0) {
      alerts.push({
        type: "超额支付",
        message: `已付金额 ¥${paidAmount.toLocaleString()} 超过合同总额 ¥${totalAmount.toLocaleString()}`,
        level: "high",
      });
    }
  }

  // 采购需求异常检测
  if (businessType === "purchase_request") {
    const estimatedAmount = Number(data.estimatedAmount || 0);
    if (estimatedAmount > 50000) {
      alerts.push({
        type: "高额采购",
        message: `预估金额 ¥${estimatedAmount.toLocaleString()}，超过 ¥50,000 阈值`,
        level: "medium",
      });
    }
  }

  return alerts;
}

/**
 * 综合评估风险等级
 */
export function evaluateRiskLevel(
  alerts: { level: string }[]
): "low" | "medium" | "high" {
  if (alerts.some((a) => a.level === "high")) return "high";
  if (alerts.some((a) => a.level === "medium")) return "medium";
  return "low";
}

/**
 * 生成审批建议
 */
export function generateSuggestion(
  riskLevel: "low" | "medium" | "high"
): string {
  switch (riskLevel) {
    case "high":
      return "存在较高风险，建议仔细核实后再审批";
    case "medium":
      return "存在中等风险，建议关注异常项后审批";
    case "low":
      return "综合评估：低风险，建议通过";
  }
}
