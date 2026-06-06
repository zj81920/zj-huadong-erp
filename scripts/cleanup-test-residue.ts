import prisma from "../src/lib/prisma";
import { cleanupBusinessApprovalRecords } from "../src/lib/approval-cleanup";

(async () => {
  console.log("=== 清理本次验证遗留的测试数据 ===\n");

  // 找出由本次脚本残留的测试数据：name = "清理验证专用供应商"
  const changes = await prisma.supplierChange.findMany({
    where: { name: "清理验证专用供应商" },
    select: { id: true, supplierId: true, name: true },
  });
  console.log(`找到残留变更单 ${changes.length} 条`);

  for (const c of changes) {
    await cleanupBusinessApprovalRecords("supplier_change", c.id);
    await prisma.supplierChange.delete({ where: { id: c.id } });
    console.log(`  ✓ 已物理删除变更单 ${c.id}`);
  }

  const suppliers = await prisma.supplier.findMany({
    where: { name: "清理验证专用供应商" },
    select: { id: true, name: true },
  });
  console.log(`\n找到残留供应商 ${suppliers.length} 条`);

  for (const s of suppliers) {
    await cleanupBusinessApprovalRecords("supplier", s.id);
    await prisma.supplier.delete({ where: { id: s.id } });
    console.log(`  ✓ 已物理删除供应商 ${s.id}`);
  }

  // 清理 e2e-test-user 如果存在
  const userExist = await prisma.user.count({ where: { id: "e2e-test-user" } });
  if (userExist > 0) {
    await prisma.user.delete({ where: { id: "e2e-test-user" } });
    console.log(`\n  ✓ 已删除 e2e-test-user`);
  }

  console.log("\n清理完成。");
  await prisma.$disconnect();
})();
