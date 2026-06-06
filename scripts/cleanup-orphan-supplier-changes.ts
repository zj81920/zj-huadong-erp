import prisma from "../src/lib/prisma";
import { cleanupBusinessApprovalRecords } from "../src/lib/approval-cleanup";

(async () => {
  // 当前数据库里的 3 个供应商变更
  const changes = await prisma.supplierChange.findMany({ select: { id: true, name: true } });
  console.log(`=== 准备清理 ${changes.length} 条供应商变更及其审批数据 ===`);

  for (const c of changes) {
    console.log(`\n清理 ${c.name} (${c.id})...`);
    await cleanupBusinessApprovalRecords("supplier_change", c.id);
    await prisma.supplierChange.delete({ where: { id: c.id } });
    console.log(`✓ 已物理删除`);
  }

  console.log(`\n=== 清理完成 ===`);
  const remainInst = await prisma.approvalInstance.count({ where: { businessType: "supplier_change" } });
  const remainChange = await prisma.supplierChange.count();
  console.log(`剩余审批实例: ${remainInst}, 剩余变更单: ${remainChange}`);

  await prisma.$disconnect();
})();
