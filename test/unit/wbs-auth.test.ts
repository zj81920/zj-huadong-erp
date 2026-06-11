import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    projectWbsNode: {
      findFirst: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Re-import after mocks are set up
const { canAccessProjectWbs, canEditProjectWbs } = await import("@/lib/wbs-auth");

describe("canAccessProjectWbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回 false 当用户未登录", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await canAccessProjectWbs("PJ-2026-0001");
    expect(result).toBe(false);
  });

  it("返回 true 当用户是 admin", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "1",
      username: "admin",
      roles: [],
    } as any);
    const result = await canAccessProjectWbs("PJ-2026-0001");
    expect(result).toBe(true);
  });

  it("返回 true 当用户是设计经理", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: "user-1",
      supervisorLeaderId: null,
    } as any);
    const result = await canAccessProjectWbs("PJ-2026-0001");
    expect(result).toBe(true);
  });

  it("返回 true 当用户是主管领导", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-2",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: null,
      supervisorLeaderId: "user-2",
    } as any);
    vi.mocked(prisma.projectWbsNode.findFirst).mockResolvedValue(null);
    const result = await canAccessProjectWbs("PJ-2026-0001");
    expect(result).toBe(true);
  });

  it("返回 true 当用户是节点负责人（新增权限）", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-3",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: null,
      supervisorLeaderId: null,
    } as any);
    vi.mocked(prisma.projectWbsNode.findFirst).mockResolvedValue({
      id: "node-1",
      projectSourceId: "PJ-2026-0001",
      responsibleIds: ["user-3"],
    } as any);
    const result = await canAccessProjectWbs("PJ-2026-0001");
    expect(result).toBe(true);
  });

  it("返回 false 当用户无任何权限", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-4",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: null,
      supervisorLeaderId: null,
    } as any);
    vi.mocked(prisma.projectWbsNode.findFirst).mockResolvedValue(null);
    const result = await canAccessProjectWbs("PJ-2026-0001");
    expect(result).toBe(false);
  });
});

describe("canEditProjectWbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回 false 当用户未登录", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const result = await canEditProjectWbs("PJ-2026-0001");
    expect(result).toBe(false);
  });

  it("返回 true 当用户是 admin", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "1",
      username: "admin",
      roles: [],
    } as any);
    const result = await canEditProjectWbs("PJ-2026-0001");
    expect(result).toBe(true);
  });

  it("返回 true 当用户是设计经理", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: "user-1",
      supervisorLeaderId: null,
    } as any);
    const result = await canEditProjectWbs("PJ-2026-0001");
    expect(result).toBe(true);
  });

  it("返回 true 当用户是主管领导", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-2",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: null,
      supervisorLeaderId: "user-2",
    } as any);
    const result = await canEditProjectWbs("PJ-2026-0001");
    expect(result).toBe(true);
  });

  it("返回 false 当用户仅是节点负责人（无编辑权限）", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-3",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: null,
      supervisorLeaderId: null,
    } as any);
    // 节点负责人在 canEditProjectWbs 中没有编辑权限
    const result = await canEditProjectWbs("PJ-2026-0001");
    expect(result).toBe(false);
  });

  it("返回 false 当用户无任何权限", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-4",
      username: "normal",
      roles: [],
    } as any);
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      designManagerId: null,
      supervisorLeaderId: null,
    } as any);
    const result = await canEditProjectWbs("PJ-2026-0001");
    expect(result).toBe(false);
  });
});
