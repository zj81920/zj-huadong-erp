import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mapping from old role codes to default role codes
const OLD_TO_DEFAULT: Record<string, string> = {
  role_总经理_mptwtgkh: "gm",
  role_设计人员_mptzomgu: "dept_head",
  role_出纳_mptwreuw: "cashier",
  role_行政人事专员_mptzw869: "admin",
  role_副总经理_mptww86f: "vice_gm",
  role_生产经理_mptwyth2: "production",
  role_董事长_mptwu7rk: "chairman",
};

async function main() {
  console.log("=== 1. 替换审批流中的旧角色引用 ===");
  const flowDefs = await prisma.approvalFlowDefinition.findMany();
  let flowUpdated = 0;

  for (const def of flowDefs) {
    const roles = def.approverRole.split(",").map((s) => s.trim());
    let changed = false;
    const newRoles = roles.map((r) => {
      if (OLD_TO_DEFAULT[r]) {
        changed = true;
        return OLD_TO_DEFAULT[r];
      }
      return r;
    });

    if (changed) {
      await prisma.approvalFlowDefinition.update({
        where: { id: def.id },
        data: { approverRole: newRoles.join(", ") },
      });
      flowUpdated++;
      console.log(`  ${def.businessType} / ${def.nodeName}: ${roles.join(",")} → ${newRoles.join(",")}`);
    }
  }
  console.log(`  更新了 ${flowUpdated} 个审批流节点\n`);

  console.log("=== 2. 用户角色迁移 ===");
  // For each old role, find users and assign them the default role
  for (const [oldCode, defaultCode] of Object.entries(OLD_TO_DEFAULT)) {
    const defaultRole = await prisma.role.findUnique({ where: { code: defaultCode } });
    if (!defaultRole) {
      console.log(`  跳过: 默认角色 ${defaultCode} 不存在`);
      continue;
    }

    // Find users who have this old role
    const userRoles = await prisma.userRole.findMany({
      where: { roleId: (await prisma.role.findUnique({ where: { code: oldCode } }))!.id },
      include: { user: { select: { id: true, realName: true } } },
    });

    if (userRoles.length === 0) {
      console.log(`  ${oldCode}: 无用户分配，跳过`);
      continue;
    }

    for (const ur of userRoles) {
      // Check if user already has the default role
      const existing = await prisma.userRole.findFirst({
        where: { userId: ur.user.id, roleId: defaultRole.id },
      });

      if (!existing) {
        await prisma.userRole.create({
          data: { userId: ur.user.id, roleId: defaultRole.id },
        });
        console.log(`  ${ur.user.realName || ur.user.id}: ${oldCode} → +${defaultCode}`);
      } else {
        console.log(`  ${ur.user.realName || ur.user.id}: 已有 ${defaultCode}，跳过`);
      }
    }
  }

  // Also check system admin - ensure they have default roles for all old ones
  const sysAdmin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (sysAdmin) {
    const adminRoles = await prisma.userRole.findMany({
      where: { userId: sysAdmin.id },
    });
    const adminRoleIds = new Set(adminRoles.map((r) => r.roleId));

    // Ensure admin has all default roles
    for (const defaultCode of Object.values(OLD_TO_DEFAULT)) {
      const defaultRole = await prisma.role.findUnique({ where: { code: defaultCode } });
      if (defaultRole && !adminRoleIds.has(defaultRole.id)) {
        await prisma.userRole.create({
          data: { userId: sysAdmin.id, roleId: defaultRole.id },
        });
        console.log(`  系统管理员: +${defaultCode}`);
      }
    }
  }

  console.log("  用户角色迁移完成\n");

  console.log("=== 3. 删除旧角色 ===");
  for (const [oldCode] of Object.entries(OLD_TO_DEFAULT)) {
    const oldRole = await prisma.role.findUnique({ where: { code: oldCode } });
    if (!oldRole) {
      console.log(`  角色 ${oldCode} 已不存在，跳过`);
      continue;
    }

    // Delete user_role associations for this role
    const deleted = await prisma.userRole.deleteMany({
      where: { roleId: oldRole.id },
    });
    console.log(`  ${oldCode}: 删除了 ${deleted.count} 条用户关联`);

    // Delete the role itself
    await prisma.role.delete({ where: { id: oldRole.id } });
    console.log(`  ${oldCode}: 角色已删除`);
  }

  console.log("\n=== 清理完成 ===");

  // Verify
  const remaining = await prisma.role.findMany({ where: { code: { startsWith: "role_" } } });
  if (remaining.length === 0) {
    console.log("所有旧角色已清理完毕");
  } else {
    console.log(`警告: 还有 ${remaining.length} 个旧角色未清理`);
    for (const r of remaining) {
      console.log(`  ${r.code}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
