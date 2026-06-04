import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getModulesWithFlowStatus } from "@/lib/module-config"

export async function GET() {
  try {
    // 从 DB 统计每个模块的活跃审批流数量
    const flows = await prisma.approvalFlowDefinition.findMany({
      where: { isActive: true },
      select: { businessType: true },
    })

    const flowCounts: Record<string, number> = {}
    for (const f of flows) {
      flowCounts[f.businessType] = (flowCounts[f.businessType] || 0) + 1
    }

    const data = getModulesWithFlowStatus(flowCounts)

    return NextResponse.json({ data })
  } catch (error) {
    console.error("获取模块配置失败:", error)
    return NextResponse.json({ error: "获取模块配置失败" }, { status: 500 })
  }
}
