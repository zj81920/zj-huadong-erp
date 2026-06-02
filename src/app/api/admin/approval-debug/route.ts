import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const businessType = searchParams.get("businessType");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (businessType) where.businessType = businessType;

    const instances = await prisma.approvalInstance.findMany({
      where,
      include: {
        actions: {
          include: {
            approver: {
              select: { id: true, realName: true, username: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ data: instances });
  } catch (error) {
    console.error("获取审批调试数据失败:", error);
    return NextResponse.json({ error: "获取审批调试数据失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
    }

    const body = await request.json();
    const { instanceId, status, currentNode } = body;

    if (!instanceId || !status) {
      return NextResponse.json({ error: "缺少 instanceId 或 status" }, { status: 400 });
    }

    const validStatuses = ["审批中", "已批准", "已驳回"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `状态必须为: ${validStatuses.join("/")}` }, { status: 400 });
    }

    const instance = await prisma.approvalInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance) {
      return NextResponse.json({ error: "审批实例不存在" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { status };
    if (currentNode !== undefined) {
      updateData.currentNode = currentNode;
    }

    const updated = await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: updateData,
    });

    await prisma.approvalAction.create({
      data: {
        instanceId,
        nodeId: updated.currentNode,
        nodeName: "管理员强制修改",
        approverId: user.id,
        action: `admin_override:${status}`,
        comment: `管理员 ${user.realName} 强制将状态修改为「${status}」`,
        actedAt: new Date(),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("修改审批状态失败:", error);
    return NextResponse.json({ error: "修改审批状态失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get("instanceId");

    if (!instanceId) {
      return NextResponse.json({ error: "缺少 instanceId" }, { status: 400 });
    }

    const instance = await prisma.approvalInstance.findUnique({
      where: { id: instanceId },
    });
    if (!instance) {
      return NextResponse.json({ error: "审批实例不存在" }, { status: 404 });
    }

    await prisma.approvalAction.deleteMany({ where: { instanceId } });
    await prisma.approvalInstance.delete({ where: { id: instanceId } });

    return NextResponse.json({ data: { id: instanceId, deleted: true } });
  } catch (error) {
    console.error("删除审批实例失败:", error);
    return NextResponse.json({ error: "删除审批实例失败" }, { status: 500 });
  }
}
