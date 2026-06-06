import prisma from "../src/lib/prisma";

(async () => {
  const changes = await prisma.supplierChange.findMany({
    select: { id: true, name: true, approvalStatus: true, createdAt: true }
  });
  console.log(`=== supplier_changes 业务表 (${changes.length} 条) ===`);
  changes.forEach((c) => console.log(JSON.stringify(c)));

  const insts = await prisma.approvalInstance.findMany({
    where: { businessType: "supplier_change" },
    select: { id: true, businessId: true, status: true, currentNode: true, createdAt: true }
  });
  console.log(`\n=== approval_instances (businessType=supplier_change) (${insts.length} 条) ===`);
  insts.forEach((i) => console.log(JSON.stringify(i)));

  const changeIds = new Set(changes.map((c) => c.id));
  const orphaned = insts.filter((i) => !changeIds.has(i.businessId));
  console.log(`\n=== 孤儿 instance（businessId 在业务表已不存在） (${orphaned.length} 条) ===`);
  orphaned.forEach((i) => console.log(JSON.stringify(i)));

  const active = await prisma.approvalInstance.findMany({
    where: { businessType: "supplier_change", status: "审批中" },
    select: { id: true, businessId: true }
  });
  console.log(`\n=== supplier_change 审批中实例 (${active.length} 条) ===`);
  active.forEach((i) => console.log(JSON.stringify(i)));

  await prisma.$disconnect();
})();
