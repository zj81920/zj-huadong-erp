import prisma from "./prisma";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  supplier: "供应商审批",
  supplier_change: "供应商变更",
  outsourcing: "外包任务",
  purchase_request: "采购需求",
  inquiries: "采购单",
  delivery_receipt: "到货验收",
  income_contract: "收入合同",
  expense_contract: "支出合同",
  inter_org_contract: "内部结算合同",
  contract_change_order: "合同变更",
  non_contract_expense: "其他支付",
  non_contract_income: "其他收入",
  other_borrowing: "其他借入款",
  payment_application: "合同支付",
  expense_report: "费用报销",
  lending_out: "借出款",
  salary_payment: "工资发放",
  borrowing_return_application: "借入资金归还",
  quotation: "商务报价",
};

function getBusinessTypeLabel(type: string): string {
  return BUSINESS_TYPE_LABELS[type] || type;
}

interface SplitStage {
  name: string;
  amount: number | string;
}

// 根据角色 code 解析实际审批人（支持逗号分隔的多角色）
export async function resolveApproverIds(
  roleCode: string,
  projectSourceId?: string
): Promise<string[]> {
  const roleCodes = roleCode.split(",").map((r) => r.trim()).filter(Boolean);
  const allIds: string[] = [];

  for (const code of roleCodes) {
    const ids = await resolveSingleRoleApproverIds(code, projectSourceId);
    for (const id of ids) {
      if (!allIds.includes(id)) allIds.push(id);
    }
  }

  return allIds;
}

async function resolveSingleRoleApproverIds(
  roleCode: string,
  projectSourceId?: string
): Promise<string[]> {
  const role = await prisma.role.findUnique({
    where: { code: roleCode },
    include: {
      users: {
        where: { user: { isActive: true } },
        include: { user: { select: { id: true } } },
      },
    },
  });

  if (!role || role.users.length === 0) {
    return [];
  }

  const userIds = role.users.map((ur) => ur.user.id);

  const adminUser = await prisma.user.findUnique({
    where: { username: "admin" },
    select: { id: true },
  });
  if (adminUser) {
    return userIds.filter((id) => id !== adminUser.id);
  }

  return userIds;
}

// 检查用户是否可以跳过某个节点（支持多角色）
export async function shouldSkipNode(
  _roleCode: string,
  _userId: string,
  _projectSourceId?: string
): Promise<boolean> {
  // 项目关联已移除，不再自动跳过
  // 发起人自动跳过将在 Task 5 中通过 startApprovalFlow 实现
  return false;
}

// 创建审批实例：节点1即为第一个审批节点，发起人不会自动跳过任何节点
export async function startApprovalFlow(params: {
  businessType: string;
  businessId: string;
  flowLevel: string;
  initiatorId: string;
  projectSourceId?: string;
  businessTitle?: string;
  parentInstanceId?: string;
  wbsItems?: { wbsNodeId: string; workload?: number | null; unit?: string | null; unitPrice?: number | null }[];
}): Promise<{
  instanceId: string;
  currentNode: number;
  status: string;
  approverIds: string[];
}> {
  const { businessType, businessId, flowLevel, initiatorId, projectSourceId, businessTitle, parentInstanceId, wbsItems } = params;

  // 查询既存实例（任意状态）
  const existing = await prisma.approvalInstance.findFirst({
    where: { businessType, businessId },
    orderBy: { createdAt: "desc" },
  });

  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });

  if (flowNodes.length === 0) {
    throw new Error(`未找到 ${businessType}(${flowLevel}) 的审批流配置`);
  }

  const startNode = flowNodes[0];

  // A. 已驳回 → 复用同一条实例
  if (existing && existing.status === "已驳回") {
    const approverIds = await resolveApproverIds(startNode.approverRole, projectSourceId);

    await prisma.approvalInstance.update({
      where: { id: existing.id },
      data: { status: "审批中", currentNode: startNode.nodeOrder },
    });

    // 追加 resubmit action，不删除任何历史 action
    await prisma.approvalAction.create({
      data: {
        instanceId: existing.id,
        nodeId: startNode.nodeOrder,
        nodeName: startNode.nodeName,
        approverId: initiatorId,
        action: "resubmit",
        actedAt: new Date(),
      },
    });

    await updateBusinessStatus(businessType, businessId, "审批中", undefined, existing.id);

    // 外包审批：驳回重提时锁定 WBS 任务
    if (businessType === "outsourcing" && wbsItems && wbsItems.length > 0) {
      await prisma.outsourcingWbsItem.deleteMany({ where: { outsourcingTaskId: businessId } });
      await prisma.outsourcingWbsItem.createMany({
        data: wbsItems.map((item) => ({
          outsourcingTaskId: businessId,
          wbsNodeId: item.wbsNodeId,
          workload: item.workload || null,
          unit: item.unit || null,
          unitPrice: item.unitPrice || null,
          subtotal: (Number(item.workload) || 0) * (Number(item.unitPrice) || 0),
        })),
      });
    }

    // 发起人自动跳过连续的自身审批节点
    const finalNodeOrder = await skipConsecutiveSelfNodes(
      existing.id, flowNodes, startNode.nodeOrder, initiatorId, projectSourceId
    );

    // 检查是否所有节点都被跳过（发起人匹配了所有节点）→ 自动批准
    const autoSkipAtFinal = await prisma.approvalAction.findFirst({
      where: { instanceId: existing.id, nodeId: finalNodeOrder, action: "auto_skip" },
    });
    if (autoSkipAtFinal) {
      await prisma.approvalInstance.update({
        where: { id: existing.id },
        data: { status: "已批准", currentNode: finalNodeOrder },
      });
      await updateBusinessStatus(businessType, businessId, "已批准", undefined, existing.id);
      return { instanceId: existing.id, currentNode: finalNodeOrder, status: "已批准", approverIds: [] };
    }

    await prisma.approvalInstance.update({
      where: { id: existing.id },
      data: { currentNode: finalNodeOrder },
    });

    // 通知最终停留节点的审批人
    const finalNode = flowNodes.find((n) => n.nodeOrder === finalNodeOrder);
    if (finalNode) {
      const finalApproverIds = await resolveApproverIds(finalNode.approverRole, projectSourceId);
      if (finalApproverIds.length > 0) {
        await prisma.notification.createMany({
          data: finalApproverIds.map((aid: string) => ({
            userId: aid,
            title: `${getBusinessTypeLabel(businessType)}${businessTitle ? `：${businessTitle}` : ""} 待审批`,
            description: `${getBusinessTypeLabel(businessType)} 流程已到达您这里，请及时处理`,
            type: "approval_pending",
            relatedId: existing.id,
          })),
        });
      }
      return { instanceId: existing.id, currentNode: finalNodeOrder, status: "审批中", approverIds: finalApproverIds };
    }

    return { instanceId: existing.id, currentNode: finalNodeOrder, status: "审批中", approverIds };
  }

  // B. 已有活动实例 → 拒绝重复提交
  if (existing && ["审批中", "待归档", "待支付"].includes(existing.status)) {
    throw new Error("该业务已有审批中的流程，不能重复提交");
  }

  // C. 首次提交或已批准/已生效/已归档 → 正常创建新实例
  const approverIds = await resolveApproverIds(startNode.approverRole, projectSourceId);

  const instance = await prisma.approvalInstance.create({
    data: {
      businessType,
      businessId,
      flowLevel,
      currentNode: startNode.nodeOrder,
      status: "审批中",
      businessTitle: businessTitle || null,
      parentInstanceId: parentInstanceId || null,
    },
  });

  // 为节点1创建 initiate 动作（仅作记录，不在时间线渲染为审批节点）
  await prisma.approvalAction.create({
    data: {
      instanceId: instance.id,
      nodeId: startNode.nodeOrder,
      nodeName: startNode.nodeName,
      approverId: initiatorId,
      action: "initiate",
      actedAt: new Date(),
    },
  });

  await updateBusinessStatus(businessType, businessId, "审批中", undefined, instance.id);

  // 外包审批：首次提交时锁定 WBS 任务
  if (businessType === "outsourcing" && wbsItems && wbsItems.length > 0) {
    await prisma.outsourcingWbsItem.createMany({
      data: wbsItems.map((item) => ({
        outsourcingTaskId: businessId,
        wbsNodeId: item.wbsNodeId,
        workload: item.workload || null,
        unit: item.unit || null,
        unitPrice: item.unitPrice || null,
        subtotal: (Number(item.workload) || 0) * (Number(item.unitPrice) || 0),
      })),
    });
  }

  // 发起人自动跳过连续的自身审批节点
  const finalNodeOrder = await skipConsecutiveSelfNodes(
    instance.id, flowNodes, startNode.nodeOrder, initiatorId, projectSourceId
  );

  // 检查是否所有节点都被跳过（发起人匹配了所有节点）→ 自动批准
  const autoSkipAtFinal = await prisma.approvalAction.findFirst({
    where: { instanceId: instance.id, nodeId: finalNodeOrder, action: "auto_skip" },
  });
  if (autoSkipAtFinal) {
    await prisma.approvalInstance.update({
      where: { id: instance.id },
      data: { status: "已批准", currentNode: finalNodeOrder },
    });
    await updateBusinessStatus(businessType, businessId, "已批准", undefined, instance.id);
    return { instanceId: instance.id, currentNode: finalNodeOrder, status: "已批准", approverIds: [] };
  }

  await prisma.approvalInstance.update({
    where: { id: instance.id },
    data: { currentNode: finalNodeOrder },
  });

  // 通知最终停留节点的审批人
  const finalNode = flowNodes.find((n) => n.nodeOrder === finalNodeOrder);
  if (finalNode) {
    const finalApproverIds = await resolveApproverIds(finalNode.approverRole, projectSourceId);
    if (finalApproverIds.length > 0) {
      await prisma.notification.createMany({
        data: finalApproverIds.map((aid: string) => ({
          userId: aid,
          title: `${getBusinessTypeLabel(businessType)}${businessTitle ? `：${businessTitle}` : ""} 待审批`,
          description: `${getBusinessTypeLabel(businessType)} 流程已到达您这里，请及时处理`,
          type: "approval_pending",
          relatedId: instance.id,
        })),
      });
    }
    return { instanceId: instance.id, currentNode: finalNodeOrder, status: "审批中", approverIds: finalApproverIds };
  }

  return { instanceId: instance.id, currentNode: finalNodeOrder, status: "审批中", approverIds };
}

// 发起人自动跳过：检查发起人角色是否匹配当前节点，如果匹配则创建 auto_skip action
// 返回 true 表示已跳过（调用方应继续前进到下一个节点）
async function autoSkipInitiator(
  instanceId: string,
  nodeOrder: number,
  initiatorId: string,
  projectSourceId?: string
): Promise<boolean> {
  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
    select: { businessType: true, flowLevel: true },
  });
  if (!instance) return false;

  const flowNode = await prisma.approvalFlowDefinition.findFirst({
    where: {
      businessType: instance.businessType,
      flowLevel: instance.flowLevel,
      nodeOrder,
      isActive: true,
    },
  });
  if (!flowNode) return false;

  // 归档和支付节点不跳过
  if (flowNode.nodeType === "archive" || flowNode.nodeType === "payment") return false;

  // 检查发起人角色是否匹配该节点的审批角色
  const nodeRoles = flowNode.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
  const userRoles = await prisma.userRole.findMany({
    where: { userId: initiatorId },
    include: { role: { select: { code: true } } },
  });
  const userRoleCodes = new Set(userRoles.map((ur) => ur.role.code));
  const isSelf = nodeRoles.some((r) => userRoleCodes.has(r));

  if (isSelf) {
    await prisma.approvalAction.create({
      data: {
        instanceId,
        nodeId: nodeOrder,
        nodeName: flowNode.nodeName,
        approverId: initiatorId,
        action: "auto_skip",
        comment: "发起人自动跳过",
        actedAt: new Date(),
      },
    });
    return true;
  }
  return false;
}

// 跳过连续的发起人节点：从 startNodeOrder 开始，逐个检查并跳过
// 返回最终停留的 nodeOrder
async function skipConsecutiveSelfNodes(
  instanceId: string,
  flowNodes: { nodeOrder: number; nodeType?: string; approverRole: string }[],
  startNodeOrder: number,
  initiatorId: string,
  projectSourceId?: string
): Promise<number> {
  let currentNodeOrder = startNodeOrder;
  for (const node of flowNodes) {
    if (node.nodeOrder < startNodeOrder) continue;
    const skipped = await autoSkipInitiator(instanceId, node.nodeOrder, initiatorId, projectSourceId);
    if (skipped) {
      // 找下一个节点
      const nextNode = flowNodes.find((n) => n.nodeOrder > node.nodeOrder);
      if (nextNode) {
        currentNodeOrder = nextNode.nodeOrder;
      } else {
        // 没有下一个节点了，停在当前
        currentNodeOrder = node.nodeOrder;
        break;
      }
    } else {
      currentNodeOrder = node.nodeOrder;
      break;
    }
  }
  return currentNodeOrder;
}

// 会签检查：判断当前节点的所有角色用户是否都已完成审批
// 逻辑：多角色间是"或签"（任一角色完成即可），同角色内是"会签"（所有用户都需审批）
async function checkCountersignComplete(
  instanceId: string,
  nodeOrder: number,
  approverRoleStr: string,
  projectSourceId?: string
): Promise<boolean> {
  const roleCodes = approverRoleStr.split(",").map((r) => r.trim()).filter(Boolean);
  if (roleCodes.length === 0) return true;

  // === 找到本轮起始时间（最后一次 initiate 或 resubmit） ===
  const lastStart = await prisma.approvalAction.findFirst({
    where: { instanceId, action: { in: ["initiate", "resubmit"] } },
    orderBy: { actedAt: "desc" },
    select: { actedAt: true }
  });
  const sinceAt = lastStart?.actedAt || new Date(0);

  // 仅取本轮（lastStart 之后）的 approve 动作
  const actions = await prisma.approvalAction.findMany({
    where: {
      instanceId,
      nodeId: nodeOrder,
      action: "approve",
      actedAt: { gte: sinceAt }
    },
  });

  const approvedUserIds = new Set(actions.map((a) => a.approverId));

  // 查詢 admin 用戶 ID（admin 擁有所有角色，但不應參與流程审批）
  const adminUser = await prisma.user.findUnique({
    where: { username: "admin" },
    select: { id: true },
  });

  // 同角色内所有用户（排除 admin 后）都审批通过才算会签完成
  for (const roleCode of roleCodes) {
    let roleUserIds = await resolveSingleRoleApproverIds(roleCode, projectSourceId);
    if (roleUserIds.length === 0) continue;
    // 排除 admin 用戶
    if (adminUser) {
      roleUserIds = roleUserIds.filter((id) => id !== adminUser.id);
    }
    if (roleUserIds.length === 0) continue;
    const allApproved = roleUserIds.every((id) => approvedUserIds.has(id));
    if (allApproved) return true;
  }

  return false;
}

// 审批动作：通过/驳回/归档/支付
export async function processApprovalAction(params: {
  instanceId: string;
  approverId: string;
  action: "approve" | "reject" | "archive" | "payment";
  comment?: string;
  projectSourceId?: string;
  archivedUrl?: string;
  bankAccountId?: string;
  paymentMethod?: string;
}): Promise<{
  status: string;
  currentNode: number;
  nextApproverIds?: string[];
}> {
  const { instanceId, approverId, action, comment, projectSourceId, archivedUrl, bankAccountId, paymentMethod } = params;

  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error("审批实例不存在");
  }

  if (instance.status !== "审批中" && instance.status !== "待归档") {
    throw new Error(`当前状态为"${instance.status}"，无法操作`);
  }

  // 权限校验：调用 resolveUserApprovalCapabilities 检查操作者是否有权审批
  const capabilities = await resolveUserApprovalCapabilities({
    instanceId,
    userId: approverId,
    projectSourceId,
  });

  if (action === "approve" && !capabilities.canApprove) {
    if (capabilities.isInitiator) {
      throw new Error("发起人不能审批自己的申请");
    }
    if (capabilities.hasActedThisRound) {
      throw new Error("您已在本轮审批过此节点");
    }
    throw new Error("您没有权限审批此节点");
  }
  if (action === "reject" && !capabilities.canReject) {
    if (capabilities.isInitiator) {
      throw new Error("发起人不能审批自己的申请");
    }
    if (capabilities.hasActedThisRound) {
      throw new Error("您已在本轮审批过此节点");
    }
    throw new Error("您没有权限审批此节点");
  }
  if (action === "archive" && !capabilities.canArchive) {
    throw new Error("当前节点不是归档节点或您没有归档权限");
  }
  if (action === "payment" && !capabilities.canPayment) {
    throw new Error("当前节点不是支付节点或您没有支付权限");
  }

  // 获取审批流节点
  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: {
      businessType: instance.businessType,
      flowLevel: instance.flowLevel,
      isActive: true,
    },
    orderBy: { nodeOrder: "asc" },
  });

  const currentNode = flowNodes.find(
    (n) => n.nodeOrder === instance.currentNode
  );

  if (!currentNode) {
    throw new Error("当前节点配置不存在");
  }

  const isFinanceApprove = action === "approve" && currentNode.approverRole.split(",").map((r) => r.trim()).includes("finance");

  // 审批通过时快照审批人电子签名
  let signatureUrl: string | null = null;
  if (action === "approve" || action === "archive" || action === "payment") {
    const approverUser = await prisma.user.findUnique({
      where: { id: approverId },
      select: { signatureUrl: true },
    });
    signatureUrl = approverUser?.signatureUrl || null;
  }

  // 归档节点处理
  if (action === "archive") {
    await prisma.approvalAction.create({
      data: {
        instanceId,
        nodeId: currentNode.nodeOrder,
        nodeName: currentNode.nodeName,
        approverId,
        action: "archive",
        comment: comment || null,
        actedAt: new Date(),
        signatureUrl,
      },
    });

    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "已批准", currentNode: currentNode.nodeOrder },
    });

    // 更新业务单据状态为"已归档"并保存扫描件
    await updateBusinessStatus(instance.businessType, instance.businessId, "已归档", archivedUrl);

    // 通知发起人审批已完成
    const archiveInitiator = await prisma.approvalAction.findFirst({
      where: { instanceId, action: "initiate" },
      select: { approverId: true },
    });
    if (archiveInitiator) {
      await prisma.notification.create({
        data: {
          userId: archiveInitiator.approverId,
          title: `${getBusinessTypeLabel(instance.businessType)}${instance.businessTitle ? `：${instance.businessTitle}` : ""} 审批已完成`,
          description: "您的审批申请已全部通过并归档",
          type: "approval_completed",
          relatedId: instanceId,
        },
      });
    }

    return { status: "已批准", currentNode: currentNode.nodeOrder };
  }

  // 支付节点处理
  if (action === "payment") {
    await prisma.approvalAction.create({
      data: {
        instanceId,
        nodeId: currentNode.nodeOrder,
        nodeName: currentNode.nodeName,
        approverId,
        action: "payment",
        comment: comment || null,
        actedAt: new Date(),
        signatureUrl,
      },
    });

    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "已批准", currentNode: currentNode.nodeOrder },
    });

    await updateBusinessStatus(instance.businessType, instance.businessId, "已支付");

    return { status: "已批准", currentNode: currentNode.nodeOrder };
  }

  // 记录审批动作
  await prisma.approvalAction.create({
    data: {
      instanceId,
      nodeId: currentNode.nodeOrder,
      nodeName: currentNode.nodeName,
      approverId,
      action,
      comment: comment || null,
      actedAt: new Date(),
      signatureUrl,
    },
  });

  // 驳回
  if (action === "reject") {
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "已驳回", currentNode: currentNode.nodeOrder },
    });

    await updateBusinessStatus(instance.businessType, instance.businessId, "已驳回");

    // 通知发起人审批被驳回
    const rejectInitiator = await prisma.approvalAction.findFirst({
      where: { instanceId, action: "initiate" },
      select: { approverId: true },
    });
    if (rejectInitiator) {
      await prisma.notification.create({
        data: {
          userId: rejectInitiator.approverId,
          title: `${getBusinessTypeLabel(instance.businessType)}${instance.businessTitle ? `：${instance.businessTitle}` : ""} 审批被驳回`,
          description: comment ? `原因：${comment}` : "您的审批申请已被驳回",
          type: "approval_rejected",
          relatedId: instanceId,
        },
      });
    }

    return { status: "已驳回", currentNode: currentNode.nodeOrder };
  }

  // 通过 - 检查会签是否完成
  const currentIdx = flowNodes.findIndex(
    (n) => n.nodeOrder === currentNode.nodeOrder
  );

  // 会签检查：获取当前节点所有角色的所有用户，看是否都已审批
  const countersignComplete = await checkCountersignComplete(
    instanceId,
    currentNode.nodeOrder,
    currentNode.approverRole,
    projectSourceId
  );

  if (!countersignComplete) {
    return {
      status: "审批中",
      currentNode: currentNode.nodeOrder,
      nextApproverIds: [],
    };
  }

  // 会签已完成，推进到下一个节点（使用事务保证原子性）
  if (currentIdx >= flowNodes.length - 1) {
    await prisma.$transaction(async (tx) => {
      await tx.approvalInstance.update({
        where: { id: instanceId },
        data: { status: "已批准", currentNode: currentNode.nodeOrder },
      });
      await updateBusinessStatus(instance.businessType, instance.businessId, "已批准", undefined, undefined, isFinanceApprove ? bankAccountId : undefined, isFinanceApprove ? paymentMethod : undefined);
    });

    return { status: "已批准", currentNode: currentNode.nodeOrder };
  }

  const nextIdx = currentIdx + 1;
  const nextNode = flowNodes[nextIdx];

  if (nextNode.nodeType === "archive") {
    const nextApproverIds = await resolveApproverIds(
      nextNode.approverRole,
      projectSourceId
    );

    const result = await prisma.$transaction(async (tx) => {
      await updateBusinessStatus(instance.businessType, instance.businessId, "已批准", undefined, undefined, isFinanceApprove ? bankAccountId : undefined, isFinanceApprove ? paymentMethod : undefined);
      await tx.approvalInstance.update({
        where: { id: instanceId },
        data: { currentNode: nextNode.nodeOrder, status: "审批中" },
      });
      return { nextApproverIds };
    });

    // 通知下一节点审批人
    if (result.nextApproverIds && result.nextApproverIds.length > 0) {
      await prisma.notification.createMany({
        data: result.nextApproverIds.map((approverId: string) => ({
          userId: approverId,
          title: `${getBusinessTypeLabel(instance.businessType)}${instance.businessTitle ? `：${instance.businessTitle}` : ""} 待审批`,
          description: `${getBusinessTypeLabel(instance.businessType)} 流程已到达您这里，请及时处理`,
          type: "approval_pending",
          relatedId: instanceId,
        })),
      });
    }

    return {
      status: "待归档",
      currentNode: nextNode.nodeOrder,
      nextApproverIds: result.nextApproverIds,
    };
  }

  if (nextNode.nodeType === "payment") {
    const nextApproverIds = await resolveApproverIds(
      nextNode.approverRole,
      projectSourceId
    );

    const result = await prisma.$transaction(async (tx) => {
      await updateBusinessStatus(instance.businessType, instance.businessId, "已批准", undefined, undefined, isFinanceApprove ? bankAccountId : undefined, isFinanceApprove ? paymentMethod : undefined);
      await tx.approvalInstance.update({
        where: { id: instanceId },
        data: { currentNode: nextNode.nodeOrder, status: "审批中" },
      });
      return { nextApproverIds };
    });

    // 通知下一节点审批人
    if (result.nextApproverIds && result.nextApproverIds.length > 0) {
      await prisma.notification.createMany({
        data: result.nextApproverIds.map((approverId: string) => ({
          userId: approverId,
          title: `${getBusinessTypeLabel(instance.businessType)}${instance.businessTitle ? `：${instance.businessTitle}` : ""} 待审批`,
          description: `${getBusinessTypeLabel(instance.businessType)} 流程已到达您这里，请及时处理`,
          type: "approval_pending",
          relatedId: instanceId,
        })),
      });
    }

    return {
      status: "待支付",
      currentNode: nextNode.nodeOrder,
      nextApproverIds: result.nextApproverIds,
    };
  }

  const nextApproverIds = await resolveApproverIds(
    nextNode.approverRole,
    projectSourceId
  );

  // 获取发起人 ID（用于自动跳过检查）
  const initiatorAction = await prisma.approvalAction.findFirst({
    where: { instanceId, action: { in: ["initiate", "resubmit"] } },
    orderBy: { actedAt: "desc" },
    select: { approverId: true },
  });
  const initiatorId = initiatorAction?.approverId;

  // 发起人自动跳过：如果下一节点需要发起人审批，则跳过并继续前进
  let actualNextNodeOrder = nextNode.nodeOrder;
  if (initiatorId) {
    const skippedNodeOrder = await skipConsecutiveSelfNodes(
      instanceId, flowNodes, nextNode.nodeOrder, initiatorId, projectSourceId
    );
    actualNextNodeOrder = skippedNodeOrder;
  }

  const actualNode = flowNodes.find((n) => n.nodeOrder === actualNextNodeOrder) || nextNode;
  const actualApproverIds = actualNode.nodeOrder === nextNode.nodeOrder
    ? nextApproverIds
    : await resolveApproverIds(actualNode.approverRole, projectSourceId);

  await prisma.approvalInstance.update({
    where: { id: instanceId },
    data: {
      currentNode: actualNextNodeOrder,
      status: "审批中",
    },
  });

  // 通知最终节点的审批人
  if (actualApproverIds && actualApproverIds.length > 0) {
    await prisma.notification.createMany({
      data: actualApproverIds.map((approverId) => ({
        userId: approverId,
        title: `${getBusinessTypeLabel(instance.businessType)}${instance.businessTitle ? `：${instance.businessTitle}` : ""} 待审批`,
        description: `${getBusinessTypeLabel(instance.businessType)} 流程已到达您这里，请及时处理`,
        type: "approval_pending",
        relatedId: instanceId,
      })),
    });
  }

  return {
    status: "审批中",
    currentNode: actualNextNodeOrder,
    nextApproverIds: actualApproverIds,
  };
}

// 更新业务单据状态
async function updateBusinessStatus(
  businessType: string,
  businessId: string,
  status: string,
  archivedUrl?: string,
  instanceId?: string,
  bankAccountId?: string,
  paymentMethod?: string
) {
  const updateData: Record<string, unknown> = { status };

  if (archivedUrl) {
    updateData.archivedUrl = archivedUrl;
  }
  if (instanceId) {
    updateData.approvalInstanceId = instanceId;
  }

  switch (businessType) {
    case "income_contract": {
      await prisma.incomeContract.update({ where: { id: businessId }, data: updateData });
      if (status === "已批准") {
        const existingReceivables = await prisma.receivable.findMany({
          where: { sourceType: "income_contract", sourceId: businessId },
        });
        if (existingReceivables.length === 0) {
          const contract = await prisma.incomeContract.findUnique({ where: { id: businessId } });
          if (contract) {
            const stages = Array.isArray(contract.splitStages)
              ? (contract.splitStages as unknown as SplitStage[])
              : [];
            const projectSourceId = contract.projectSourceId || null;
            const now = new Date();
            const defaultDueDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
            if (stages.length > 0) {
              for (const stage of stages) {
                const stageAmount = typeof stage.amount === "string" ? parseFloat(stage.amount) : stage.amount;
                if (stageAmount > 0) {
                  await prisma.receivable.create({
                    data: {
                      sourceType: "income_contract",
                      sourceId: businessId,
                      projectSourceId,
                      dueDate: defaultDueDate,
                      amount: stageAmount,
                      paidAmount: 0,
                      invoicedAmount: 0,
                      status: "未收",
                    },
                  });
                }
              }
            } else {
              await prisma.receivable.create({
                data: {
                  sourceType: "income_contract",
                  sourceId: businessId,
                  projectSourceId,
                  dueDate: defaultDueDate,
                  amount: parseFloat(contract.totalAmount.toString()),
                  paidAmount: 0,
                  invoicedAmount: 0,
                  status: "未收",
                },
              });
            }
          }
        }
      }
      break;
    }
    case "expense_contract": {
      await prisma.expenseContract.update({ where: { id: businessId }, data: updateData });
      if (status === "已批准") {
        const contract = await prisma.expenseContract.findUnique({
          where: { id: businessId },
          include: {
            inquiry: { include: { purchaseRequest: true } },
          },
        });
        if (contract) {
          const existingPayables = await prisma.payable.findMany({
            where: { sourceType: "expense_contract", sourceId: businessId },
          });
          if (existingPayables.length === 0) {
            const now = new Date();
            const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
            await prisma.payable.create({
              data: {
                sourceType: "expense_contract",
                sourceId: businessId,
                projectSourceId: contract.projectSourceId || null,
                dueDate,
                amount: parseFloat(contract.totalAmount.toString()),
                paidAmount: 0,
                invoicedAmount: 0,
                status: "未付",
              },
            });
          }
          if (contract.inquiry?.purchaseRequestId) {
            await prisma.purchaseRequest.update({
              where: { id: contract.inquiry.purchaseRequestId },
              data: { status: "已采购" },
            });
          }
        }
      }
      break;
    }
    case "inquiries":
      await prisma.inquiry.update({ where: { id: businessId }, data: updateData });
      break;
    case "supplier": {
      const supplierData: Record<string, unknown> = {};
      if (status === "已批准") {
        supplierData.approvalStatus = "已批准";
        supplierData.status = "当前有效";
      } else if (status === "已驳回") {
        supplierData.approvalStatus = "已驳回";
      } else {
        supplierData.approvalStatus = status;
      }
      if (instanceId) {
        supplierData.approvalInstanceId = instanceId;
      }
      await prisma.supplier.update({ where: { id: businessId }, data: supplierData });
      break;
    }
    case "supplier_change": {
      const scUpdate: Record<string, unknown> = { approvalStatus: status };
      if (instanceId) scUpdate.approvalInstanceId = instanceId;
      await prisma.supplierChange.update({
        where: { id: businessId },
        data: scUpdate,
      });

      // 审批通过后，将变更数据回写到原供应商
      if (status === "已批准") {
        const change = await prisma.supplierChange.findUnique({
          where: { id: businessId },
        });
        if (change) {
          await prisma.supplier.update({
            where: { id: change.supplierId },
            data: {
              name: change.name,
              supplierType: change.supplierType,
              status: change.status,
              contactPerson: change.contactPerson,
              phone: change.phone,
              email: change.email,
              address: change.address,
              bankName: change.bankName,
              bankAccount: change.bankAccount,
              remark: change.remark,
            },
          });
        }
      }
      break;
    }
    case "outsourcing": {
      const outsourceData: Record<string, unknown> = { approvalStatus: status };
      if (instanceId) outsourceData.approvalInstanceId = instanceId;
      await prisma.outsourcingTask.update({ where: { id: businessId }, data: outsourceData });

      if (status === "已批准") {
        // 审批通过：回写外包对象名到 WBS 责任人
        const task = await prisma.outsourcingTask.findUnique({
          where: { id: businessId },
          include: { wbsItems: { select: { wbsNodeId: true } } },
        });

        if (task && task.wbsItems.length > 0) {
          const wbsNodeIds = task.wbsItems.map((item) => item.wbsNodeId);
          const wbsNodes = await prisma.projectWbsNode.findMany({
            where: { id: { in: wbsNodeIds } },
            select: { id: true, responsibleIds: true },
          });

          for (const node of wbsNodes) {
            const rawIds = (node.responsibleIds as unknown[]) || [];
            const entries: unknown[] = rawIds.map((item: unknown) => {
              if (typeof item === "string") {
                return { type: "person", id: item, name: "" };
              }
              return item;
            });

            const existingOutsourcing = entries.some(
              (e: unknown) => typeof e === "object" && e !== null && (e as Record<string, unknown>).type === "outsourcing" && (e as Record<string, unknown>).id === businessId
            );
            if (!existingOutsourcing) {
              entries.push({
                type: "outsourcing",
                id: businessId,
                name: task.targetName,
              });
            }

            await prisma.projectWbsNode.update({
              where: { id: node.id },
              data: { responsibleIds: entries as any },
            });
          }
        }
      } else if (status === "已驳回") {
        // 审批驳回：删除 OutsourcingWbsItem 关联记录（解锁）
        await prisma.outsourcingWbsItem.deleteMany({
          where: { outsourcingTaskId: businessId },
        });
      }
      break;
    }
    case "purchase_request":
      await prisma.purchaseRequest.update({ where: { id: businessId }, data: updateData });
      break;
    case "payment_application": {
      const payData: Record<string, unknown> = {};
      if (bankAccountId) payData.bankAccountId = bankAccountId;
      if (paymentMethod) payData.paymentMethodInfo = paymentMethod;
      if (archivedUrl) payData.archivedUrl = archivedUrl;
      if (instanceId) payData.approvalInstanceId = instanceId;

      if (status === "已支付" || status === "已批准") {
        const app = await prisma.paymentApplication.findUnique({
          where: { id: businessId },
          include: { payable: true },
        });
        if (app && app.payable) {
          const existingVouchers = await prisma.paymentVoucher.findMany({
            where: { paymentApplicationId: businessId },
          });
          if (existingVouchers.length === 0) {
            const payable = app.payable;
            const appAmount = parseFloat(app.amount.toString());
            const currentPaid = parseFloat(payable.paidAmount.toString());
            const totalAmount = parseFloat(payable.amount.toString());
            const newPaidAmount = currentPaid + appAmount;

            await prisma.paymentVoucher.create({
              data: {
                paymentApplicationId: businessId,
                amount: app.amount,
                paymentDate: new Date(),
                bankAccount: app.bankAccount || null,
                paymentMethod: app.paymentMethod || app.paymentMethodInfo || paymentMethod || null,
                paymentReason: app.paymentReason || null,
                remark: app.remark || null,
              },
            });

            await prisma.payable.update({
              where: { id: payable.id },
              data: {
                paidAmount: newPaidAmount,
                status: newPaidAmount >= totalAmount ? "已付" : "部分付款",
              },
            });
          }
          if (status === "已支付") {
            payData.approvalStatus = "已付款";
            payData.paidAt = new Date();
          } else {
            payData.approvalStatus = status;
          }
        } else {
          payData.approvalStatus = status;
        }
      } else {
        payData.approvalStatus = status;
      }

      await prisma.paymentApplication.update({ where: { id: businessId }, data: payData });
      break;
    }
    case "expense_report":
      if (bankAccountId) updateData.bankAccountId = bankAccountId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      await prisma.expenseReport.update({ where: { id: businessId }, data: updateData });
      break;
    case "non_contract_expense": {
      if (bankAccountId) updateData.bankAccountId = bankAccountId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      const updated = await prisma.nonContractExpense.update({ where: { id: businessId }, data: updateData });
      // 同步往来信息到往来信息库
      if (updated.counterparty) {
        const existing = await prisma.counterpartyInfo.findFirst({
          where: {
            name: updated.counterparty,
            bankName: updated.counterpartyBankName ?? null,
            bankAccount: updated.counterpartyBankAccount ?? null,
          },
        });
        if (!existing) {
          await prisma.counterpartyInfo.create({
            data: {
              name: updated.counterparty,
              bankName: updated.counterpartyBankName ?? null,
              bankAccount: updated.counterpartyBankAccount ?? null,
            },
          });
        }
      }
      break;
    }
    case "lending_out": {
      if (bankAccountId) updateData.bankAccountId = bankAccountId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      const lendData: Record<string, unknown> = {};
      if (status === "已批准") {
        lendData.status = "未还清";
      } else if (status === "已驳回") {
        lendData.status = "已驳回";
      } else {
        lendData.status = status;
      }
      if (instanceId) lendData.approvalInstanceId = instanceId;
      await prisma.lendingOut.update({ where: { id: businessId }, data: lendData });
      break;
    }
    case "salary_payment":
      if (bankAccountId) updateData.bankAccountId = bankAccountId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      if (status === "已支付" || status === "已发放") {
        updateData.paidAt = new Date();
      }
      await prisma.salaryBatch.update({ where: { id: businessId }, data: updateData });
      break;
    case "borrowing_return_application":
      if (bankAccountId) updateData.bankAccountId = bankAccountId;
      if (paymentMethod) updateData.paymentMethod = paymentMethod;
      await prisma.borrowingReturnApplication.update({ where: { id: businessId }, data: updateData });
      if (status === "已支付") {
        const app = await prisma.borrowingReturnApplication.findUnique({ where: { id: businessId } });
        if (app && !app.executedAt) {
          if (app.sourceType === "shareholder_capital") {
            await prisma.capitalReturn.create({
              data: {
                contributionId: app.sourceId,
                amount: app.returnAmount,
                returnDate: new Date(),
                remark: app.remark,
              },
            });
            const contribution = await prisma.capitalContribution.findUnique({ where: { id: app.sourceId } });
            if (contribution) {
              const retAmt = Number(app.returnAmount || 0);
              await prisma.capitalContribution.update({
                where: { id: app.sourceId },
                data: {
                  returnedAmount: Number(contribution.returnedAmount || 0) + retAmt,
                  remainingAmount: Number(contribution.remainingAmount || 0) - retAmt,
                },
              });
            }
          }
          if (app.sourceType === "other_borrowing") {
            await prisma.borrowingReturn.create({
              data: {
                borrowingId: app.sourceId,
                amount: app.returnAmount,
                returnDate: new Date(),
                remark: app.remark,
              },
            });
            const borrowing = await prisma.otherBorrowing.findUnique({ where: { id: app.sourceId } });
            if (borrowing) {
              const retAmt = Number(app.returnAmount || 0);
              const newRemaining = Number(borrowing.remainingAmount || 0) - retAmt;
              await prisma.otherBorrowing.update({
                where: { id: app.sourceId },
                data: {
                  returnedAmount: Number(borrowing.returnedAmount || 0) + retAmt,
                  remainingAmount: newRemaining,
                  ...(newRemaining <= 0 ? { status: "已还清" } : {}),
                },
              });
            }
          }
          await prisma.borrowingReturnApplication.update({
            where: { id: businessId },
            data: { executedAt: new Date() },
          });
        }
      }
      break;
    case "non_contract_income":
      await prisma.nonContractIncome.update({ where: { id: businessId }, data: updateData });
      break;
    case "other_borrowing":
      await prisma.otherBorrowing.update({ where: { id: businessId }, data: updateData });
      break;
    case "delivery_receipt":
      await prisma.deliveryReceipt.update({ where: { id: businessId }, data: updateData });
      break;
    case "contract_change_order": {
      await prisma.contractChangeOrder.update({
        where: { id: businessId },
        data: updateData,
      });

      if (status === "已批准") {
        const order = await prisma.contractChangeOrder.findUnique({
          where: { id: businessId },
        });
        if (!order) break;

        // 1. 更新关联合同金额
        const newAmount = parseFloat(order.newAmount.toString());
        if (order.contractType === "income_contract") {
          await prisma.incomeContract.update({
            where: { id: order.contractId },
            data: { totalAmount: newAmount },
          });
        } else if (order.contractType === "expense_contract") {
          await prisma.expenseContract.update({
            where: { id: order.contractId },
            data: { totalAmount: newAmount },
          });
        } else if (order.contractType === "inter_org_contract") {
          await prisma.interOrgContract.update({
            where: { id: order.contractId },
            data: { settlementAmount: newAmount },
          });
        }

        // 2. 调整关联的应收/应付记录
        const diff = parseFloat(order.amountDifference.toString());
        if (order.contractType === "income_contract" || order.contractType === "inter_org_contract") {
          const receivable = await prisma.receivable.findFirst({
            where: { sourceType: order.contractType, sourceId: order.contractId },
          });
          if (receivable) {
            const newReceivableAmount = parseFloat(receivable.amount.toString()) + diff;
            const paidAmt = parseFloat(receivable.paidAmount.toString());
            await prisma.receivable.update({
              where: { id: receivable.id },
              data: { amount: newReceivableAmount },
            });
            // 同步更新变更单的超收标记
            if (paidAmt > newReceivableAmount) {
              await prisma.contractChangeOrder.update({
                where: { id: businessId },
                data: {
                  hasOverCollection: true,
                  overCollectionAmount: paidAmt - newReceivableAmount,
                },
              });
            }
          }
        } else if (order.contractType === "expense_contract") {
          const payable = await prisma.payable.findFirst({
            where: { sourceType: "expense_contract", sourceId: order.contractId },
          });
          if (payable) {
            const newPayableAmount = parseFloat(payable.amount.toString()) + diff;
            await prisma.payable.update({
              where: { id: payable.id },
              data: { amount: newPayableAmount },
            });
          }
        }

        // 3. 追加归档文件到原合同
        const newFiles = Array.isArray(order.newFiles) ? order.newFiles as string[] : [];
        if (newFiles.length > 0) {
          const contractModel = order.contractType === "income_contract" ? "incomeContract" :
            order.contractType === "expense_contract" ? "expenseContract" : "interOrgContract";
          const existingContract = await (prisma[contractModel as keyof typeof prisma] as any).findUnique({
            where: { id: order.contractId },
            select: { archivedUrl: true },
          });
          const existingFiles: string[] = existingContract?.archivedUrl
            ? (() => { try { const p = JSON.parse(existingContract.archivedUrl); return Array.isArray(p) ? p : [existingContract.archivedUrl]; } catch { return [existingContract.archivedUrl]; } })()
            : [];
          const merged = [...existingFiles, ...newFiles];
          await (prisma[contractModel as keyof typeof prisma] as any).update({
            where: { id: order.contractId },
            data: { archivedUrl: JSON.stringify(merged) },
          });
        }
      } else if (status === "已归档") {
        // 归档完成，变更单标记为"已生效"，可选保存归档文件
        await prisma.contractChangeOrder.update({
          where: { id: businessId },
          data: {
            status: "已生效",
            ...(archivedUrl ? { archivedUrl } : {}),
          },
        });
      }
      break;
    }
    case "inter_org_contract": {
      const interData: Record<string, unknown> = {};
      if (instanceId) interData.approvalInstanceId = instanceId;
      interData.status = status;
      
      await prisma.interOrgContract.update({ where: { id: businessId }, data: interData });

      const contract = await prisma.interOrgContract.findUnique({
        where: { id: businessId },
      });

      if (status === "已批准") {
        // 防重复创建应收记录
        const existingReceivables = await prisma.receivable.findMany({
          where: { sourceType: "inter_org_contract", sourceId: businessId },
        });
        
        if (existingReceivables.length === 0) {
          if (contract && parseFloat(contract.settlementAmount.toString()) > 0) {
            // 查找关联收入合同的 projectSourceId
            let projectSourceId: string | null = null;
            if (contract.relatedContractId) {
              const incomeContract = await prisma.incomeContract.findUnique({
                where: { id: contract.relatedContractId },
                select: { projectSourceId: true },
              });
              projectSourceId = incomeContract?.projectSourceId || null;
            }
            
            await prisma.receivable.create({
              data: {
                sourceType: "inter_org_contract",
                sourceId: businessId,
                projectSourceId,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                amount: contract.settlementAmount,
                paidAmount: 0,
                invoicedAmount: 0,
                status: "未收",
              },
            });
          }
        }
        
        // 更新关联的收入合同标记
        if (contract?.relatedContractId) {
          await prisma.incomeContract.update({
            where: { id: contract.relatedContractId },
            data: { interOrgContractId: businessId },
          });
        }
      } else if (status === "已驳回" || status === "草稿") {
        // 清空关联标记
        if (contract?.relatedContractId) {
          await prisma.incomeContract.update({
            where: { id: contract.relatedContractId },
            data: { interOrgContractId: null },
          });
        }
      }
      break;
    }
  }
}

// 获取当前用户待审批的实例列表
export async function getPendingApprovals(userId: string) {
  // 获取用户角色
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true } } },
  });

  const roleCodes = userRoles.map((ur) => ur.role.code).filter((code) => code !== "admin");

  // 获取所有审批中/待归档/已驳回的实例
  const instances = await prisma.approvalInstance.findMany({
    where: { status: { in: ["审批中", "待归档", "已驳回"] } },
    include: {
      actions: {
        include: {
          approver: { select: { realName: true } },
        },
        orderBy: { actedAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 过滤出当前用户需要审批的实例
  const pending = [];

  for (const inst of instances) {
    // 找到最后一轮的起始时间（最后一次 initiate 或 resubmit）
    const lastRoundStart = [...inst.actions]
      .reverse()
      .find((a) => a.action === "initiate" || a.action === "resubmit");

    // === 已驳回：只有发起人需要操作（重新提交）===
    if (inst.status === "已驳回") {
      const isInitiator = inst.actions.some(
        (a) => a.approverId === userId && (a.action === "initiate" || a.action === "resubmit")
      );
      if (!isInitiator) continue;

      const initiatorName = lastRoundStart?.approver?.realName || "未知";
      pending.push({
        id: inst.id,
        businessType: inst.businessType,
        businessId: inst.businessId,
        flowLevel: inst.flowLevel,
        currentNode: inst.currentNode,
        nodeName: "重新提交",
        nodeType: "resubmit" as const,
        createdAt: inst.createdAt,
        initiatorName,
        businessTitle: inst.businessTitle || "",
      });
      continue;
    }

    // === 审批中/待归档：审批人需要操作 ===
    // 获取当前节点的角色
    const flowNode = await prisma.approvalFlowDefinition.findFirst({
      where: {
        businessType: inst.businessType,
        flowLevel: inst.flowLevel,
        nodeOrder: inst.currentNode,
        isActive: true,
      },
    });

    if (!flowNode) continue;

    // 检查用户是否在本轮已有该节点的审批动作（避免重复审批）
    // 只看最后一轮（lastRoundStart 之后）的操作
    const lastRoundTime = lastRoundStart?.actedAt || new Date(0);
    const existingAction = inst.actions.find(
      (a) =>
        a.nodeId === inst.currentNode &&
        a.approverId === userId &&
        (a.actedAt ? new Date(a.actedAt) : new Date(0)) >= new Date(lastRoundTime)
    );
    if (existingAction) continue;

    // 检查用户角色是否匹配（支持多角色）
    const nodeRoles = flowNode.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
    const hasMatch = nodeRoles.some((r) => roleCodes.includes(r));
    if (hasMatch) {
      const initiatorName = lastRoundStart?.approver?.realName || "未知";
      pending.push({
        id: inst.id,
        businessType: inst.businessType,
        businessId: inst.businessId,
        flowLevel: inst.flowLevel,
        currentNode: inst.currentNode,
        nodeName: flowNode.nodeName,
        nodeType: flowNode.nodeType || "approval",
        createdAt: inst.createdAt,
        initiatorName,
        businessTitle: inst.businessTitle || "",
      });
    }
  }

  return pending;
}

// businessType（审批流用的模块标识）→ modulePermissions key（角色权限 JSON 的 key）
// 审批流 businessType 如 "supplier" 和 modulePermissions 的 key 如 "business" 不一致，需要映射
const BUSINESS_TYPE_TO_MODULE_KEY: Record<string, string> = {
  supplier: "business",
  supplier_change: "business",
  outsourcing: "projects",
  purchase_request: "procurement",
  inquiries: "procurement",
  delivery_receipt: "procurement",
  income_contract: "contracts",
  expense_contract: "contracts",
  inter_org_contract: "contracts",
  contract_change_order: "contracts",
  non_contract_expense: "finance",
  non_contract_income: "finance",
  payment_application: "finance",
  lending_out: "finance",
  expense_report: "finance",
  salary_payment: "finance",
  borrowing_return_application: "finance",
  other_borrowing: "finance",
};

// 检查用户是否有权限发起某个业务流程
// 发起权限（开始节点）= 角色 modulePermissions.create，不依赖审批第一节点角色
export async function canInitiateFlow(params: {
  businessType: string;
  flowLevel: string;
  userId: string;
}): Promise<boolean> {
  const { businessType, flowLevel, userId } = params;

  // 1. 必须有活跃的审批流定义
  const firstNode = await prisma.approvalFlowDefinition.findFirst({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });
  if (!firstNode) return false;

  // 2. 查询用户所有角色（含 modulePermissions JSON）
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true, modulePermissions: true } } },
  });

  // 3. 发起权限 = 角色对所属模块有 create 权限
  // modulePermissions key 是模块级（如 "business"），不是 businessType（如 "supplier"）
  const moduleKey = BUSINESS_TYPE_TO_MODULE_KEY[businessType] || businessType;
  const hasCreatePermission = userRoles.some((ur) => {
    try {
      const parsed = typeof ur.role.modulePermissions === "string"
        ? JSON.parse(ur.role.modulePermissions)
        : ur.role.modulePermissions;
      return parsed[moduleKey]?.create === true;
    } catch {
      return false;
    }
  });
  if (hasCreatePermission) return true;

  // 4. 兜底：审批流第一节点角色匹配（兼容未配置 modulePermissions 的情况）
  const roleCodes = firstNode.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
  if (roleCodes.length === 0) return true;

  const userRoleCodes = userRoles.map((ur) => ur.role.code);
  return roleCodes.some((rc) => userRoleCodes.includes(rc));
}

// 审批权限统一判断函数（后端驱动核心）
// 集中处理：角色匹配、轮次感知、发起人排除
export async function resolveUserApprovalCapabilities(params: {
  instanceId: string;
  userId: string;
  projectSourceId?: string;
}): Promise<{
  canApprove: boolean;
  canReject: boolean;
  canArchive: boolean;
  canPayment: boolean;
  isInitiator: boolean;
  hasActedThisRound: boolean;
}> {
  const { instanceId, userId, projectSourceId } = params;

  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
    include: {
      actions: {
        include: { approver: { select: { id: true, realName: true } } },
        orderBy: { actedAt: "asc" },
      },
    },
  });

  const noPermission = {
    canApprove: false, canReject: false, canArchive: false, canPayment: false,
    isInitiator: false, hasActedThisRound: false,
  };

  if (!instance) return noPermission;

  // 找到最后一轮起始（最后一次 initiate 或 resubmit）
  const lastRoundStart = [...instance.actions]
    .reverse()
    .find((a) => a.action === "initiate" || a.action === "resubmit");

  const isInitiator = lastRoundStart?.approverId === userId;

  // 非可操作状态 → 全部 false（但返回 isInitiator）
  if (!["审批中", "待归档"].includes(instance.status)) {
    return { ...noPermission, isInitiator };
  }

  // 发起人在普通审批节点上不能审批自己的申请，但在 payment/archive 节点上可以操作
  // （autoSkipInitiator 已确保 payment/archive 节点不自动跳过，发起人必须能操作）
  if (isInitiator) {
    const currentNodeDef = await prisma.approvalFlowDefinition.findFirst({
      where: {
        businessType: instance.businessType,
        flowLevel: instance.flowLevel,
        nodeOrder: instance.currentNode,
        isActive: true,
      },
    });
    if (currentNodeDef?.nodeType === "payment") {
      return { canApprove: false, canReject: false, canArchive: false, canPayment: true, isInitiator: true, hasActedThisRound: false };
    }
    if (currentNodeDef?.nodeType === "archive") {
      return { canApprove: false, canReject: false, canArchive: true, canPayment: false, isInitiator: true, hasActedThisRound: false };
    }
    return { ...noPermission, isInitiator: true };
  }

  // 获取当前节点定义
  const flowNode = await prisma.approvalFlowDefinition.findFirst({
    where: {
      businessType: instance.businessType,
      flowLevel: instance.flowLevel,
      nodeOrder: instance.currentNode,
      isActive: true,
    },
  });

  if (!flowNode) {
    return { ...noPermission, isInitiator };
  }

  // 检查本轮是否已操作（轮次感知）
  const lastRoundTime = lastRoundStart?.actedAt || new Date(0);
  const hasActedThisRound = instance.actions.some(
    (a) =>
      a.nodeId === instance.currentNode &&
      a.approverId === userId &&
      (a.action === "approve" || a.action === "reject") &&
      (a.actedAt ? new Date(a.actedAt) : new Date(0)) >= new Date(lastRoundTime)
  );

  if (hasActedThisRound) {
    return { ...noPermission, isInitiator, hasActedThisRound: true };
  }

  // 检查用户角色是否匹配当前节点
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true } } },
  });
  const roleCodes = userRoles.map((ur) => ur.role.code).filter((code) => code !== "admin");
  const nodeRoles = flowNode.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
  const hasRoleMatch = nodeRoles.some((r) => roleCodes.includes(r));

  if (!hasRoleMatch) {
    return { ...noPermission, isInitiator };
  }

  // 根据节点类型返回可用操作
  const isArchiveNode = flowNode.nodeType === "archive";
  const isPaymentNode = flowNode.nodeType === "payment";

  return {
    canApprove: !isArchiveNode && !isPaymentNode,
    canReject: !isArchiveNode && !isPaymentNode,
    canArchive: isArchiveNode,
    canPayment: isPaymentNode,
    isInitiator,
    hasActedThisRound: false,
  };
}

// 管理员强制推进：跳过当前会签节点，直接推进到下一节点
export async function forceAdvanceApproval(params: {
  instanceId: string;
  operatorId: string;
  comment?: string;
  projectSourceId?: string;
}): Promise<{
  status: string;
  currentNode: number;
  nextApproverIds?: string[];
}> {
  const { instanceId, operatorId, comment, projectSourceId } = params;

  const operator = await prisma.user.findUnique({
    where: { id: operatorId },
    include: {
      userRoles: {
        include: { role: { select: { code: true } } },
      },
    },
  });

  if (!operator) throw new Error("操作者不存在");
  const operatorRoleCodes = operator.userRoles.map((ur) => ur.role.code);
  if (!operatorRoleCodes.includes("admin")) {
    throw new Error("仅管理员可以强制推进审批");
  }

  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) throw new Error("审批实例不存在");
  if (instance.status !== "审批中" && instance.status !== "待归档") {
    throw new Error(`当前状态为"${instance.status}"，无法操作`);
  }

  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: {
      businessType: instance.businessType,
      flowLevel: instance.flowLevel,
      isActive: true,
    },
    orderBy: { nodeOrder: "asc" },
  });

  const currentNode = flowNodes.find((n) => n.nodeOrder === instance.currentNode);
  if (!currentNode) throw new Error("当前节点配置不存在");

  const currentIdx = flowNodes.findIndex((n) => n.nodeOrder === currentNode.nodeOrder);

  // 记录管理员强制推进动作
  await prisma.approvalAction.create({
    data: {
      instanceId,
      nodeId: currentNode.nodeOrder,
      nodeName: currentNode.nodeName,
      approverId: operatorId,
      action: "force_advance",
      comment: comment || "管理员强制推进",
      actedAt: new Date(),
    },
  });

  // 已是最后一个节点
  if (currentIdx >= flowNodes.length - 1) {
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "已批准", currentNode: currentNode.nodeOrder },
    });
    await updateBusinessStatus(instance.businessType, instance.businessId, "已批准");
    return { status: "已批准", currentNode: currentNode.nodeOrder };
  }

  // 推进到下一个节点
  const nextIdx = currentIdx + 1;
  const nextNode = flowNodes[nextIdx];

  if (nextNode.nodeType === "archive") {
    await updateBusinessStatus(instance.businessType, instance.businessId, "已批准");
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { currentNode: nextNode.nodeOrder, status: "审批中" },
    });
    const nextApproverIds = await resolveApproverIds(nextNode.approverRole, projectSourceId);
    return { status: "待归档", currentNode: nextNode.nodeOrder, nextApproverIds };
  }

  if (nextNode.nodeType === "payment") {
    await updateBusinessStatus(instance.businessType, instance.businessId, "已批准");
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { currentNode: nextNode.nodeOrder, status: "审批中" },
    });
    const nextApproverIds = await resolveApproverIds(nextNode.approverRole, projectSourceId);
    return { status: "待支付", currentNode: nextNode.nodeOrder, nextApproverIds };
  }

  const nextApproverIds = await resolveApproverIds(nextNode.approverRole, projectSourceId);
  await prisma.approvalInstance.update({
    where: { id: instanceId },
    data: { currentNode: nextNode.nodeOrder, status: "审批中" },
  });

  return { status: "审批中", currentNode: nextNode.nodeOrder, nextApproverIds };
}
