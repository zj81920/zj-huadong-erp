import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAIConfig, callAIModel } from "@/lib/ai";
import { canEditProjectWbs } from "@/lib/wbs-auth";

const SYSTEM_PROMPT = `你是一个石油化工设计项目的高级工程师，精通各专业的设计流程和交付物。

用户会提供：项目类型、项目内容描述、当前阶段、子项名称、专业名称。

你需要根据石油化工行业的设计规范和惯例，列出该专业在该子项下应完成的设计任务清单。

重要原则：
1. 子项名称代表了具体的设计对象（如 "600#厂房" 是工业厂房、"500#水池" 是水池/罐区），不同子项类型的设计任务差异很大
2. 同一专业在不同子项下，设计任务应完全不同。例如：
   - 厂房子项：侧重结构、建筑、暖通等厂房相关设计
   - 水池子项：侧重防渗、防腐、给排水等构筑物相关设计
   - 装置区子项：侧重设备布置、管道应力等装置相关设计
3. 项目内容描述包含了项目的整体概况和技术要求，应作为任务设计的参考背景
4. 避免生成与子项类型无关的通用任务，每个任务都应针对该子项的具体特点

输出要求：
1. 严格以 JSON 数组格式输出，不要有任何其他文字
2. 每个任务是一个对象，包含：name（任务名称）
3. 任务应覆盖该专业的主要设计文件和交付物
4. 任务粒度适中，通常 5-12 个任务
5. 按设计流程的自然顺序排列

示例输出（装置区子项-工艺专业）：
[
  {"name": "工艺流程图(PFD)绘制"},
  {"name": "管道仪表流程图(P&ID)绘制"},
  {"name": "工艺数据表编制"}
]

示例输出（厂房子项-结构专业）：
[
  {"name": "厂房结构布置图设计"},
  {"name": "厂房基础设计"},
  {"name": "厂房钢结构计算"}
]`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectSourceId: string }> }
) {
  try {
    const { projectSourceId } = await params;
    const authorized = await canEditProjectWbs(projectSourceId);
    if (!authorized) return NextResponse.json({ error: "无权操作" }, { status: 403 });

    const config = await getAIConfig();
    if (!config) {
      return NextResponse.json(
        { error: "AI 模型未配置，请在系统设置中配置" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { parentNodeId } = body;

    if (!parentNodeId) {
      return NextResponse.json({ error: "缺少父节点ID" }, { status: 400 });
    }

    // 获取父节点(L3专业节点)信息
    const parentNode = await prisma.projectWbsNode.findFirst({
      where: { id: parentNodeId, projectSourceId, level: 3 },
    });
    if (!parentNode) {
      return NextResponse.json({ error: "专业节点不存在" }, { status: 404 });
    }

    // 获取L2子项名称和L1阶段名称
    const l2Node = parentNode.parentId
      ? await prisma.projectWbsNode.findFirst({
          where: { id: parentNode.parentId },
        })
      : null;
    const l1Node = l2Node?.parentId
      ? await prisma.projectWbsNode.findFirst({
          where: { id: l2Node.parentId },
        })
      : null;

    // 采购阶段不支持 AI 生成任务
    if (l1Node?.name?.includes("采购")) {
      return NextResponse.json(
        { error: "采购阶段不支持 AI 生成任务，请手动添加" },
        { status: 400 }
      );
    }

    // 获取专业名称
    let disciplineName = parentNode.name;
    if (parentNode.disciplineId) {
      const discipline = await prisma.disciplineDictionary.findUnique({
        where: { id: parentNode.disciplineId },
      });
      if (discipline) disciplineName = discipline.name;
    }

    // 获取项目信息
    const project = await prisma.project.findFirst({
      where: { projectSourceId },
      select: { name: true, projectCategory: true, projectContent: true },
    });

    const projectName = project?.name || "未知项目";
    const projectContent = project?.projectContent || "";
    const projectType = project?.projectCategory || "石油化工设计";
    const phaseName = l1Node?.name || "未知阶段";
    const subItemName = l2Node?.name || "未知子项";

    // 构造 AI 提示
    const userMessage = `项目类型：${projectType}
项目名称：${projectName}
项目内容描述：${projectContent || "无"}
当前阶段：${phaseName}
子项名称：${subItemName}
专业名称：${disciplineName}

请结合项目内容描述和项目阶段，列出该专业在此子项下需要完成的设计任务清单。`;

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: userMessage },
    ];

    let aiResult: string;
    try {
      aiResult = await callAIModel(messages, config);
    } catch (error) {
      console.error("AI调用失败:", error);
      return NextResponse.json(
        { error: "AI 服务调用失败，请检查模型配置" },
        { status: 500 }
      );
    }

    // 解析 AI 返回的 JSON
    let tasks: { name: string }[] = [];
    try {
      tasks = JSON.parse(aiResult);
    } catch {
      // 尝试提取 JSON 数组
      const match = aiResult.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          tasks = JSON.parse(match[0]);
        } catch {
          return NextResponse.json(
            { error: "AI 返回格式异常，无法解析任务列表" },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "AI 返回格式异常，无法解析任务列表" },
          { status: 500 }
        );
      }
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: "AI 未生成有效任务" }, { status: 500 });
    }

    // 获取当前最大 sortOrder
    const maxSortNode = await prisma.projectWbsNode.findFirst({
      where: { parentId: parentNodeId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let nextSort = (maxSortNode?.sortOrder || 0) + 1;

    // 获取 L1 的计划日期作为默认
    const planStartDate = l1Node?.planStartDate || null;
    const planEndDate = l1Node?.planEndDate || null;

    // 批量创建 L4 任务节点
    const created = await prisma.$transaction(
      tasks.map((task) =>
        prisma.projectWbsNode.create({
          data: {
            projectSourceId,
            parentId: parentNodeId,
            level: 4,
            name: task.name,
            planStartDate,
            planEndDate,
            progress: 0,
            sortOrder: nextSort++,
            responsibleIds: [],
            aiGenerated: true,
          },
        })
      )
    );

    return NextResponse.json({
      data: {
        generatedCount: created.length,
        tasks: created.map((t) => ({ id: t.id, name: t.name })),
      },
    });
  } catch (error) {
    console.error("生成任务失败:", error);
    return NextResponse.json({ error: "生成任务失败" }, { status: 500 });
  }
}
