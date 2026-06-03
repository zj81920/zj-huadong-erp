// CRUD 操作权限
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
