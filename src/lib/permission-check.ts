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

  const perms = subModuleKey
    ? (modulePermissions[subModuleKey] || modulePermissions[moduleKey] || { create: false, read: false, update: false, delete: false })
    : (modulePermissions[moduleKey] || { create: false, read: false, update: false, delete: false })

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

/**
 * 从 CurrentUser 对象中提取模块的 CRUD 权限（前端使用）
 */
export function getUserModulePerms(
  user: CurrentUser | null,
  moduleKey: string
): CrudPermissions {
  if (!user) return { create: false, read: false, update: false, delete: false }

  // admin 角色拥有所有权限
  const roleCodes = user.roles.map(r => r.code)
  if (roleCodes.includes("admin") || user.username === "admin") {
    return { create: true, read: true, update: true, delete: true }
  }

  const perms: CrudPermissions = { create: false, read: false, update: false, delete: false }
  for (const role of user.roles) {
    try {
      const parsed = typeof role.modulePermissions === "string"
        ? JSON.parse(role.modulePermissions)
        : role.modulePermissions
      const modulePerms = parsed[moduleKey]
      if (modulePerms) {
        if (modulePerms.create) perms.create = true
        if (modulePerms.read) perms.read = true
        if (modulePerms.update) perms.update = true
        if (modulePerms.delete) perms.delete = true
      }
    } catch {
      // 忽略
    }
  }
  return perms
}
