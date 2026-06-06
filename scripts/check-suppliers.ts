import prisma from "../src/lib/prisma";

(async () => {
  // 1. 查看所有供应商
  const all = await prisma.supplier.findMany({
    select: { id: true, name: true, isActive: true, approvalStatus: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`供应商总数: ${all.length}`);
  for (const s of all) {
    console.log(`  [${s.isActive ? "活跃" : "禁用"}] ${s.name} (status=${s.approvalStatus}, id=${s.id})`);
  }

  // 2. 看看有没有 isActive=false 的
  const inactive = all.filter(s => !s.isActive);
  console.log(`\n其中 isActive=false 的有 ${inactive.length} 条`);
  for (const s of inactive) {
    console.log(`  ${s.name} (id=${s.id})`);
  }

  await prisma.$disconnect();
})();
