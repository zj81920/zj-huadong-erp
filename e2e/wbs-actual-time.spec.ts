import { test, expect } from "@playwright/test";

test.describe("WBS 实际开始/完成时间", () => {
  // 用 API 直接测试，因为甘特图标记的 DOM 验证不稳定
  const BASE_URL = "http://localhost:3000";
  let adminCookie: string;

  test.beforeAll(async () => {
    // 登录获取 session
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    const setCookie = loginRes.headers.get("set-cookie");
    const m = setCookie?.match(/erp_session=[^;]+/);
    adminCookie = m?.[0] || "";
  });

  test("进度 0→50% 应记录 actualStartDate", async () => {
    // 找一个有 WBS 节点的项目
    const summaryRes = await fetch(`${BASE_URL}/api/projects/plans/summary`, {
      headers: { Cookie: adminCookie },
    });
    const summaryData = await summaryRes.json();
    if (!summaryData.data?.length) return; // 没有项目则跳过

    const project = summaryData.data[0];
    const projectSourceId = project.projectSourceId;

    // 获取节点
    const nodesRes = await fetch(`${BASE_URL}/api/projects/plans/${projectSourceId}`, {
      headers: { Cookie: adminCookie },
    });
    const nodesData = await nodesRes.json();
    const l4Nodes = nodesData.data?.filter((n: any) => n.level === 4) || [];

    if (l4Nodes.length === 0) return; // 没有 L4 节点则跳过

    const testNode = l4Nodes.find((n: any) => n.progress === 0) || l4Nodes[0];
    const originalProgress = testNode.progress ?? 0;

    // 设置进度为 50%
    const updateRes = await fetch(
      `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${testNode.id}/progress`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ progress: 50 }),
      }
    );
    expect(updateRes.status).toBe(200);

    const updatedData = await updateRes.json();
    const updatedNode = updatedData.data;

    // 如果原始进度为 0，应该记录 actualStartDate
    if (originalProgress === 0) {
      expect(updatedNode.actualStartDate).toBeTruthy();
    }

    // 恢复原始进度
    await fetch(
      `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${testNode.id}/progress`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ progress: originalProgress }),
      }
    );
  });

  test("进度 50→100% 应记录 actualEndDate", async () => {
    const summaryRes = await fetch(`${BASE_URL}/api/projects/plans/summary`, {
      headers: { Cookie: adminCookie },
    });
    const summaryData = await summaryRes.json();
    if (!summaryData.data?.length) return;

    const project = summaryData.data[0];
    const projectSourceId = project.projectSourceId;

    const nodesRes = await fetch(`${BASE_URL}/api/projects/plans/${projectSourceId}`, {
      headers: { Cookie: adminCookie },
    });
    const nodesData = await nodesRes.json();
    const l4Nodes = nodesData.data?.filter((n: any) => n.level === 4) || [];
    if (l4Nodes.length === 0) return;

    const testNode = l4Nodes[0];
    const originalProgress = testNode.progress ?? 0;

    // 先设为 50%（确保不是 100%）
    await fetch(
      `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${testNode.id}/progress`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ progress: 50 }),
      }
    );

    // 设为 100%
    const completeRes = await fetch(
      `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${testNode.id}/progress`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ progress: 100 }),
      }
    );
    expect(completeRes.status).toBe(200);

    const completeData = await completeRes.json();
    expect(completeData.data.actualEndDate).toBeTruthy();

    // 退回 80%，actualEndDate 应被清空
    const rollbackRes = await fetch(
      `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${testNode.id}/progress`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ progress: 80 }),
      }
    );
    const rollbackData = await rollbackRes.json();
    expect(rollbackData.data.actualEndDate).toBeNull();

    // 恢复原始进度
    await fetch(
      `${BASE_URL}/api/projects/plans/${projectSourceId}/nodes/${testNode.id}/progress`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ progress: originalProgress }),
      }
    );
  });
});
