import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { cleanupBusinessApprovalRecords } from "@/lib/approval-cleanup";

describe("approval-cleanup", () => {
  const businessType = "supplier";
  const testUserId = "test-cleanup-user";
  let instanceId: string;
  let businessId: string;

  beforeEach(async () => {
    // 确保测试用户存在（外键依赖）
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        username: "test-cleanup-user",
        realName: "测试用户",
        password: "test",
      },
    });

    // 清理旧数据（精确作用域，避免影响并行测试）
    const oldInsts = await prisma.approvalInstance.findMany({ where: { businessType, businessId: "test-cleanup-1" }, select: { id: true } });
    const oldInstIds = oldInsts.map((i: { id: string }) => i.id);
    if (oldInstIds.length > 0) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: { in: oldInstIds } } });
      await prisma.notification.deleteMany({ where: { relatedId: { in: oldInstIds } } });
      await prisma.approvalInstance.deleteMany({ where: { id: { in: oldInstIds } } });
    }

    // 创建一条实例+动作+通知
    const inst = await prisma.approvalInstance.create({
      data: {
        businessType,
        businessId: "test-cleanup-1",
        status: "审批中",
        currentNode: 1,
        flowLevel: "common",
      },
    });
    instanceId = inst.id;
    businessId = inst.businessId;

    await prisma.approvalAction.create({
      data: {
        instanceId: inst.id,
        nodeId: 1,
        nodeName: "节点1",
        approverId: testUserId,
        action: "initiate",
        actedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: testUserId,
        title: "待审批",
        description: "",
        type: "approval_pending",
        relatedId: inst.id,
      },
    });
  });

  afterEach(async () => {
    const insts = await prisma.approvalInstance.findMany({ where: { businessType, businessId: "test-cleanup-1" }, select: { id: true } });
    const instIds = insts.map((i: { id: string }) => i.id);
    if (instIds.length > 0) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: { in: instIds } } });
      await prisma.notification.deleteMany({ where: { relatedId: { in: instIds } } });
      await prisma.approvalInstance.deleteMany({ where: { id: { in: instIds } } });
    }
  });

  it("调用清理后相关 instance/action/notification 都被物理删除", async () => {
    // 创建前验证
    expect(
      await prisma.approvalInstance.count({ where: { businessType, businessId } })
    ).toBe(1);
    expect(
      await prisma.approvalAction.count({ where: { instanceId } })
    ).toBe(1);
    expect(
      await prisma.notification.count({ where: { relatedId: instanceId } })
    ).toBe(1);

    // 执行清理
    await cleanupBusinessApprovalRecords(businessType, businessId);

    // 精确断言：只检查本测试创建的记录
    expect(
      await prisma.approvalInstance.count({ where: { businessType, businessId } })
    ).toBe(0);
    expect(
      await prisma.approvalAction.count({ where: { instanceId } })
    ).toBe(0);
    expect(
      await prisma.notification.count({ where: { relatedId: instanceId } })
    ).toBe(0);
  });
});
