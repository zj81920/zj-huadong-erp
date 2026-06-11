import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * 检查当前用户是否有权限操作指定项目的 WBS
 * 通过条件（满足任一即可）：
 * 1. 用户是 admin
 * 2. 用户有 projects.plans 角色权限
 * 3. 用户是该项目的设计经理（designManagerId）
 * 4. 用户是该项目的主管领导（supervisorLeaderId）
 * 5. 用户是该项目的 WBS 节点负责人（responsibleIds）
 */
export async function canAccessProjectWbs(
  projectSourceId: string
): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  // admin 直接通过
  if (user.username === "admin") return true;

  const roleCodes = user.roles?.map((r) => r.code) || [];
  if (roleCodes.includes("admin")) return true;

  // 检查角色权限
  const hasRolePermission = checkRoleWbsPermission(user);
  if (hasRolePermission) return true;

  // 检查是否为该项目的设计经理或主管领导
  const project = await prisma.project.findUnique({
    where: { projectSourceId },
    select: { designManagerId: true, supervisorLeaderId: true },
  });

  if (!project) return false;

  if (project.designManagerId === user.id || project.supervisorLeaderId === user.id) {
    return true;
  }

  // 检查当前用户是否为该项目的任一 WBS 节点的负责人
  // responsibleIds 是 Json 类型（存储为 JSON 数组），使用 string_contains 过滤
  const isResponsible = await prisma.projectWbsNode.findFirst({
    where: {
      projectSourceId,
      responsibleIds: { string_contains: user.id },
    },
  });
  if (isResponsible) return true;

  return false;
}

function checkRoleWbsPermission(user: { roles: { modulePermissions: string }[] }): boolean {
  const roles = user?.roles || [];
  for (const role of roles) {
    try {
      const perms = typeof role.modulePermissions === "string"
        ? JSON.parse(role.modulePermissions)
        : role.modulePermissions || {};
      if (perms["projects.plans"]) return true;
      if (perms["projects"]?.read || perms["projects"]?.create) return true;
    } catch { /* ignore */ }
  }
  return false;
}
