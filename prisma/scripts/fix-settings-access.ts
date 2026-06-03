import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 需要修正的字段逻辑:
  // 1. 所有角色的 modulePermissions 中移除 settings
  // 2. isGlobalVisible 全部设为 false (只有 admin 账号特殊处理)

  const allRoles = await prisma.role.findMany();

  let fixed = 0;
  for (const role of allRoles) {
    const perms = JSON.parse(role.modulePermissions || "{}");

    // 需要更新的标志
    let needsUpdate = false;

    // 1. 移除 settings 权限
    if (perms.settings) {
      delete perms.settings;
      needsUpdate = true;
    }

    // 2. 清理子模块覆写中的 settings
    const overrides = JSON.parse(role.subModuleOverrides || "{}");
    for (const key of Object.keys(overrides)) {
      if (key.startsWith("settings")) {
        delete overrides[key];
        needsUpdate = true;
      }
    }

    // 3. isGlobalVisible 全部改为 false
    if (role.isGlobalVisible) {
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          modulePermissions: JSON.stringify(perms),
          subModuleOverrides: JSON.stringify(overrides),
          isGlobalVisible: false,
        },
      });
      console.log(`Fixed: ${role.code} (${role.name})`);
      fixed++;
    }
  }

  console.log(`\nFixed ${fixed} roles`);

  // 验证
  const rolesAfter = await prisma.role.findMany({ orderBy: { code: "asc" } });
  console.log("\n=== 最终状态 ===");
  for (const r of rolesAfter) {
    const perms = JSON.parse(r.modulePermissions || "{}");
    const mods = Object.keys(perms);
    console.log(
      `${r.code.padEnd(30)} ${r.name.padEnd(12)} global:${r.isGlobalVisible} | ${mods.length} modules: ${mods.join(", ")}`
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
