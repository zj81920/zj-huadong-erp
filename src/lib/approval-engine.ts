import prisma from "./prisma";

// 根据角色 code 解析实际审批人
// projectSourceId: 项目编号（用于项目级角色动态解析）
export async function resolveApproverIds(
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
    // 项目级角色：从项目信息中动态解析
    if (roleCode === "project_manager" && projectSourceId) {
      return await resolveProjectManager(projectSourceId);
    }
    if (roleCode === "production" && projectSourceId) {
      return await resolveDesignManager(projectSourceId);
    }
    return [];
  }

  if (role.isProjectRole && projectSourceId) {
    if (roleCode === "project_manager") {
      return await resolveProjectManager(projectSourceId);
    }
    if (roleCode === "production") {
      return await resolveDesignManager(projectSourceId);
    }
  }

  return role.users.map((ur) => ur.user.id);
}

async function resolveProjectManager(
  projectSourceId: string
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { projectSourceId },
    select: { designManagerId: true },
  });
  return project?.designManagerId ? [project.designManagerId] : [];
}

async function resolveDesignManager(
  projectSourceId: string
): Promise<string[]> {
  const project = await prisma.project.findUnique({
    where: { projectSourceId },
    select: { supervisorLeaderId: true },
  });
  return project?.supervisorLeaderId ? [project.supervisorLeaderId] : [];
}

// 检查用户是否可以跳过某个节点（比如项目经理自己发起的报销，跳过项目经理审批）
export async function shouldSkipNode(
  roleCode: string,
  userId: string,
  projectSourceId?: string
): Promise<boolean> {
  if (!projectSourceId) return false;

  if (roleCode === "project_manager") {
    const ids = await resolveProjectManager(projectSourceId);
    return ids.includes(userId);
  }
  if (roleCode === "production") {
    const ids = await resolveDesignManager(projectSourceId);
    return ids.includes(userId);
  }

  return false;
}

// 创建审批实例并推进到第一个需要审批的节点
export async function startApprovalFlow(params: {
  businessType: string;
  businessId: string;
  flowLevel: string;
  initiatorId: string;
  projectSourceId?: string;
}): Promise<{
  instanceId: string;
  currentNode: number;
  status: string;
  approverIds: string[];
}> {
  const { businessType, businessId, flowLevel, initiatorId, projectSourceId } =
    params;

  // 获取审批流定义
  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });

  if (flowNodes.length === 0) {
    throw new Error(`未找到 ${businessType}(${flowLevel}) 的审批流配置`);
  }

  // 第一个节点通常是"发起"，检查是否需要跳过
  let startNode = flowNodes[0];
  let skipInitiator = startNode.approverRole === "initiator";

  // 找到第一个实际需要审批的节点
  let currentNodeOrder = startNode.nodeOrder;

  if (skipInitiator) {
    // 自动完成"发起"节点
    // 如果只有一个节点（发起），直接完成
    if (flowNodes.length === 1) {
      const instance = await prisma.approvalInstance.create({
        data: {
          businessType,
          businessId,
          flowLevel,
          currentNode: startNode.nodeOrder,
          status: "已批准",
        },
      });

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

      return {
        instanceId: instance.id,
        currentNode: startNode.nodeOrder,
        status: "已批准",
        approverIds: [],
      };
    }

    // 记录发起动作，推进到下一节点
    const nextNode = flowNodes[1];
    currentNodeOrder = nextNode.nodeOrder;

    // 检查是否需要跳过下一节点（如项目经理自己发起）
    let actualNode = nextNode;
    let skipCount = 1;

    while (actualNode && (await shouldSkipNode(actualNode.approverRole, initiatorId, projectSourceId))) {
      skipCount++;
      if (skipCount >= flowNodes.length) break;
      actualNode = flowNodes[skipCount];
    }

    if (skipCount >= flowNodes.length) {
      // 所有节点都跳过了，直接完成
      const instance = await prisma.approvalInstance.create({
        data: {
          businessType,
          businessId,
          flowLevel,
          currentNode: flowNodes[flowNodes.length - 1].nodeOrder,
          status: "已批准",
        },
      });

      for (let i = 0; i < flowNodes.length; i++) {
        await prisma.approvalAction.create({
          data: {
            instanceId: instance.id,
            nodeId: flowNodes[i].nodeOrder,
            nodeName: flowNodes[i].nodeName,
            approverId: i === 0 ? initiatorId : "system",
            action: i === 0 ? "initiate" : "auto_skip",
            actedAt: new Date(),
          },
        });
      }

      return {
        instanceId: instance.id,
        currentNode: flowNodes[flowNodes.length - 1].nodeOrder,
        status: "已批准",
        approverIds: [],
      };
    }

    currentNodeOrder = actualNode.nodeOrder;
    const approverIds = await resolveApproverIds(actualNode.approverRole, projectSourceId);

    const instance = await prisma.approvalInstance.create({
      data: {
        businessType,
        businessId,
        flowLevel,
        currentNode: currentNodeOrder,
        status: "审批中",
      },
    });

    // 记录发起动作
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

    // 记录跳过的节点
    for (let i = 1; i < skipCount; i++) {
      await prisma.approvalAction.create({
        data: {
          instanceId: instance.id,
          nodeId: flowNodes[i].nodeOrder,
          nodeName: flowNodes[i].nodeName,
          approverId: "system",
          action: "auto_skip",
          actedAt: new Date(),
        },
      });
    }

    return {
      instanceId: instance.id,
      currentNode: currentNodeOrder,
      status: "审批中",
      approverIds,
    };
  }

  // 第一个节点不是发起，直接从第一个节点开始
  const approverIds = await resolveApproverIds(startNode.approverRole, projectSourceId);

  const instance = await prisma.approvalInstance.create({
    data: {
      businessType,
      businessId,
      flowLevel,
      currentNode: startNode.nodeOrder,
      status: "审批中",
    },
  });

  return {
    instanceId: instance.id,
    currentNode: startNode.nodeOrder,
    status: "审批中",
    approverIds,
  };
}

// 审批动作：通过/驳回
export async function processApprovalAction(params: {
  instanceId: string;
  approverId: string;
  action: "approve" | "reject";
  comment?: string;
  projectSourceId?: string;
}): Promise<{
  status: string;
  currentNode: number;
  nextApproverIds?: string[];
}> {
  const { instanceId, approverId, action, comment, projectSourceId } = params;

  const instance = await prisma.approvalInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error("审批实例不存在");
  }

  if (instance.status !== "审批中") {
    throw new Error(`当前状态为"${instance.status}"，无法操作`);
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
    },
  });

  // 驳回
  if (action === "reject") {
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "已驳回", currentNode: currentNode.nodeOrder },
    });
    return { status: "已驳回", currentNode: currentNode.nodeOrder };
  }

  // 通过 - 推进到下一个节点
  const currentIdx = flowNodes.findIndex(
    (n) => n.nodeOrder === currentNode.nodeOrder
  );

  if (currentIdx >= flowNodes.length - 1) {
    // 已是最后一个节点，审批完成
    await prisma.approvalInstance.update({
      where: { id: instanceId },
      data: { status: "已批准", currentNode: currentNode.nodeOrder },
    });
    return { status: "已批准", currentNode: currentNode.nodeOrder };
  }

  // 查找下一个需要审批的节点
  let nextIdx = currentIdx + 1;
  let nextNode = flowNodes[nextIdx];

  // 检查是否需要跳过下一个节点（如果审批人恰好是下一个节点的角色）
  // 此处不跳过，只跳过发起人的角色节点
  const nextApproverIds = await resolveApproverIds(
    nextNode.approverRole,
    projectSourceId
  );

  await prisma.approvalInstance.update({
    where: { id: instanceId },
    data: {
      currentNode: nextNode.nodeOrder,
      status: "审批中",
    },
  });

  return {
    status: "审批中",
    currentNode: nextNode.nodeOrder,
    nextApproverIds,
  };
}

// 获取当前用户待审批的实例列表
export async function getPendingApprovals(userId: string) {
  // 获取用户角色
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true, isProjectRole: true } } },
  });

  const roleCodes = userRoles.map((ur) => ur.role.code);

  // 获取所有审批中的实例
  const instances = await prisma.approvalInstance.findMany({
    where: { status: "审批中" },
    include: { actions: true },
    orderBy: { createdAt: "desc" },
  });

  // 过滤出当前用户需要审批的实例
  const pending = [];

  for (const inst of instances) {
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

    // 检查用户是否已有该节点的审批动作（避免重复审批）
    const existingAction = inst.actions.find(
      (a) =>
        a.nodeId === inst.currentNode &&
        a.approverId === userId &&
        a.action !== "auto_skip"
    );
    if (existingAction) continue;

    // 检查用户角色是否匹配
    if (roleCodes.includes(flowNode.approverRole)) {
      pending.push({
        id: inst.id,
        businessType: inst.businessType,
        businessId: inst.businessId,
        flowLevel: inst.flowLevel,
        currentNode: inst.currentNode,
        nodeName: flowNode.nodeName,
        createdAt: inst.createdAt,
      });
    }
  }

  return pending;
}
