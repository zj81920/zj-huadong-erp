import prisma from "./prisma";

/**
 * 清理某个业务相关的全部审批与通知记录（物理删除，含历史）
 * @param businessType 业务类型，如 "supplier_change"
 * @param businessId 业务 ID
 */
export async function cleanupBusinessApprovalRecords(
  businessType: string,
  businessId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. 查出全部相关 instance
    const instances = await tx.approvalInstance.findMany({
      where: { businessType, businessId },
      select: { id: true },
    });
    const instanceIds = instances.map((i) => i.id);

    if (instanceIds.length > 0) {
      // 2. 删除全部 action
      await tx.approvalAction.deleteMany({
        where: { instanceId: { in: instanceIds } },
      });

      // 3. 删除以 instance.id 为 relatedId 的通知
      await tx.notification.deleteMany({
        where: { relatedId: { in: instanceIds } },
      });

      // 4. 删除 instance
      await tx.approvalInstance.deleteMany({
        where: { id: { in: instanceIds } },
      });
    }

    // 5. 兜底删除以 business.id 为 relatedId 的通知
    await tx.notification.deleteMany({
      where: { relatedId: businessId },
    });
  });
}
