import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/auth";

interface ApproverRole {
  key: string;
  label: string;
}

const defaultFlows: Array<{ nodeOrder: number; nodeName: string; approverRole: string }> = [
  { nodeOrder: 1, nodeName: "发起", approverRole: "initiator" },
  { nodeOrder: 2, nodeName: "部门负责人审批", approverRole: "dept_head" },
  { nodeOrder: 3, nodeName: "副总经理审批", approverRole: "vice_gm" },
  { nodeOrder: 4, nodeName: "总经理审批", approverRole: "gm" },
];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    // 从数据库读取模块清单
    const modules = await prisma.approvalModuleConfig.findMany({
      where: { isActive: true },
      orderBy: [{ groupName: "asc" }, { moduleName: "asc" }],
    });
    const businessTypes = modules.map(m => ({ key: m.moduleKey, label: m.moduleName }));

    // 从 Role 表读取角色列表
    const roles = await prisma.role.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: { name: "asc" } });
    const approverRoles: ApproverRole[] = [
      { key: "initiator", label: "经办人" },
      ...roles.map(r => ({ key: r.code, label: r.name })),
    ];

    return NextResponse.json({ data: { businessTypes, approverRoles } });
  } catch (error) {
    console.error("获取业务类型失败:", error);
    return NextResponse.json({ error: "获取业务类型失败" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ error: "未授权" }, { status: 403 });
    }

    // 从数据库读取模块清单
    const modules = await prisma.approvalModuleConfig.findMany({
      where: { isActive: true },
      select: { moduleKey: true },
    });
    const businessTypeKeys = modules.map(m => m.moduleKey);

    let createdCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const btKey of businessTypeKeys) {
        const flowLevel = "common";

        for (const node of defaultFlows) {
          const existing = await tx.approvalFlowDefinition.findFirst({
            where: {
              businessType: btKey,
              flowLevel,
              nodeOrder: node.nodeOrder,
            },
          });

          if (!existing) {
            await tx.approvalFlowDefinition.create({
              data: {
                businessType: btKey,
                flowLevel,
                nodeOrder: node.nodeOrder,
                nodeName: node.nodeName,
                approverRole: node.approverRole,
                isActive: true,
              },
            });
            createdCount++;
          }
        }
      }
    });

    return NextResponse.json({
      data: { createdCount },
      message: `已初始化 ${createdCount} 条审批流定义`,
    });
  } catch (error) {
    console.error("初始化审批流模板失败:", error);
    return NextResponse.json({ error: "初始化审批流模板失败" }, { status: 500 });
  }
}
