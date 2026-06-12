import { describe, it, expect } from "vitest";
import prisma from "@/lib/prisma";

describe("OutsourcingWbsItem 模型", () => {
  it("可以创建关联记录", async () => {
    const project = await prisma.project.findFirst({ select: { projectSourceId: true } });
    if (!project) { console.log("跳过: 无项目数据"); return; }

    const task = await prisma.outsourcingTask.findFirst({ select: { id: true, targetName: true } });
    if (!task) { console.log("跳过: 无外包数据"); return; }

    const node = await prisma.projectWbsNode.findFirst({
      where: { projectSourceId: project.projectSourceId, level: 4 },
      select: { id: true },
    });
    if (!node) { console.log("跳过: 无 WBS 节点数据"); return; }

    // 清理旧数据
    await prisma.outsourcingWbsItem.deleteMany({ where: { outsourcingTaskId: task.id, wbsNodeId: node.id } });

    const item = await prisma.outsourcingWbsItem.create({
      data: {
        outsourcingTaskId: task.id,
        wbsNodeId: node.id,
        workload: 20,
        unit: "张",
        unitPrice: 3000,
        subtotal: 60000,
      },
    });

    expect(item.id).toBeDefined();
    expect(item.workload).toBe("20");
    expect(item.unit).toBe("张");
    expect(item.unitPrice).toBe("3000");
    expect(item.subtotal).toBe("60000");

    // 清理
    await prisma.outsourcingWbsItem.deleteMany({ where: { outsourcingTaskId: task.id, wbsNodeId: node.id } });
  });

  it("同一外包+WBS 不可重复创建（唯一约束）", async () => {
    const task = await prisma.outsourcingTask.findFirst({ select: { id: true } });
    if (!task) { console.log("跳过: 无外包数据"); return; }

    const node = await prisma.projectWbsNode.findFirst({
      where: { level: 4 },
      select: { id: true },
    });
    if (!node) { console.log("跳过: 无 WBS 节点数据"); return; }

    // 先确保存在
    await prisma.outsourcingWbsItem.deleteMany({ where: { outsourcingTaskId: task.id, wbsNodeId: node.id } });
    await prisma.outsourcingWbsItem.create({
      data: {
        outsourcingTaskId: task.id,
        wbsNodeId: node.id,
        workload: 10,
        unit: "套",
        unitPrice: 1000,
        subtotal: 10000,
      },
    });

    // 尝试重复创建应抛错
    await expect(
      prisma.outsourcingWbsItem.create({
        data: {
          outsourcingTaskId: task.id,
          wbsNodeId: node.id,
          workload: 20,
          unit: "套",
          unitPrice: 2000,
          subtotal: 40000,
        },
      })
    ).rejects.toThrow();

    // 清理
    await prisma.outsourcingWbsItem.deleteMany({ where: { outsourcingTaskId: task.id, wbsNodeId: node.id } });
  });

  it("表存在且可通过 Prisma Client 查询", async () => {
    const anyItem = await prisma.outsourcingWbsItem.findFirst({ select: { id: true } });
    console.log(anyItem ? "已有数据" : "无数据，表存在且可查询");
  });
});
