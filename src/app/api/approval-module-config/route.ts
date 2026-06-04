import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const modules = await prisma.approvalModuleConfig.findMany({
      where: { isActive: true },
      orderBy: [{ groupName: "asc" }, { moduleName: "asc" }],
    })

    // 动态计算每个模块是否有审批流
    const data = await Promise.all(
      modules.map(async (m) => {
        const flowCount = await prisma.approvalFlowDefinition.count({
          where: { businessType: m.moduleKey, isActive: true },
        })
        return {
          moduleKey: m.moduleKey,
          moduleName: m.moduleName,
          groupName: m.groupName,
          hasFlow: flowCount > 0,
        }
      })
    )

    return NextResponse.json({ data })
  } catch (error) {
    console.error("获取模块配置失败:", error)
    return NextResponse.json({ error: "获取模块配置失败" }, { status: 500 })
  }
}
