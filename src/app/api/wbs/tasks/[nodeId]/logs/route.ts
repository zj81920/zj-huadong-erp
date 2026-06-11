import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canAccessProjectWbs } from "@/lib/wbs-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;

    const node = await prisma.projectWbsNode.findUnique({
      where: { id: nodeId },
      select: { projectSourceId: true },
    });
    if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

    const authorized = await canAccessProjectWbs(node.projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const logs = await prisma.wbsTaskLog.findMany({
      where: { nodeId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: logs });
  } catch (error) {
    console.error("获取日志失败:", error);
    return NextResponse.json({ error: "获取日志失败" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params;

    const node = await prisma.projectWbsNode.findUnique({
      where: { id: nodeId },
      select: { projectSourceId: true },
    });
    if (!node) return NextResponse.json({ error: "节点不存在" }, { status: 404 });

    const authorized = await canAccessProjectWbs(node.projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const body = await request.json();
    const { content, createdBy } = body;
    if (!content) {
      return NextResponse.json({ error: "日志内容不能为空" }, { status: 400 });
    }
    const log = await prisma.wbsTaskLog.create({
      data: { nodeId, content, createdBy: createdBy || "未知" },
    });
    return NextResponse.json({ data: log }, { status: 201 });
  } catch (error) {
    console.error("创建日志失败:", error);
    return NextResponse.json({ error: "创建日志失败" }, { status: 500 });
  }
}
