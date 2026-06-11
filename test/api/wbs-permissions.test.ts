import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../../src/lib/prisma";

const BASE_URL = "http://localhost:3000";

/* ======================== Session 管理 ======================== */
let adminCookie = "";
let userCookie = "";

async function loginAs(username: string, password: string) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`${username} 登录失败: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const m = setCookie.match(/erp_session=[^;]+/);
    if (m) return m[0];
  }
  throw new Error(`未获取到 ${username} 的 session cookie`);
}

function authFetch(cookie: string, url: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: { ...options?.headers, Cookie: cookie },
  });
}
function noAuthFetch(url: string, options?: RequestInit) {
  return fetch(url, options);
}

/* ======================== 测试数据 ======================== */
const TEST_USER = {
  username: "wbs-perm-test-user",
  password: "test123",
  realName: "WBS权限测试用户",
};
const TEST_PROJECT_CODE = "WBS-PERM-TEST";
let projectSourceId = "";
let testUserId = "";
let l1NodeId = "";
let l2NodeId = "";
let l3NodeId = "";
let l4NodeId = "";

describe("WBS 权限分层 — API 集成测试", () => {
  /* ---------- 环境准备 ---------- */
  beforeAll(async () => {
    // 清理上次可能的残留
    await prisma.projectWbsNode.deleteMany({ where: { projectSourceId: { startsWith: "WBS-PERM-TEST" } } });
    await prisma.project.deleteMany({ where: { projectSourceId: { startsWith: "WBS-PERM-TEST" } } });
    await prisma.projectLead.deleteMany({ where: { projectSourceId: { startsWith: "WBS-PERM-TEST" } } });
    await prisma.user.deleteMany({ where: { username: TEST_USER.username } });

    // 1. 管理员登录
    adminCookie = await loginAs("admin", "admin123");

    // 2. 创建测试用户（直接写入数据库）
    const user = await prisma.user.create({
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
        realName: TEST_USER.realName,
      },
    });
    testUserId = user.id;

    // 3. 创建 ProjectLead + 测试项目（需要真实客户）
    const customer = await prisma.customer.findFirst();
    if (!customer) throw new Error("数据库中没有客户数据，无法运行集成测试");

    // 必须先创建 ProjectLead（Project.projectSourceId 是其外键）
    await prisma.projectLead.create({
      data: {
        projectSourceId: TEST_PROJECT_CODE,
        customerId: customer.id,
        projectName: "WBS权限测试项目",
        implementationEntity: "华药设计院",
      },
    });

    const project = await prisma.project.create({
      data: {
        projectSourceId: TEST_PROJECT_CODE,
        projectCode: TEST_PROJECT_CODE,
        name: "WBS权限测试项目",
        customerId: customer.id,
      },
    });
    projectSourceId = project.projectSourceId;

    // 4. 创建 L1 → L2 → L3 节点（将测试用户设为 L3 责任人）
    const l1 = await prisma.projectWbsNode.create({
      data: {
        projectSourceId,
        name: "基础设计",
        level: 1,
        sortOrder: 0,
      },
    });
    l1NodeId = l1.id;

    const l2 = await prisma.projectWbsNode.create({
      data: {
        projectSourceId,
        parentId: l1.id,
        name: "600#厂房",
        level: 2,
        sortOrder: 0,
      },
    });
    l2NodeId = l2.id;

    const l3 = await prisma.projectWbsNode.create({
      data: {
        projectSourceId,
        parentId: l2.id,
        name: "工艺",
        level: 3,
        sortOrder: 0,
        responsibleIds: [testUserId],
      },
    });
    l3NodeId = l3.id;

    // 登录测试用户
    userCookie = await loginAs(TEST_USER.username, TEST_USER.password);
  });

  afterAll(async () => {
    // 清理
    await prisma.projectWbsNode.deleteMany({ where: { projectSourceId } });
    await prisma.project.delete({ where: { projectSourceId } });
    await prisma.projectLead.delete({ where: { projectSourceId } });
    await prisma.user.delete({ where: { username: TEST_USER.username } });
  });

  /* ======================== 查看权限 (canAccess) ======================== */

  describe("GET 查看 WBS 节点", () => {
    const url = () => `${BASE_URL}/api/projects/plans/${projectSourceId}`;

    it("admin: GET 返回 200", async () => {
      const res = await authFetch(adminCookie, url());
      expect(res.status).toBe(200);
    });

    it("责任人: GET 返回 200（可查看）", async () => {
      const res = await authFetch(userCookie, url());
      expect(res.status).toBe(200);
    });

    it("未登录: GET 返回 401", async () => {
      const res = await noAuthFetch(url());
      expect(res.status).toBe(401);
    });
  });

  /* ======================== 编辑权限 (canEdit) ======================== */

  describe("POST 创建节点", () => {
    const url = () => `${BASE_URL}/api/projects/plans/${projectSourceId}`;

    it("admin: POST 返回 201", async () => {
      const res = await authFetch(adminCookie, url(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: l3NodeId, name: "工艺流程图绘制", level: 4 }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      l4NodeId = json.data.id;
    });

    it("责任人: POST 返回 403（不可创建）", async () => {
      const res = await authFetch(userCookie, url(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: l3NodeId, name: "设备布置图", level: 4 }),
      });
      expect(res.status).toBe(403);
    });

    it("未登录: POST 返回 401", async () => {
      const res = await noAuthFetch(url(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: l3NodeId, name: "test", level: 4 }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("PUT 编辑节点", () => {
    const url = () => `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${l4NodeId}`;

    it("admin: PUT 返回 200", async () => {
      const res = await authFetch(adminCookie, url(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "工艺流程图绘制(已修改)" }),
      });
      expect(res.status).toBe(200);
    });

    it("责任人: PUT 返回 403（不可编辑）", async () => {
      const res = await authFetch(userCookie, url(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "试图修改" }),
      });
      expect(res.status).toBe(403);
    });

    it("未登录: PUT 返回 401", async () => {
      const res = await noAuthFetch(url(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE 删除节点", () => {
    it("责任人: DELETE 返回 403（不可删除）", async () => {
      const res = await authFetch(userCookie, `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${l4NodeId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    it("未登录: DELETE 返回 401", async () => {
      const res = await noAuthFetch(`${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${l4NodeId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });

    it("admin: DELETE 返回 200", async () => {
      const res = await authFetch(adminCookie, `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${l4NodeId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
    });
  });
});
