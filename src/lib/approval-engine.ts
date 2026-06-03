import prisma from "./prisma";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  quotation: "商务报价",
  supplier: "供应商审批",
  outsourcing: "外包任务",
  purchase_request: "采购需求",
  delivery_receipt: "到货验收",
  income_contract: "收入合同",
  expense_contract: "支出合同",
  non_contract_income: "非合同收入",
  non_contract_expense: "其他支付",
  payment_application: "合同支付",
  expense_report: "费用报销",
  other_borrowing: "其他借入款",
  lending_out: "借出款",
  salary_payment: "工资发放",
  borrowing_return_application: "借入资金归还",
};

function getBusinessTypeLabel(type: string): string {
  return BUSINESS_TYPE_LABELS[type] || type;
}

interface SplitStage {
  name: string;
  amount: number | string;
}

// 根据角色 code 解析实际审批人（支持逗号分隔的多角色）
// projectSourceId: 项目编号（用于项目级角色动态解析）
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

// 检查用户是否可以跳过某个节点（支持多角色）
export async function shouldSkipNode(
  roleCode: string,
  userId: string,
  projectSourceId?: string
): Promise<boolean> {
  if (!projectSourceId) return false;

  const roleCodes = roleCode.split(",").map((r) => r.trim()).filter(Boolean);
  for (const code of roleCodes) {
    if (code === "project_manager") {
      const ids = await resolveProjectManager(projectSourceId);
      if (ids.includes(userId)) return true;
    }
    if (code === "production") {
      const ids = await resolveDesignManager(projectSourceId);
      if (ids.includes(userId)) return true;
    }
  }

  return false;
}

// 创建审批实例：第一节点永远自动跳过（发起节点），从第二节点开始审批
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
  const { businessType, businessId, flowLevel, initiatorId, projectSourceId } = params;

  const flowNodes = await prisma.approvalFlowDefinition.findMany({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });

  if (flowNodes.length === 0) {
    throw new Error(`未找到 ${businessType}(${flowLevel}) 的审批流配置`);
  }

  const startNode = flowNodes[0];

  // 只有一个节点（发起节点），直接完成
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

    return { instanceId: instance.id, currentNode: startNode.nodeOrder, status: "已批准", approverIds: [] };
  }

  // 自动完成第一节点（发起），推进到第二个节点
  const nextNode = flowNodes[1];

  // 检查是否需要跳过后续节点（如项目经理自己发起）
  let actualNode = nextNode;
  let skipCount = 1;

  while (actualNode && (await shouldSkipNode(actualNode.approverRole, initiatorId, projectSourceId))) {
    skipCount++;
    if (skipCount >= flowNodes.length) break;
    actualNode = flowNodes[skipCount];
  }

  if (skipCount >= flowNodes.length) {
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

    return { instanceId: instance.id, currentNode: flowNodes[flowNodes.length - 1].nodeOrder, status: "已批准", approverIds: [] };
  }

  const approverIds = await resolveApproverIds(actualNode.approverRole, projectSourceId);

  const instance = await prisma.approvalInstance.create({
    data: {
      businessType,
      businessId,
      flowLevel,
      currentNode: actualNode.nodeOrder,
      status: "审批中",
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

  await updateBusinessStatus(businessType, businessId, "审批中", undefined, instance.id);

  return { instanceId: instance.id, currentNode: actualNode.nodeOrder, status: "审批中", approverIds };
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

  // 获取该实例上当前节点已有的审批动作
  const actions = await prisma.approvalAction.findMany({
    where: {
      instanceId,
      nodeId: nodeOrder,
      action: { in: ["approve", "initiate"] },
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
          title: `${getBusinessTypeLabel(instance.businessType)} 审批已完成`,
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
          title: `${getBusinessTypeLabel(instance.businessType)} 审批被驳回`,
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
      await updateBusinessStatus(instance.businessType, instance.businessId, "已批准", undefined, isFinanceApprove ? bankAccountId : undefined, isFinanceApprove ? paymentMethod : undefined);
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
      await updateBusinessStatus(instance.businessType, instance.businessId, "已批准", undefined, isFinanceApprove ? bankAccountId : undefined, isFinanceApprove ? paymentMethod : undefined);
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
          title: `${getBusinessTypeLabel(instance.businessType)} 待审批`,
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
      await updateBusinessStatus(instance.businessType, instance.businessId, "已批准", undefined, isFinanceApprove ? bankAccountId : undefined, isFinanceApprove ? paymentMethod : undefined);
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
          title: `${getBusinessTypeLabel(instance.businessType)} 待审批`,
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

  await prisma.approvalInstance.update({
    where: { id: instanceId },
    data: {
      currentNode: nextNode.nodeOrder,
      status: "审批中",
    },
  });

  // 通知下一节点审批人
  if (nextApproverIds && nextApproverIds.length > 0) {
    await prisma.notification.createMany({
      data: nextApproverIds.map((approverId) => ({
        userId: approverId,
        title: `${getBusinessTypeLabel(instance.businessType)} 待审批`,
        description: `${getBusinessTypeLabel(instance.businessType)} 流程已到达您这里，请及时处理`,
        type: "approval_pending",
        relatedId: instanceId,
      })),
    });
  }

  return {
    status: "审批中",
    currentNode: nextNode.nodeOrder,
    nextApproverIds,
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
    case "quotation": {
      const qt = await prisma.quotation.findUnique({ where: { id: businessId } });
      if (qt) {
        await prisma.quotation.update({ where: { id: businessId }, data: updateData });
      } else {
        await prisma.bidding.update({
          where: { id: businessId },
          data: { updatedAt: new Date() },
        });
      }
      break;
    }
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
    case "outsourcing": {
      const outsourceData: Record<string, unknown> = { approvalStatus: status };
      if (instanceId) outsourceData.approvalInstanceId = instanceId;
      await prisma.outsourcingTask.update({ where: { id: businessId }, data: outsourceData });
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
    case "non_contract_income":
      await prisma.nonContractIncome.update({ where: { id: businessId }, data: updateData });
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
    case "other_borrowing":
      await prisma.otherBorrowing.update({ where: { id: businessId }, data: updateData });
      break;
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
              await prisma.capitalContribution.update({
                where: { id: app.sourceId },
                data: {
                  returnedAmount: Number(contribution.returnedAmount) + Number(app.returnAmount),
                  remainingAmount: Number(contribution.remainingAmount) - Number(app.returnAmount),
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
              const newRemaining = Number(borrowing.remainingAmount) - Number(app.returnAmount);
              await prisma.otherBorrowing.update({
                where: { id: app.sourceId },
                data: {
                  returnedAmount: Number(borrowing.returnedAmount) + Number(app.returnAmount),
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
    case "delivery_receipt":
      await prisma.deliveryReceipt.update({ where: { id: businessId }, data: updateData });
      break;
  }
}

// 获取当前用户待审批的实例列表
export async function getPendingApprovals(userId: string) {
  // 获取用户角色
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true, isProjectRole: true } } },
  });

  const roleCodes = userRoles.map((ur) => ur.role.code).filter((code) => code !== "admin");

  // 获取所有审批中/待归档的实例
  const instances = await prisma.approvalInstance.findMany({
    where: { status: { in: ["审批中", "待归档"] } },
    include: {
      actions: {
        include: {
          approver: { select: { realName: true } },
        },
      },
    },
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

    // 检查用户角色是否匹配（支持多角色）
    const nodeRoles = flowNode.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
    const hasMatch = nodeRoles.some((r) => roleCodes.includes(r));
    if (hasMatch) {
      // 获取发起人姓名
      const initiateAction = inst.actions.find((a) => a.action === "initiate");
      const initiatorName = initiateAction?.approver?.realName || "未知";
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
      });
    }
  }

  return pending;
}

// 检查用户是否有权限发起某个业务流程
// 第一节点角色 = 发起权限控制
export async function canInitiateFlow(params: {
  businessType: string;
  flowLevel: string;
  userId: string;
}): Promise<boolean> {
  const { businessType, flowLevel, userId } = params;

  const firstNode = await prisma.approvalFlowDefinition.findFirst({
    where: { businessType, flowLevel, isActive: true },
    orderBy: { nodeOrder: "asc" },
  });

  if (!firstNode) return false;

  const roleCodes = firstNode.approverRole.split(",").map((r) => r.trim()).filter(Boolean);
  if (roleCodes.length === 0) return true;

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { code: true } } },
  });

  const userRoleCodes = userRoles.map((ur) => ur.role.code);
  return roleCodes.some((rc) => userRoleCodes.includes(rc));
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
