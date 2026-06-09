import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { startApprovalFlow, processApprovalAction } from "@/lib/approval-engine";

// 使用真实用户 ID（外键约束要求用户必须存在）
let FINANCE_USER_ID: string;
const INITIATOR_ID = "cmptzy3in00098osuivaaam7m"; // lijue@hcec.group

describe("approval-engine countersign per round", () => {
  const businessType = "supplier";
  const businessId = "S-COUNTERSIGN-1";
  const flowLevel = "countersign-test";

  beforeEach(async () => {
    // 仅清理本测试的数据，避免影响并行测试
    const myInstances = await prisma.approvalInstance.findMany({ where: { businessType, businessId }, select: { id: true } });
    const myInstanceIds = myInstances.map(i => i.id);
    if (myInstanceIds.length > 0) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: { in: myInstanceIds } } });
      await prisma.notification.deleteMany({ where: { relatedId: { in: myInstanceIds } } });
    }
    await prisma.approvalInstance.deleteMany({ where: { businessType, businessId }});
    await prisma.approvalFlowDefinition.deleteMany({ where: { businessType, flowLevel }});
    await prisma.supplier.deleteMany({ where: { id: businessId } });

    // 创建测试供应商（updateBusinessStatus 需要该记录存在）
    await prisma.supplier.create({
      data: { id: businessId, name: "测试供应商-COUNTERSIGN" },
    });

    // 创建独立测试角色（避免不同测试共享 finance 角色互相干扰）
    await prisma.role.upsert({
      where: { code: flowLevel },
      update: {},
      create: { code: flowLevel, name: "测试角色-会签" },
    });
    const testRole = await prisma.role.findUniqueOrThrow({ where: { code: flowLevel } });

    // 创建测试用户并关联角色
    const testUser = await prisma.user.create({
      data: {
        username: `test-countersign-approver-${Date.now()}`,
        realName: "测试审批人",
        password: "test",
        role: flowLevel,
        isActive: true,
      },
    });
    await prisma.userRole.create({
      data: { userId: testUser.id, roleId: testRole.id },
    });
    FINANCE_USER_ID = testUser.id;

    // 确保发起人用户存在
    const initiatorExists = await prisma.user.findUnique({ where: { id: INITIATOR_ID } });
    if (!initiatorExists) {
      await prisma.user.create({
        data: {
          id: INITIATOR_ID,
          username: `test-countersign-initiator-${Date.now()}`,
          realName: "测试发起人",
          password: "test",
          role: "admin",
          isActive: true,
        },
      });
    }

    // 创建1个审批节点（使用独立测试角色）
    await prisma.approvalFlowDefinition.create({
      data: { businessType, flowLevel, nodeOrder: 1, nodeName: "会签节点", approverRole: flowLevel, nodeType: "approval", isActive: true }
    });
  });

  afterEach(async () => {
    const myInstances = await prisma.approvalInstance.findMany({ where: { businessType, businessId }, select: { id: true } });
    const myInstanceIds = myInstances.map(i => i.id);
    if (myInstanceIds.length > 0) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: { in: myInstanceIds } } });
      await prisma.notification.deleteMany({ where: { relatedId: { in: myInstanceIds } } });
    }
    await prisma.approvalInstance.deleteMany({ where: { businessType, businessId }});
    await prisma.approvalFlowDefinition.deleteMany({ where: { businessType, flowLevel }});
    await prisma.supplier.deleteMany({ where: { id: businessId } });
    if (FINANCE_USER_ID) {
      await prisma.userRole.deleteMany({ where: { userId: FINANCE_USER_ID } });
      await prisma.user.deleteMany({ where: { id: FINANCE_USER_ID } });
    }
  });

  it("重提后上轮的 approve 不影响本轮 currentNode", async () => {
    // 首次发起
    const r1 = await startApprovalFlow({
      businessType,
      businessId,
      flowLevel,
      initiatorId: INITIATOR_ID
    });

    // 节点1 approve（首轮通过）
    await processApprovalAction({
      instanceId: r1.instanceId,
      approverId: FINANCE_USER_ID,
      action: "approve",
      comment: "首轮通过",
      projectSourceId: undefined,
    });

    // 直接将实例设为已驳回（模拟后续节点驳回）
    await prisma.approvalInstance.update({
      where: { id: r1.instanceId },
      data: { status: "已驳回" }
    });

    // 重提
    const r2 = await startApprovalFlow({
      businessType,
      businessId,
      flowLevel,
      initiatorId: INITIATOR_ID
    });

    expect(r2.instanceId).toBe(r1.instanceId);

    // 重提后：本轮还没有任何 approve，currentNode 应仍然是 1
    const inst = await prisma.approvalInstance.findUnique({ where: { id: r2.instanceId }});
    expect(inst?.currentNode).toBe(1);
    expect(inst?.status).toBe("审批中");
  });
});
