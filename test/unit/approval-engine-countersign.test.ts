import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { startApprovalFlow, processApprovalAction } from "@/lib/approval-engine";

// 使用真实用户 ID（外键约束要求用户必须存在）
const FINANCE_USER_ID = "cmptzx1we00068osumwlkjhyh"; // zhangjing@hcec.group
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

    // 创建1个审批节点（使用 finance 角色，该角色有非 admin 用户）
    await prisma.approvalFlowDefinition.create({
      data: { businessType, flowLevel, nodeOrder: 1, nodeName: "会签节点", approverRole: "finance", nodeType: "approval", isActive: true }
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
