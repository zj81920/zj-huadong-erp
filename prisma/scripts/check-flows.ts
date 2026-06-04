import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const flows = await prisma.approvalFlowDefinition.findMany({
    orderBy: { businessType: "asc" },
  });
  const existingRoles = await prisma.role.findMany();
  const existingCodes = new Set(existingRoles.map((r) => r.code));

  console.log(`审批流定义数: ${flows.length}`);
  console.log(`现有角色数: ${existingRoles.length}`);

  if (existingRoles.length === 0) {
    console.log("\n⚠️ 没有角色数据，所有审批流引用均无效。是否清除审批流数据？");
    // 询问或自动清理
  }

  let orphanCount = 0;
  for (const f of flows) {
    const roles = f.approverRole.split(",").map((s) => s.trim());
    for (const r of roles) {
      if (r && !existingCodes.has(r)) {
        console.log(`  ❌ ${f.businessType} / ${f.nodeName} → ${r}`);
        orphanCount++;
      }
    }
  }

  if (flows.length === 0) {
    console.log("\n✅ 审批流数据已为空，无需清理");
  } else if (orphanCount === 0 && existingRoles.length > 0) {
    console.log("\n✅ 所有审批流引用有效");
  } else {
    console.log(`\n⚠️ 共 ${orphanCount} 个无效角色引用`);
  }

  await prisma.$disconnect();
}

main();
