// CRUD 操作权限
import { API_TO_SUB_MODULE, SUB_MODULE_MAP, type SubModuleKey } from "@/lib/module-permissions";

export interface CrudPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export const EMPTY_CRUD: CrudPermissions = {
  create: false,
  read: false,
  update: false,
  delete: false,
};

export const FULL_CRUD: CrudPermissions = {
  create: true,
  read: true,
  update: true,
  delete: true,
};

export const READ_ONLY: CrudPermissions = {
  create: false,
  read: true,
  update: false,
  delete: false,
};

// 角色权限配置
export interface RolePermissions {
  modulePermissions: Record<string, CrudPermissions>;
  subModuleOverrides: Record<string, Partial<CrudPermissions>>;
  isGlobalVisible: boolean;
}

// 解析子模块的实际权限（合并模块级 + 子模块覆盖）
export function resolveSubModulePermission(
  permissions: RolePermissions,
  moduleKey: string,
  subModuleKey: string
): CrudPermissions {
  if (permissions.isGlobalVisible) return FULL_CRUD;

  const modulePerm = permissions.modulePermissions[moduleKey] || EMPTY_CRUD;
  const override = permissions.subModuleOverrides[subModuleKey];

  if (!override) return modulePerm;

  return {
    create: override.create ?? modulePerm.create,
    read: override.read ?? modulePerm.read,
    update: override.update ?? modulePerm.update,
    delete: override.delete ?? modulePerm.delete,
  };
}

// 检查是否有新增权限（新增 = 可发起审批）
export function canCreate(perm: CrudPermissions): boolean {
  return perm.create;
}

// 检查是否有任意操作权限
export function hasAnyAccess(perm: CrudPermissions): boolean {
  return perm.create || perm.read || perm.update || perm.delete;
}

// === 带数据库查询的权限校验（后端使用） ===

import prisma from "@/lib/prisma"

/**
 * 判断某个模块是否配置了审批流
 * 有审批节点 → 有流程；无节点 → 无流程
 */
export async function hasApprovalFlow(moduleKey: string): Promise<boolean> {
  const count = await prisma.approvalFlowDefinition.count({
    where: { businessType: moduleKey, isActive: true },
  })
  return count > 0
}

/**
 * 判断用户能否查看全局记录
 * read: true → 全局可见；read: false → 仅自己的
 */
export function canReadAll(rolePerms: CrudPermissions): boolean {
  return rolePerms.read === true
}

/**
 * 判断用户能否删除某条业务记录
 * - 无流程模块：角色 delete 权限 + 仅限自己创建
 * - 有流程模块：草稿/已驳回 + 仅限自己创建
 */
export async function canDelete(
  rolePerms: CrudPermissions,
  moduleKey: string,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null
): Promise<boolean> {
  const isOwner = currentUserId === recordCreatorId
  if (!isOwner) return false

  if (await hasApprovalFlow(moduleKey)) {
    return recordStatus === "草稿" || recordStatus === "已驳回"
  }

  return rolePerms.delete === true
}

/**
 * 判断用户能否编辑某条业务记录
 * - 无流程模块：角色 update 权限 + 仅限自己创建
 * - 有流程模块：草稿/已驳回 + 仅限自己创建
 */
export async function canEdit(
  rolePerms: CrudPermissions,
  moduleKey: string,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null
): Promise<boolean> {
  const isOwner = currentUserId === recordCreatorId
  if (!isOwner) return false

  if (await hasApprovalFlow(moduleKey)) {
    return recordStatus === "草稿" || recordStatus === "已驳回"
  }

  return rolePerms.update === true
}

// === 前端同步版本（不查数据库，hasFlow 从 session 预加载） ===

/** 判断能否查看全局记录 */
export function canReadAllFrontend(hasFlow: boolean, rolePerms: CrudPermissions): boolean {
  return rolePerms.read === true
}

/** 判断能否删除 */
export function canDeleteFrontend(
  hasFlow: boolean,
  rolePerms: CrudPermissions,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null,
  isAdmin: boolean = false
): boolean {
  if (isAdmin) return true
  if (hasFlow) {
    // 有审批流：仅创建者可操作，且仅限草稿/已驳回
    const isOwner = currentUserId === recordCreatorId
    if (!isOwner) return false
    return recordStatus === "草稿" || recordStatus === "已驳回"
  }
  // 无审批流：直接看角色权限
  return rolePerms.delete === true
}

/** 判断能否编辑 */
export function canEditFrontend(
  hasFlow: boolean,
  rolePerms: CrudPermissions,
  recordStatus: string,
  currentUserId: string,
  recordCreatorId: string | null,
  isAdmin: boolean = false
): boolean {
  if (isAdmin) return true
  if (hasFlow) {
    // 有审批流：仅创建者可操作，且仅限草稿/已驳回
    const isOwner = currentUserId === recordCreatorId
    if (!isOwner) return false
    return recordStatus === "草稿" || recordStatus === "已驳回"
  }
  // 无审批流：直接看角色权限
  return rolePerms.update === true
}

/**
 * 从 CurrentUser 对象中提取模块的 CRUD 权限（前端使用，纯函数）
 * 不依赖任何服务端模块，可在客户端组件中安全导入
 */
export function getUserModulePerms(
  user: { username?: string; roles: { code: string; modulePermissions: string | Record<string, CrudPermissions> }[] } | null,
  moduleKey: string
): CrudPermissions {
  if (!user) return { create: false, read: false, update: false, delete: false }

  // admin 角色拥有所有权限
  const roleCodes = user.roles.map(r => r.code)
  if (roleCodes.includes("admin") || user.username === "admin") {
    return { create: true, read: true, update: true, delete: true }
  }

  // 子模块映射链（与后端 resolveCurrentUserPermission 一致）
  const mappedSubKey = API_TO_SUB_MODULE[moduleKey as keyof typeof API_TO_SUB_MODULE] as string | undefined;

  const perms: CrudPermissions = { create: false, read: false, update: false, delete: false }
  for (const role of user.roles) {
    try {
      const parsed = typeof role.modulePermissions === "string"
        ? JSON.parse(role.modulePermissions)
        : role.modulePermissions

      // 尝试直接匹配 moduleKey，再尝试子模块映射链向上查找
      let modulePerms = parsed[moduleKey];
      if (!modulePerms && mappedSubKey) {
        let currentKey: string | undefined = mappedSubKey;
        while (currentKey && !modulePerms) {
          modulePerms = parsed[currentKey];
          if (!modulePerms) {
            currentKey = SUB_MODULE_MAP[currentKey as SubModuleKey]?.parent as string | undefined;
          }
        }
      }

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
