import prisma from "../src/lib/prisma";

(async () => {
  console.log("=== 清理 isActive=false 的僵尸供应商 ===\n");

  const zombies = await prisma.supplier.findMany({
    where: { isActive: false },
    select: { id: true, name: true, approvalStatus: true },
  });
  console.log(`找到 ${zombies.length} 条僵尸供应商`);

  for (const z of zombies) {
    // 1. 先看有没有关联的 supplier_change
    const changes = await prisma.supplierChange.findMany({
      where: { supplierId: z.id },
      select: { id: true },
    });
    for (const c of changes) {
      // 清理变更单的审批数据
      const insts = await prisma.approvalInstance.findMany({
        where: { businessType: "supplier_change", businessId: c.id },
        select: { id: true },
      });
      for (const inst of insts) {
        await prisma.approvalAction.deleteMany({ where: { instanceId: inst.id } });
        await prisma.notification.deleteMany({ where: { relatedId: inst.id } });
        await prisma.approvalInstance.delete({ where: { id: inst.id } });
      }
      await prisma.supplierChange.delete({ where: { id: c.id } });
      console.log(`  ✓ 清理变更单 ${c.id}（${insts.length} 个审批实例）`);
    }

    // 2. 清理供应商本身的审批数据
    const supplierInsts = await prisma.approvalInstance.findMany({
      where: { businessType: "supplier", businessId: z.id },
      select: { id: true },
    });
    for (const inst of supplierInsts) {
      await prisma.approvalAction.deleteMany({ where: { instanceId: inst.id } });
      await prisma.notification.deleteMany({ where: { relatedId: inst.id } });
      await prisma.approvalInstance.delete({ where: { id: inst.id } });
    }
    console.log(`  ✓ 清理供应商审批（${supplierInsts.length} 个实例）`);

    // 3. 物理删除供应商
    await prisma.supplier.delete({ where: { id: z.id } });
    console.log(`  ✓ 物理删除供应商: ${z.name} (${z.id})\n`);
  }

  // 验证
  const remaining = await prisma.supplier.count();
  console.log(`清理完成。剩余供应商总数: ${remaining}`);
  await prisma.$disconnect();
})();
