import { describe, it, expect } from "vitest";
import {
  resolveSubModulePermission,
  EMPTY_CRUD,
  FULL_CRUD,
  READ_ONLY,
  canCreate,
  hasAnyAccess,
  type RolePermissions,
} from "../types/permissions";

describe("resolveSubModulePermission", () => {
  it("全局可见角色返回完整 CRUD", () => {
    const perm: RolePermissions = {
      modulePermissions: {},
      subModuleOverrides: {},
      isGlobalVisible: true,
    };
    const result = resolveSubModulePermission(perm, "business", "business.customers");
    expect(result).toEqual(FULL_CRUD);
  });

  it("子模块没有覆写时继承模块级", () => {
    const perm: RolePermissions = {
      modulePermissions: {
        business: { create: true, read: true, update: false, delete: false },
      },
      subModuleOverrides: {},
      isGlobalVisible: false,
    };
    const result = resolveSubModulePermission(perm, "business", "business.customers");
    expect(result).toEqual({ create: true, read: true, update: false, delete: false });
  });

  it("子模块覆写部分字段时合并", () => {
    const perm: RolePermissions = {
      modulePermissions: {
        business: { create: true, read: true, update: false, delete: false },
      },
      subModuleOverrides: {
        "business.customers": { update: true },
      },
      isGlobalVisible: false,
    };
    const result = resolveSubModulePermission(perm, "business", "business.customers");
    expect(result.read).toBe(true);
    expect(result.update).toBe(true);
    expect(result.delete).toBe(false);
  });

  it("不存在的模块返回空权限", () => {
    const perm: RolePermissions = {
      modulePermissions: {},
      subModuleOverrides: {},
      isGlobalVisible: false,
    };
    const result = resolveSubModulePermission(perm, "nonexistent", "nonexistent.sub");
    expect(result).toEqual(EMPTY_CRUD);
  });
});

describe("canCreate", () => {
  it("有新增权限返回 true", () => {
    expect(canCreate(FULL_CRUD)).toBe(true);
  });

  it("只读角色无新增权限", () => {
    expect(canCreate(READ_ONLY)).toBe(false);
  });
});

describe("hasAnyAccess", () => {
  it("完整 CRUD 可访问", () => {
    expect(hasAnyAccess(FULL_CRUD)).toBe(true);
  });

  it("空权限不可访问", () => {
    expect(hasAnyAccess(EMPTY_CRUD)).toBe(false);
  });

  it("只读也可访问", () => {
    expect(hasAnyAccess(READ_ONLY)).toBe(true);
  });
});
