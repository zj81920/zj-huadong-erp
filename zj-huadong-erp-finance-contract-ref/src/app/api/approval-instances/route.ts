import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  startApprovalFlow,
  getPendingApprovals,
} from "@/lib/approval-engine";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { businessType, businessId, flowLevel, projectSourceId } = body;

    if (!businessType || !businessId || !flowLevel) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const result = await startApprovalFlow({
      businessType,
      businessId,
      flowLevel,
      initiatorId: user.id,
      projectSourceId,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "发起审批失败";
    console.error("发起审批失败:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "pending";

    if (type === "pending") {
      const pending = await getPendingApprovals(user.id);
      return NextResponse.json({ data: pending });
    }

    if (type === "my-initiated") {
      const { prisma } = await import("@/lib/prisma");
      const instances = await prisma.approvalInstance.findMany({
        where: {
          actions: {
            some: {
              approverId: user.id,
              action: "initiate",
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ data: instances });
    }

    return NextResponse.json(
      { error: "无效的 type 参数" },
      { status: 400 }
    );
  } catch (error) {
    console.error("获取审批列表失败:", error);
    return NextResponse.json({ error: "获取审批列表失败" }, { status: 500 });
  }
}
