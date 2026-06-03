/**
 * 角色权限迁移脚本
 *
 * 将旧的 accessible_modules (字符串数组) 转换为 module_permissions (CRUD 对象)，
 * 将 sort 转换为 level。
 *
 * ⚠️ 重要：此脚本必须在 `prisma db push` 之前执行，
 * 因为 db push 会删除 accessible_modules 和 sort 列。
 * 如果 db push 已经执行，旧列数据已丢失，此脚本无法运行。
 *
 * 正确执行顺序：
 * 1. 先运行此迁移脚本（读取旧列，写入新列）
 * 2. 再执行 prisma db push（删除旧列）
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateRoles() {
  // Use raw query since the schema changed
  const roles: any[] = await prisma.$queryRaw`SELECT id, accessible_modules, sort FROM roles`;

  for (const role of roles) {
    // Parse old accessibleModules
    let oldModules: string[] = [];
    try {
      oldModules = JSON.parse(role.accessible_modules || "[]");
    } catch {
      oldModules = [];
    }

    // Convert to modulePermissions format
    const modulePermissions: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> = {};
    for (const modKey of oldModules) {
      modulePermissions[modKey] = { create: true, read: true, update: true, delete: true };
    }

    const level = role.sort || 0;

    await prisma.$executeRaw`
      UPDATE roles 
      SET module_permissions = ${JSON.stringify(modulePermissions)}, 
          sub_module_overrides = ${"{}"}, 
          level = ${level}
      WHERE id = ${role.id}
    `;
  }

  console.log(`Migrated ${roles.length} roles`);
}

migrateRoles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
