import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface SplitStage {
  name: string;
  amount: number | string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contract = await prisma.incomeContract.findUnique({
      where: { id },
      include: {
        customer: true,
        project: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: "收入合同不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("获取收入合同详情失败:", error);
    return NextResponse.json(
      { error: "获取收入合同详情失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.incomeContract.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "收入合同不存在" },
        { status: 404 }
      );
    }

    const fieldKeys = Object.keys(body).filter((k) => k !== "status");
    const isStatusOnlyChange = body.status !== undefined && fieldKeys.length === 0;

    if (!isStatusOnlyChange && existing.status !== "草稿") {
      return NextResponse.json(
        { error: "只有草稿状态的合同可以编辑" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.contractNo !== undefined)
      updateData.contractNo = body.contractNo.trim();
    if (body.projectSourceId !== undefined)
      updateData.projectSourceId = body.projectSourceId || null;
    if (body.customerId !== undefined)
      updateData.customerId = body.customerId;
    if (body.totalAmount !== undefined)
      updateData.totalAmount = parseFloat(body.totalAmount);
    if (body.signedDate !== undefined)
      updateData.signedDate = body.signedDate ? new Date(body.signedDate) : null;
    if (body.splitStages !== undefined)
      updateData.splitStages = body.splitStages;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scannedUrl !== undefined)
      updateData.scannedUrl = body.scannedUrl?.trim() || null;
    if (body.approvalInstanceId !== undefined)
      updateData.approvalInstanceId = body.approvalInstanceId;

    if (updateData.contractNo) {
      const duplicate = await prisma.incomeContract.findFirst({
        where: {
          contractNo: updateData.contractNo as string,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "合同编号已存在" },
          { status: 409 }
        );
      }
    }

    const shouldCreateReceivables =
      updateData.status === "已批准" && existing.status !== "已批准";

    const contract = await prisma.$transaction(async (tx) => {
      const updated = await tx.incomeContract.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          project: true,
        },
      });

      if (shouldCreateReceivables) {
        const existingReceivables = await tx.receivable.findMany({
          where: { sourceType: "income_contract", sourceId: id },
        });

        if (existingReceivables.length === 0) {
          const stages = Array.isArray(updated.splitStages)
            ? (updated.splitStages as unknown as SplitStage[])
            : [];
          const projectSourceId = updated.projectSourceId || null;
          const now = new Date();
          const defaultDueDate = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate()
          );

          if (stages.length > 0) {
            for (const stage of stages) {
              const stageAmount =
                typeof stage.amount === "string"
                  ? parseFloat(stage.amount)
                  : stage.amount;
              if (stageAmount > 0) {
                await tx.receivable.create({
                  data: {
                    sourceType: "income_contract",
                    sourceId: id,
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
            await tx.receivable.create({
              data: {
                sourceType: "income_contract",
                sourceId: id,
                projectSourceId,
                dueDate: defaultDueDate,
                amount: parseFloat(updated.totalAmount.toString()),
                paidAmount: 0,
                invoicedAmount: 0,
                status: "未收",
              },
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ data: contract });
  } catch (error) {
    console.error("更新收入合同失败:", error);
    return NextResponse.json(
      { error: "更新收入合同失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.incomeContract.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "收入合同不存在" },
        { status: 404 }
      );
    }

    if (existing.status !== "草稿") {
      return NextResponse.json(
        { error: "只有草稿状态的合同可以删除" },
        { status: 400 }
      );
    }

    await prisma.incomeContract.delete({
      where: { id },
    });

    return NextResponse.json({ message: "删除成功" });
  } catch (error) {
    console.error("删除收入合同失败:", error);
    return NextResponse.json(
      { error: "删除收入合同失败" },
      { status: 500 }
    );
  }
}
