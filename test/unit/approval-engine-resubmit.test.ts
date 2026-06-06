/**
 * 审批引擎 - 已驳回实例复用 (TDD)
 *
 * 验证：
 * 1. 驳回后重提复用同一条 ApprovalInstance，追加 resubmit action
 * 2. 活动实例不允许重复提交
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { startApprovalFlow, processApprovalAction } from "@/lib/approval-engine";

// 使用真实用户 ID（finance 角色有非 admin 用户，resolveApproverIds 不会返回空）
const FINANCE_USER_ID = "cmptzx1we00068osumwlkjhyh"; // zhangjing@hcec.group
const INITIATOR_ID = "cmptzy3in00098osuivaaam7m"; // lijue@hcec.group

describe("approval-engine resubmit reuse", () => {
  const businessType = "supplier";
  const businessId = "S-RESUBMIT-1";
  const flowLevel = "common";

  beforeEach(async () => {
    await prisma.approvalAction.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.approvalInstance.deleteMany({ where: { businessType, businessId } });
    await prisma.approvalFlowDefinition.deleteMany({ where: { businessType, flowLevel } });
    await prisma.supplier.deleteMany({ where: { id: businessId } });

    // 创建测试供应商（updateBusinessStatus 需要该记录存在）
    await prisma.supplier.create({
      data: { id: businessId, name: "测试供应商-RESUBMIT" },
    });

    // 创建2个审批节点（使用 finance 角色，该角色有非 admin 用户）
    await prisma.approvalFlowDefinition.createMany({
      data: [
        { businessType, flowLevel, nodeOrder: 1, nodeName: "节点1", approverRole: "finance", nodeType: "approval", isActive: true },
        { businessType, flowLevel, nodeOrder: 2, nodeName: "节点2", approverRole: "finance", nodeType: "approval", isActive: true },
      ],
    });
  });

  afterEach(async () => {
    await prisma.approvalAction.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.approvalInstance.deleteMany({ where: { businessType, businessId } });
    await prisma.approvalFlowDefinition.deleteMany({ where: { businessType, flowLevel } });
    await prisma.supplier.deleteMany({ where: { id: businessId } });
  });

  it("驳回后重提复用同一条 ApprovalInstance，追加 resubmit action", async () => {
    // 1. 首次发起
    const r1 = await startApprovalFlow({
      businessType,
      businessId,
      flowLevel,
      initiatorId: INITIATOR_ID,
    });
    expect(r1.status).toBe("审批中");
    const instId = r1.instanceId;

    // 2. 节点1通过
    await processApprovalAction({
      instanceId: instId,
      approverId: FINANCE_USER_ID,
      action: "approve",
      comment: "通过",
      projectSourceId: undefined,
    });

    // 确认到了节点2
    const inst1 = await prisma.approvalInstance.findUnique({ where: { id: instId } });
    expect(inst1?.currentNode).toBe(2);

    // 3. 节点2驳回
    await processApprovalAction({
      instanceId: instId,
      approverId: FINANCE_USER_ID,
      action: "reject",
      comment: "需要修改资料",
      projectSourceId: undefined,
    });

    // 确认 instance 数 = 1
    expect(await prisma.approvalInstance.count({ where: { businessType, businessId } })).toBe(1);
    const actionCountAfterReject = await prisma.approvalAction.count({ where: { instanceId: instId } });
    // initiate + approve + reject = 3
    expect(actionCountAfterReject).toBe(3);

    // 4. 重新提交
    const r2 = await startApprovalFlow({
      businessType,
      businessId,
      flowLevel,
      initiatorId: INITIATOR_ID,
    });

    // 断言：同一条 instance 被复用
    expect(r2.instanceId).toBe(instId);
    expect(r2.status).toBe("审批中");
    expect(r2.currentNode).toBe(1);

    // instance 数仍是 1
    expect(await prisma.approvalInstance.count({ where: { businessType, businessId } })).toBe(1);

    // action 数 = 4（追加了 resubmit）
    expect(await prisma.approvalAction.count({ where: { instanceId: instId } })).toBe(4);

    // 最后一个 action 是 resubmit
    const lastAction = await prisma.approvalAction.findFirst({
      where: { instanceId: instId },
      orderBy: { actedAt: "desc" },
      select: { action: true, nodeId: true, approverId: true },
    });
    expect(lastAction?.action).toBe("resubmit");
    expect(lastAction?.nodeId).toBe(1);
    expect(lastAction?.approverId).toBe(INITIATOR_ID);
  });

  it("活动实例不允许重复提交", async () => {
    await startApprovalFlow({ businessType, businessId, flowLevel, initiatorId: INITIATOR_ID });

    await expect(
      startApprovalFlow({ businessType, businessId, flowLevel, initiatorId: INITIATOR_ID })
    ).rejects.toThrow("已有审批中的流程");
  });
});
