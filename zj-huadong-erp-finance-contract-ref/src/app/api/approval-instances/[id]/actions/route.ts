import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { processApprovalAction } from "@/lib/approval-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, comment, projectSourceId } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "无效的审批动作，需要 approve 或 reject" },
        { status: 400 }
      );
    }

    const result = await processApprovalAction({
      instanceId: id,
      approverId: user.id,
      action,
      comment,
      projectSourceId,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "审批操作失败";
    console.error("审批操作失败:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
