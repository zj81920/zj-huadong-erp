import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { forceAdvanceApproval } from "@/lib/approval-engine";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { instanceId, comment, projectSourceId } = await request.json();

    if (!instanceId) {
      return NextResponse.json({ error: "缺少审批实例ID" }, { status: 400 });
    }

    const result = await forceAdvanceApproval({
      instanceId,
      operatorId: user.id,
      comment,
      projectSourceId,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "强制推进失败";
    console.error("强制推进审批失败:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
