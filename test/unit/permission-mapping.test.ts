/**
 * 权限映射单元测试
 * 
 * 验证 API key → 子模块 key → 父模块 key 的权限解析链
 * 
 * 场景覆盖：
 * 1. API key 直接匹配（如 "business"）
 * 2. API key 通过映射表找到子模块 key（如 "supplier" → "business.suppliers"）
 * 3. 子模块 key 无独立配置时，继承父模块权限（"supplier" → fallback to "business"）
 * 4. 未知 key 返回空权限
 * 5. admin 用户始终拥有全部权限
 */
import { describe, it, expect } from "vitest";
import { getUserModulePerms } from "@/lib/permission-check";
import type { CurrentUser } from "@/lib/auth";

// 构造 mock 用户
function makeUser(modulePermissions: Record<string, unknown>, roleCode = "test_role"): CurrentUser {
  return {
    id: "user-1",
    username: "testuser",
    realName: "测试用户",
    roles: [
      {
        id: "role-1",
        code: roleCode,
        name: "测试角色",
        isGlobalVisible: false,
        modulePermissions: JSON.stringify(modulePermissions),
        subModuleOverrides: {},
      },
    ],
  } as unknown as CurrentUser;
}

describe("getUserModulePerms - API key 映射", () => {
  it("直接匹配父模块 key（business）", () => {
    const user = makeUser({
      business: { read: true, create: true, update: false, delete: false },
    });
    const perms = getUserModulePerms(user, "business");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
    expect(perms.update).toBe(false);
    expect(perms.delete).toBe(false);
  });

  it('API key "supplier" 映射到子模块 "business.suppliers"', () => {
    const user = makeUser({
      "business.suppliers": { read: true, create: true, update: true, delete: true },
    });
    const perms = getUserModulePerms(user, "supplier");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
    expect(perms.update).toBe(true);
    expect(perms.delete).toBe(true);
  });

  it('API key "supplier" 无子模块配置时继承父模块 "business"', () => {
    const user = makeUser({
      business: { read: true, create: true, update: false, delete: false },
    });
    const perms = getUserModulePerms(user, "supplier");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
    expect(perms.update).toBe(false);
    expect(perms.delete).toBe(false);
  });

  it('API key "expense_report" 映射到 "finance.expense.report"', () => {
    const user = makeUser({
      "finance.expense.report": { read: true, create: false, update: false, delete: false },
    });
    const perms = getUserModulePerms(user, "expense_report");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(false);
  });

  it('API key "expense_report" 无子模块配置时 fallback 到 "finance.expense" 再到 "finance"', () => {
    const user = makeUser({
      finance: { read: true, create: true, update: true, delete: true },
    });
    const perms = getUserModulePerms(user, "expense_report");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
  });

  it("未知 key 返回空权限", () => {
    const user = makeUser({
      business: { read: true, create: true, update: true, delete: true },
    });
    const perms = getUserModulePerms(user, "unknown_module");
    expect(perms.read).toBe(false);
    expect(perms.create).toBe(false);
    expect(perms.update).toBe(false);
    expect(perms.delete).toBe(false);
  });

  it("admin 用户始终拥有全部权限", () => {
    const user = makeUser({}, "admin");
    const perms = getUserModulePerms(user, "supplier");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
    expect(perms.update).toBe(true);
    expect(perms.delete).toBe(true);
  });

  it("null 用户返回空权限", () => {
    const perms = getUserModulePerms(null, "supplier");
    expect(perms.read).toBe(false);
    expect(perms.create).toBe(false);
  });

  it('子模块覆写优先于父模块（"business.suppliers" 覆写 "business"）', () => {
    const user = makeUser({
      business: { read: true, create: true, update: true, delete: true },
      "business.suppliers": { read: true, create: false, update: false, delete: false },
    });
    const perms = getUserModulePerms(user, "supplier");
    // 子模块覆写优先
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(false);
    expect(perms.update).toBe(false);
    expect(perms.delete).toBe(false);
  });

  it('API key "customers" 映射到 "business.customers"', () => {
    const user = makeUser({
      "business.customers": { read: true, create: true, update: false, delete: false },
    });
    const perms = getUserModulePerms(user, "customers");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
    expect(perms.update).toBe(false);
  });

  it('API key "income_contract" 映射到 "contracts.income"', () => {
    const user = makeUser({
      "contracts.income": { read: true, create: true, update: true, delete: false },
    });
    const perms = getUserModulePerms(user, "income_contract");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
    expect(perms.delete).toBe(false);
  });

  it('API key "salary_payment" 映射到 "finance.expense.salary"', () => {
    const user = makeUser({
      "finance.expense.salary": { read: true, create: false, update: false, delete: false },
    });
    const perms = getUserModulePerms(user, "salary_payment");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(false);
  });

  it('API key "salary_payment" 无子模块配置时 fallback 到 "finance"', () => {
    const user = makeUser({
      finance: { read: true, create: true, update: true, delete: true },
    });
    const perms = getUserModulePerms(user, "salary_payment");
    expect(perms.read).toBe(true);
    expect(perms.create).toBe(true);
  });
});
