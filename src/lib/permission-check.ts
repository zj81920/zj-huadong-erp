/**
 * 权限校验辅助函数
 * 封装获取当前用户权限 + canDelete/canEdit/canReadAll 的完整流程
 */
import { getCurrentUser, isAdmin, type CurrentUser } from "@/lib/auth"
import {
  resolveSubModulePermission,
  hasApprovalFlow,
  canDelete as _canDelete,
  canEdit as _canEdit,
  canReadAll as _canReadAll,
  type CrudPermissions,
} from "@/lib/types/permissions"
import { API_TO_SUB_MODULE, SUB_MODULE_MAP, type SubModuleKey } from "@/lib/module-permissions"

export interface PermissionResult {
  userId: string
  isAdmin: boolean
  perms: CrudPermissions
}

/**
 * 解析当前用户对指定模块的 CRUD 权限
 * admin 用户直接返回全部权限
 */
export async function resolveCurrentUserPermission(
  moduleKey: string,
  subModuleKey?: string
): Promise<PermissionResult | null> {
  const user = await getCurrentUser()
  if (!user) return null

  if (isAdmin(user)) {
    return {
      userId: user.id,
      isAdmin: true,
      perms: { create: true, read: true, update: true, delete: true },
    }
  }

  // 合并所有角色的模块权限
  const modulePermissions: Record<string, CrudPermissions> = {}
  for (const role of user.roles) {
    try {
      const parsed = typeof role.modulePermissions === "string"
        ? JSON.parse(role.modulePermissions)
        : role.modulePermissions
      for (const [key, value] of Object.entries(parsed)) {
        if (!modulePermissions[key]) {
          modulePermissions[key] = { create: false, read: false, update: false, delete: false }
        }
        const v = value as Partial<CrudPermissions>
        if (v.create) modulePermissions[key].create = true
        if (v.read) modulePermissions[key].read = true
        if (v.update) modulePermissions[key].update = true
        if (v.delete) modulePermissions[key].delete = true
      }
    } catch {
      // 忽略解析错误
    }
  }

  // 尝试将 API key 映射到子模块 key（支持多层嵌套向上查找）
  const mappedSubKey = API_TO_SUB_MODULE[moduleKey] as SubModuleKey | undefined;

  let perms: CrudPermissions | undefined;
  if (subModuleKey) {
    // 显式指定子模块 key
    perms = modulePermissions[subModuleKey] || modulePermissions[moduleKey];
  } else if (mappedSubKey) {
    // 从子模块 key 开始，逐级向上查找祖先模块
    let currentKey: string | undefined = mappedSubKey;
    while (currentKey && !perms) {
      perms = modulePermissions[currentKey];
      if (!perms) {
        currentKey = SUB_MODULE_MAP[currentKey as SubModuleKey]?.parent as string | undefined;
      }
    }
    // 最终 fallback 到原始 moduleKey
    if (!perms) {
      perms = modulePermissions[moduleKey];
    }
  } else {
    perms = modulePermissions[moduleKey];
  }

  if (!perms) {
    perms = { create: false, read: false, update: false, delete: false };
  }

  return { userId: user.id, isAdmin: false, perms }
}

/**
 * 完整的删除权限校验
 */
export async function checkDeletePermission(
  moduleKey: string,
  subModuleKey: string | undefined,
  recordStatus: string,
  recordCreatorId: string | null
): Promise<{ allowed: boolean; error?: string; permResult?: PermissionResult }> {
  const permResult = await resolveCurrentUserPermission(moduleKey, subModuleKey)
  if (!permResult) return { allowed: false, error: "未登录" }

  if (permResult.isAdmin) return { allowed: true, permResult }

  const allowed = await _canDelete(permResult.perms, moduleKey, recordStatus, permResult.userId, recordCreatorId)
  if (!allowed) {
    return { allowed: false, error: "无权删除该记录", permResult }
  }
  return { allowed: true, permResult }
}

/**
 * 完整的编辑权限校验
 */
export async function checkEditPermission(
  moduleKey: string,
  subModuleKey: string | undefined,
  recordStatus: string,
  recordCreatorId: string | null
): Promise<{ allowed: boolean; error?: string; permResult?: PermissionResult }> {
  const permResult = await resolveCurrentUserPermission(moduleKey, subModuleKey)
  if (!permResult) return { allowed: false, error: "未登录" }

  if (permResult.isAdmin) return { allowed: true, permResult }

  const allowed = await _canEdit(permResult.perms, moduleKey, recordStatus, permResult.userId, recordCreatorId)
  if (!allowed) {
    return { allowed: false, error: "无权编辑该记录", permResult }
  }
  return { allowed: true, permResult }
}

/**
 * 完整的读取权限校验 — 是否能查看全局记录
 */
export async function checkReadPermission(
  moduleKey: string,
  subModuleKey?: string
): Promise<{ canReadAll: boolean; userId: string; permResult: PermissionResult }> {
  const permResult = await resolveCurrentUserPermission(moduleKey, subModuleKey)
  if (!permResult) return { canReadAll: false, userId: "", permResult: { userId: "", isAdmin: false, perms: { create: false, read: false, update: false, delete: false } } }

  if (permResult.isAdmin) return { canReadAll: true, userId: permResult.userId, permResult }

  return { canReadAll: _canReadAll(permResult.perms), userId: permResult.userId, permResult }
}

// getUserModulePerms 已统一到 @/lib/types/permissions.ts，通过 re-export 保持向后兼容
export { getUserModulePerms } from "@/lib/types/permissions"
