import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAIConfig, callAIModel } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import {
  generateBusinessSummary,
  detectAnomalies,
  evaluateRiskLevel,
  generateSuggestion,
} from "@/lib/approval-assistant";

/** businessType → Prisma delegate 名的映射 */
const MODEL_MAP: Record<string, string> = {
  income_contract: "incomeContract",
  expense_contract: "expenseContract",
  non_contract_expense: "nonContractExpense",
  expense_report: "expenseReport",
  supplier: "supplier",
  purchase_request: "purchaseRequest",
  delivery_receipt: "deliveryReceipt",
  payment_application: "paymentApplication",
};

/** 每个 businessType 对应的 include 配置 */
const INCLUDE_MAP: Record<string, Record<string, boolean | object>> = {
  income_contract: { customer: true },
  expense_contract: { supplier: true, items: true },
  non_contract_expense: {},
  expense_report: { applicant: true, items: true },
  supplier: {},
  purchase_request: { project: true, items: true },
  delivery_receipt: { expenseContract: true, items: true },
  payment_application: { applicant: true, payable: true },
};

const AI_SYSTEM_PROMPT = `你是审批助手。根据提供的审批单数据，生成：
1. 一句话摘要（不超过50字）
2. 风险评估（low/medium/high）
3. 审批建议（一句话）

输出 JSON: { "summary": "...", "riskLevel": "low", "suggestion": "..." }`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      businessType?: string;
      businessId?: string;
    };
    const { businessType, businessId } = body;

    if (!businessType || !businessId) {
      return NextResponse.json(
        { error: "缺少 businessType 或 businessId" },
        { status: 400 }
      );
    }

    const modelName = MODEL_MAP[businessType];
    if (!modelName) {
      return NextResponse.json(
        { error: `不支持的业务类型: ${businessType}` },
        { status: 400 }
      );
    }

    // 获取当前用户
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 查询业务数据
    const include = INCLUDE_MAP[businessType] || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await (prisma as any)[modelName].findUnique({
      where: { id: businessId },
      include: Object.keys(include).length > 0 ? include : undefined,
    });

    if (!record) {
      return NextResponse.json(
        { error: "未找到对应的业务数据" },
        { status: 404 }
      );
    }

    // 准备本地分析用的扁平数据
    const flatData = flattenRecord(record);

    // 本地分析
    const summary = generateBusinessSummary(businessType, flatData);
    const alerts = detectAnomalies(businessType, flatData);
    const riskLevel = evaluateRiskLevel(alerts);
    const suggestion = generateSuggestion(riskLevel);

    // 可选 AI 调用
    let aiSummary: string | undefined;
    const aiConfig = await getAIConfig();
    if (aiConfig) {
      try {
        const aiResult = await callAIModel(
          [
            { role: "system", content: AI_SYSTEM_PROMPT },
            {
              role: "user",
              content: `请分析以下审批单数据：\n\n${JSON.stringify(record, null, 2)}`,
            },
          ],
          aiConfig
        );

        if (typeof aiResult === "string") {
          try {
            const parsed = JSON.parse(aiResult);
            aiSummary = parsed.summary;
          } catch {
            const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                aiSummary = parsed.summary;
              } catch {
                aiSummary = undefined;
              }
            }
          }
        }
      } catch (err) {
        console.error("AI 调用失败，使用本地分析结果:", err);
      }
    }

    return NextResponse.json({
      data: {
        summary,
        aiSummary,
        riskLevel,
        alerts,
        suggestion,
      },
    });
  } catch (error) {
    console.error("审批摘要生成失败:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "审批摘要生成失败",
      },
      { status: 500 }
    );
  }
}

/** 将关联数据的字段扁平化，便于本地分析函数读取 */
function flattenRecord(
  record: Record<string, unknown>
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // 关联对象：提取常用字段
      if (key === "applicant" && typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        flat.applicantName = obj.realName || obj.username;
      }
      if (key === "payable" && typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        flat.totalAmount = obj.amount;
        flat.paidAmount = obj.paidAmount;
      }
      if (key === "items" && Array.isArray(value)) {
        flat.itemCount = value.length;
      }
    } else {
      flat[key] = value;
    }
  }

  return flat;
}
