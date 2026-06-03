import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const nameToDefault = new Map<string, string>([
  ["出纳", "cashier"],
  ["副总经理", "vice_gm"],
  ["总经理", "gm"],
  ["生产经理", "production"],
  ["董事长", "chairman"],
  ["行政人事专员", "admin"],
  ["设计人员", "dept_head"],
]);

async function main() {
  // Get default role permissions
  const defaultRoles = await prisma.role.findMany({
    where: { code: { not: { startsWith: "role_" } } },
  });
  const defaultMap = new Map(
    defaultRoles.map((r) => [
      r.code,
      { modulePermissions: r.modulePermissions, isGlobalVisible: r.isGlobalVisible },
    ])
  );

  // Find orphaned roles with empty permissions
  const orphanRoles = await prisma.role.findMany({
    where: {
      code: { startsWith: "role_" },
      modulePermissions: "{}",
    },
  });
  console.log(`Found ${orphanRoles.length} orphaned roles with empty permissions`);

  let fixed = 0;
  for (const role of orphanRoles) {
    let defaultCode: string | null = null;
    for (const [name, code] of nameToDefault) {
      if (role.name.includes(name)) {
        defaultCode = code;
        break;
      }
    }

    if (defaultCode && defaultMap.has(defaultCode)) {
      const def = defaultMap.get(defaultCode)!;
      await prisma.role.update({
        where: { id: role.id },
        data: {
          modulePermissions: def.modulePermissions,
          isGlobalVisible: def.isGlobalVisible,
        },
      });
      console.log(`  Fixed: ${role.code} (${role.name}) → ${defaultCode}`);
      fixed++;
    } else {
      console.log(`  Skipped: ${role.code} (${role.name}) - no mapping found`);
    }
  }

  console.log(`\nFixed ${fixed} roles`);

  // Verify zhangjing's current permissions
  const user = await prisma.user.findUnique({
    where: { username: "zhangjing@hcec.group" },
    include: { userRoles: { include: { role: true } } },
  });

  if (user) {
    console.log(`\n张晶 (${user.realName}) current roles:`);
    for (const ur of user.userRoles) {
      const perms = JSON.parse(ur.role.modulePermissions || "{}");
      const modules = Object.keys(perms);
      console.log(
        `  ${ur.role.code} | ${ur.role.name} | ${modules.length} modules: ${modules.join(", ")}`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
