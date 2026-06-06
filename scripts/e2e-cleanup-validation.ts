import prisma from "../src/lib/prisma";
import { cleanupBusinessApprovalRecords } from "../src/lib/approval-cleanup";

(async () => {
  console.log("=== 端到端验证：删除供应商 → 级联清理审批及通知 ===\n");

  // 0. 先创建一个测试用户（approverId 外键）
  console.log("0. 创建测试用户...");
  const testUser = await prisma.user.upsert({
    where: { id: "e2e-test-user" },
    update: {},
    create: {
      id: "e2e-test-user",
      username: "e2e-test-user",
      realName: "E2E测试用户",
      password: "password123",
      role: "staff",
    },
  });
  console.log(`   测试用户 id=${testUser.id}`);

  // 1. 创建一个测试供应商
  console.log("\n1. 创建测试供应商...");
  const uniqueName = `E2E清理验证供应商_${Date.now()}`;
  const supplier = await prisma.supplier.create({
    data: {
      name: uniqueName,
      supplierType: "企业",
      status: "正常合作",
      contactPerson: "张三",
      phone: "13800138000",
      email: "test@example.com",
      approvalStatus: "草稿",
      createdById: "e2e-test-user",
    },
  });
  console.log(`   已创建供应商 id=${supplier.id}`);

  // 2. 创建一个供应商变更单
  console.log("\n2. 创建供应商变更单...");
  const supplierChange = await prisma.supplierChange.create({
    data: {
      supplierId: supplier.id,
      name: uniqueName,
      supplierType: "企业",
      status: "正常合作",
      contactPerson: "张三",
      phone: "13800138000",
      email: "test@example.com",
      approvalStatus: "审批中",
      createdById: "e2e-test-user",
    },
  });
  console.log(`   已创建变更单 id=${supplierChange.id}`);

  // 3. 为变更单创建审批实例
  console.log("\n3. 为变更单创建审批实例...");
  const inst = await prisma.approvalInstance.create({
    data: {
      businessType: "supplier_change",
      businessId: supplierChange.id,
      status: "审批中",
      currentNode: 1,
      flowLevel: "common",
    },
  });
  console.log(`   已创建审批实例 id=${inst.id}`);

  // 4. 为审批实例加一个动作
  await prisma.approvalAction.create({
    data: {
      instanceId: inst.id,
      nodeId: 1,
      nodeName: "节点1",
      approverId: "e2e-test-user",
      action: "initiate",
      actedAt: new Date(),
    },
  });

  // 5. 创建一条相关通知
  await prisma.notification.create({
    data: {
      userId: "e2e-test-user",
      title: "审批待办通知",
      description: "您有一个新的审批待办",
      type: "approval_pending",
      relatedId: inst.id,
    },
  });

  // 验证创建结果
  const count1 = await prisma.approvalInstance.count({
    where: { businessType: "supplier_change", businessId: supplierChange.id },
  });
  const count2 = await prisma.approvalAction.count({ where: { instanceId: inst.id } });
  const count3 = await prisma.notification.count({ where: { relatedId: inst.id } });
  console.log(`   审批实例数: ${count1}, 动作数: ${count2}, 通知数: ${count3}`);

  if (count1 !== 1 || count2 !== 1 || count3 !== 1) {
    console.error("\n✗ 数据创建失败，提前终止");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 6. 调用清理函数（模拟供应商 DELETE 路由中的逻辑）
  console.log("\n4. 调用 cleanupBusinessApprovalRecords 清理供应商变更的审批数据...");
  await cleanupBusinessApprovalRecords("supplier_change", supplierChange.id);

  // 7. 验证结果
  const count1After = await prisma.approvalInstance.count({
    where: { businessType: "supplier_change", businessId: supplierChange.id },
  });
  const count2After = await prisma.approvalAction.count({ where: { instanceId: inst.id } });
  const count3After = await prisma.notification.count({ where: { relatedId: inst.id } });
  const count4After = await prisma.supplierChange.count({ where: { id: supplierChange.id } });

  console.log(`\n   清理后审批实例数: ${count1After} (期望 0)`);
  console.log(`   清理后审批动作数: ${count2After} (期望 0)`);
  console.log(`   清理后通知数: ${count3After} (期望 0)`);
  console.log(`   供应商变更单仍存在: ${count4After === 1 ? "是" : "否"}`);

  if (count1After === 0 && count2After === 0 && count3After === 0 && count4After === 1) {
    console.log("\n✓ 级联清理逻辑正确！审批实例、动作、通知都被物理删除，业务记录保留（删除逻辑在 cleanup 之后执行）");
  } else {
    console.error("\n✗ 清理失败！");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 8. 再执行删除供应商变更单本身
  console.log("\n5. 删除供应商变更单本身...");
  await prisma.supplierChange.delete({ where: { id: supplierChange.id } });

  // 9. 删除供应商本身（模拟 DELETE /api/suppliers/:id 路由）
  console.log("\n6. 删除供应商本身...");
  await cleanupBusinessApprovalRecords("supplier", supplier.id);
  await prisma.supplier.delete({ where: { id: supplier.id } });

  const supplierCount = await prisma.supplier.count({ where: { id: supplier.id } });
  console.log(`   删除后供应商数: ${supplierCount} (期望 0)`);

  if (supplierCount === 0) {
    console.log("\n✓ 供应商物理删除成功！");
    console.log("\n======== 全部验证通过 ========\n");
  } else {
    console.error("\n✗ 供应商删除失败！");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 清理测试用户
  await prisma.user.delete({ where: { id: "e2e-test-user" } });
  await prisma.$disconnect();
})();
