import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

type StatusField = "status" | "approvalStatus" | "inquiryStatus";

interface BusinessConfig {
  model: string;
  statusField: StatusField;
  validStatuses: string[];
}

const BUSINESS_CONFIGS: Record<string, BusinessConfig> = {
  purchase_request: {
    model: "purchaseRequest",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回", "已转询价", "已采购"],
  },
  inquiry: {
    model: "inquiry",
    statusField: "inquiryStatus",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
  },
  quotation: {
    model: "quotation",
    statusField: "approvalStatus",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
  },
  income_contract: {
    model: "incomeContract",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回", "合同归档"],
  },
  expense_contract: {
    model: "expenseContract",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回", "合同归档"],
  },
  non_contract_income: {
    model: "nonContractIncome",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
  },
  non_contract_expense: {
    model: "nonContractExpense",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
  },
  outsourcing: {
    model: "outsourcingTask",
    statusField: "approvalStatus",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
  },
  payment_application: {
    model: "paymentApplication",
    statusField: "approvalStatus",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回", "已付款"],
  },
  expense_report: {
    model: "expenseReport",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
  },
  other_borrowing: {
    model: "otherBorrowing",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回", "未还清", "已还清"],
  },
  lending_out: {
    model: "lendingOut",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回", "未还清", "已还清"],
  },
  salary_payment: {
    model: "salaryBatch",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回", "已发放"],
  },
  borrowing_return_application: {
    model: "borrowingReturnApplication",
    statusField: "status",
    validStatuses: ["草稿", "审批中", "已批准", "已驳回"],
  },
};

const MODEL_MAP: Record<string, string> = {
  purchaseRequest: "purchaseRequest",
  inquiry: "inquiry",
  quotation: "quotation",
  incomeContract: "incomeContract",
  expenseContract: "expenseContract",
  nonContractIncome: "nonContractIncome",
  nonContractExpense: "nonContractExpense",
  outsourcingTask: "outsourcingTask",
  paymentApplication: "paymentApplication",
  expenseReport: "expenseReport",
  otherBorrowing: "otherBorrowing",
  lendingOut: "lendingOut",
  salaryBatch: "salaryBatch",
  borrowingReturnApplication: "borrowingReturnApplication",
};

interface SplitStage {
  name: string;
  amount: number | string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
    }

    const body = await request.json();
    const { businessType, businessId, newStatus } = body;

    if (!businessType || !businessId || !newStatus) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const config = BUSINESS_CONFIGS[businessType];
    if (!config) {
      return NextResponse.json({ error: `不支持的业务类型: ${businessType}` }, { status: 400 });
    }

    if (!config.validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: `无效的状态: ${newStatus}，可选: ${config.validStatuses.join("/")}` },
        { status: 400 }
      );
    }

    const modelName = MODEL_MAP[config.model] as keyof typeof prisma;
    const modelDelegate = prisma[modelName] as unknown as { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> };

    const updateData: Record<string, unknown> = { [config.statusField]: newStatus };

    // === 外包任务：审批通过 + 分包公司 → 自动生成支出合同草稿 ===
    if (businessType === "outsourcing" && newStatus === "已批准") {
      const existing = await prisma.outsourcingTask.findUnique({ where: { id: businessId } });
      if (existing && existing.type === "to_company" && !existing.contractId && existing.approvalStatus !== "已批准") {
        const now = new Date();
        const contractNo = `OUT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

        const contract = await prisma.expenseContract.create({
          data: {
            contractNo,
            projectSourceId: existing.projectSourceId,
            supplierId: existing.supplierId || null,
            totalAmount: parseFloat(existing.amount.toString()),
            contractType: "设计外包",
            status: "草稿",
          },
        });

        updateData.contractId = contract.id;
      }
    }

    // === 收入合同：审批通过 → 自动创建应收记录 ===
    if (businessType === "income_contract" && newStatus === "已批准") {
      const existing = await prisma.incomeContract.findUnique({ where: { id: businessId } });
      if (existing && existing.status !== "已批准") {
        const existingReceivables = await prisma.receivable.findMany({
          where: { sourceType: "income_contract", sourceId: businessId },
        });

        if (existingReceivables.length === 0) {
          const stages = Array.isArray(existing.splitStages)
            ? (existing.splitStages as unknown as SplitStage[])
            : [];
          const projectSourceId = existing.projectSourceId || null;
          const now = new Date();
          const defaultDueDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

          if (stages.length > 0) {
            for (const stage of stages) {
              const stageAmount = typeof stage.amount === "string"
                ? parseFloat(stage.amount) : stage.amount;
              if (stageAmount > 0) {
                await prisma.receivable.create({
                  data: {
                    sourceType: "income_contract",
                    sourceId: businessId,
                    projectSourceId,
                    dueDate: defaultDueDate,
                    amount: stageAmount,
                    paidAmount: 0,
                    invoicedAmount: 0,
                    status: "未收",
                  },
                });
              }
            }
          } else {
            await prisma.receivable.create({
              data: {
                sourceType: "income_contract",
                sourceId: businessId,
                projectSourceId,
                dueDate: defaultDueDate,
                amount: parseFloat(existing.totalAmount.toString()),
                paidAmount: 0,
                invoicedAmount: 0,
                status: "未收",
              },
            });
          }
        }
      }
    }

    // === 支出合同：审批通过 → 自动创建应付记录 + 更新采购需求状态 ===
    if (businessType === "expense_contract" && newStatus === "已批准") {
      const existing = await prisma.expenseContract.findUnique({
        where: { id: businessId },
        include: {
          inquiry: { include: { purchaseRequest: true } },
        },
      });
      if (existing && existing.status !== "已批准") {
        const existingPayables = await prisma.payable.findMany({
          where: { sourceType: "expense_contract", sourceId: businessId },
        });

        if (existingPayables.length === 0) {
          const now = new Date();
          const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

          await prisma.payable.create({
            data: {
              sourceType: "expense_contract",
              sourceId: businessId,
              projectSourceId: existing.projectSourceId || null,
              dueDate,
              amount: parseFloat(existing.totalAmount.toString()),
              paidAmount: 0,
              invoicedAmount: 0,
              status: "未付",
            },
          });
        }

        if (existing.inquiry?.purchaseRequestId) {
          await prisma.purchaseRequest.update({
            where: { id: existing.inquiry.purchaseRequestId },
            data: { status: "已采购" },
          });
        }
      }
    }

    // === 借入款：审批通过 → 自动映射为"未还清" ===
    if (businessType === "other_borrowing" && newStatus === "已批准") {
      const existing = await prisma.otherBorrowing.findUnique({ where: { id: businessId } });
      if (existing && existing.status === "审批中") {
        updateData.status = "未还清";
      }
    }

    // === 借出款：审批通过 → 自动映射为"未还清" ===
    if (businessType === "lending_out" && newStatus === "已批准") {
      const existing = await prisma.lendingOut.findUnique({ where: { id: businessId } });
      if (existing && existing.status === "审批中") {
        updateData.status = "未还清";
      }
    }

    const updated = await modelDelegate.update({
      where: { id: businessId },
      data: updateData,
    });

    const actualStatus = (updateData[config.statusField] as string) || newStatus;
    return NextResponse.json({
      data: updated,
      message: `管理员已将状态修改为「${actualStatus}」`,
    });
  } catch (error) {
    console.error("管理员修改审批状态失败:", error);
    return NextResponse.json({ error: "修改失败" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    data: Object.entries(BUSINESS_CONFIGS).map(([type, config]) => ({
      businessType: type,
      statusField: config.statusField,
      validStatuses: config.validStatuses,
    })),
  });
}
