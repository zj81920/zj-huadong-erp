import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all orphaned roles
  const orphanRoles = await prisma.role.findMany({
    where: { code: { startsWith: "role_" } },
  });
  const orphanCodes = orphanRoles.map((r) => r.code);
  console.log(`旧角色数量: ${orphanCodes.length}`);

  // Check if any approval flow definitions reference them
  const flowDefs = await prisma.approvalFlowDefinition.findMany();
  const flowRefs: { businessType: string; nodeName: string; roleCode: string }[] = [];
  for (const def of flowDefs) {
    const roles = def.approverRole.split(",").map((s) => s.trim());
    for (const oc of orphanCodes) {
      if (roles.includes(oc)) {
        flowRefs.push({ businessType: def.businessType, nodeName: def.nodeName, roleCode: oc });
      }
    }
  }

  console.log(`\n审批流中引用旧角色: ${flowRefs.length > 0 ? "是" : "否"}`);
  for (const ref of flowRefs) {
    console.log(`  ${ref.businessType} / ${ref.nodeName} → ${ref.roleCode}`);
  }

  // Show each user's role breakdown
  const users = await prisma.user.findMany({
    include: { userRoles: { include: { role: true } } },
  });

  console.log("\n各用户角色分配:");
  for (const u of users) {
    const oldRoles = u.userRoles
      .filter((ur) => ur.role.code.startsWith("role_"))
      .map((ur) => ur.role.code.split("_")[1]);
    const newRoles = u.userRoles
      .filter((ur) => !ur.role.code.startsWith("role_") && ur.role.code !== "admin")
      .map((ur) => `${ur.role.code}(${ur.role.name})`);
    console.log(`${u.realName.padEnd(6)} | 旧: ${oldRoles.join(",").padEnd(12)} | 新: ${newRoles.join(", ")}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
