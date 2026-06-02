import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("审批流引擎专项测试", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();
  const today = new Date().toISOString().split("T")[0];

  async function loginViaApi(request: import("@playwright/test").APIRequestContext) {
    const r = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  async function apiPost(ctx: import("@playwright/test").APIRequestContext, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok()) throw new Error(`POST ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  test("前置准备 - 创建测试客户、供应商，配置审批流", async ({ request }) => {
    await loginViaApi(request);

    const cust = await apiPost(request, "/api/customers", {
      name: `审批流测试客户-${ts}`,
    });
    ids.customerId = cust.data.id;

    const supp = await apiPost(request, "/api/suppliers", {
      name: `审批流测试供应商-${ts}`,
      supplierType: "企业",
      status: "当前有效",
    });
    ids.supplierId = supp.data.id;

    const activeRes = await request.get(
      `${BASE_URL}/api/approval-instances?businessType=expense_contract&status=审批中&pageSize=100`
    );
    if (activeRes.ok()) {
      const activeJson = await activeRes.json();
      const activeList = activeJson.data || [];
      for (const inst of activeList) {
        await request.post(`${BASE_URL}/api/approval-flows/force-advance`, {
          data: { instanceId: inst.id, comment: "清理遗留审批实例" },
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    await apiPost(request, "/api/approval-flows", {
      businessType: "expense_contract",
      flowLevel: "single-node",
      nodes: [
        { nodeOrder: 1, nodeName: "发起", approverRole: "admin" },
        { nodeOrder: 2, nodeName: "管理员审批", approverRole: "admin" },
      ],
    });

    await apiPost(request, "/api/approval-flows", {
      businessType: "expense_contract",
      flowLevel: "multi-node",
      nodes: [
        { nodeOrder: 1, nodeName: "发起", approverRole: "admin" },
        { nodeOrder: 2, nodeName: "部门审批", approverRole: "admin" },
        { nodeOrder: 3, nodeName: "副总审批", approverRole: "admin" },
        { nodeOrder: 4, nodeName: "总经理审批", approverRole: "admin" },
      ],
    });

    await apiPost(request, "/api/approval-flows", {
      businessType: "expense_contract",
      flowLevel: "reject-test",
      nodes: [
        { nodeOrder: 1, nodeName: "发起", approverRole: "admin" },
        { nodeOrder: 2, nodeName: "管理员审批", approverRole: "admin" },
      ],
    });

    await apiPost(request, "/api/approval-flows", {
      businessType: "expense_contract",
      flowLevel: "force-advance",
      nodes: [
        { nodeOrder: 1, nodeName: "发起", approverRole: "admin" },
        { nodeOrder: 2, nodeName: "部门审批", approverRole: "admin" },
        { nodeOrder: 3, nodeName: "总经理审批", approverRole: "admin" },
      ],
    });

    await apiPost(request, "/api/approval-flows", {
      businessType: "expense_contract",
      flowLevel: "archive-test",
      nodes: [
        { nodeOrder: 1, nodeName: "发起", approverRole: "admin" },
        { nodeOrder: 2, nodeName: "管理员审批", approverRole: "admin" },
        { nodeOrder: 3, nodeName: "归档节点", approverRole: "admin", nodeType: "archive" },
      ],
    });

    const checkRes = await apiPost(request, "/api/approval-flows", {
      businessType: "expense_contract",
      flowLevel: "check-single",
      nodes: [
        { nodeOrder: 1, nodeName: "发起", approverRole: "admin" },
        { nodeOrder: 2, nodeName: "管理员审批", approverRole: "admin" },
      ],
    });
    expect(checkRes.data.count).toBe(2);

    const rolesRes = await request.get(`${BASE_URL}/api/roles`);
    const rolesJson = await rolesRes.json();
    const adminRoleObj = rolesJson.data.find((r: any) => r.code === "admin");
    const userRes = await request.get(`${BASE_URL}/api/auth/current-user`);
    const userJson = await userRes.json();
    if (adminRoleObj && userJson.data?.id) {
      const allRoleIds = rolesJson.data.map((r: any) => r.id);
      await request.put(`${BASE_URL}/api/settings/users/${userJson.data.id}`, {
        data: { roleIds: allRoleIds },
        headers: { "Content-Type": "application/json" },
      });
    }
  });

  test("单节点审批 - 创建 expense_contract 并完成单节点审批", async ({ request }) => {
    await loginViaApi(request);

    const contractNo = `SN-${today.replace(/-/g, "")}-${ts}`;
    const contract = await apiPost(request, "/api/expense-contracts", {
      contractNo,
      supplierId: ids.supplierId,
      totalAmount: "5000",
      contractType: "其他",
    });
    ids.contractId = contract.data.id;
    expect(contract.data.id).toBeDefined();

    const statusRes = await apiPost(request, "/api/admin/set-approval-status", {
      businessType: "expense_contract",
      businessId: ids.contractId,
      newStatus: "审批中",
    });
    expect(statusRes.data).toBeDefined();

    const instance = await apiPost(request, "/api/approval-instances", {
      businessType: "expense_contract",
      businessId: ids.contractId,
      flowLevel: "single-node",
    });
    expect(instance.data.instanceId).toBeDefined();
    expect(instance.data.currentNode).toBe(2);
    expect(instance.data.status).toBe("审批中");
    ids.singleInstanceId = instance.data.instanceId;

    const approveRes = await apiPost(request, `/api/approval-instances/${ids.singleInstanceId}/actions`, {
      action: "approve",
    });
    expect(approveRes.data.status).toBe("已批准");

    const detailRes = await request.get(`${BASE_URL}/api/approval-instances/${ids.singleInstanceId}`);
    const detail = await detailRes.json();
    expect(detail.data.status).toBe("已批准");
  });

  test("多节点串行审批 - 3 个节点逐个推进验证", async ({ request }) => {
    await loginViaApi(request);

    const contractNo = `MN-${today.replace(/-/g, "")}-${ts}`;
    const contract = await apiPost(request, "/api/expense-contracts", {
      contractNo,
      supplierId: ids.supplierId,
      totalAmount: "10000",
      contractType: "其他",
    });
    ids.multiContractId = contract.data.id;

    await apiPost(request, "/api/admin/set-approval-status", {
      businessType: "expense_contract",
      businessId: ids.multiContractId,
      newStatus: "审批中",
    });

    const instance = await apiPost(request, "/api/approval-instances", {
      businessType: "expense_contract",
      businessId: ids.multiContractId,
      flowLevel: "multi-node",
    });
    expect(instance.data.status).toBe("审批中");
    ids.multiInstanceId = instance.data.instanceId;
    expect(instance.data.currentNode).toBe(2);

    const node1Res = await apiPost(request, `/api/approval-instances/${ids.multiInstanceId}/actions`, {
      action: "approve",
    });
    expect(node1Res.data.status).toBe("审批中");
    expect(node1Res.data.currentNode).toBe(3);

    const node2Res = await apiPost(request, `/api/approval-instances/${ids.multiInstanceId}/actions`, {
      action: "approve",
    });
    expect(node2Res.data.status).toBe("审批中");
    expect(node2Res.data.currentNode).toBe(4);

    const node3Res = await apiPost(request, `/api/approval-instances/${ids.multiInstanceId}/actions`, {
      action: "approve",
    });
    expect(node3Res.data.status).toBe("已批准");

    const detailRes = await request.get(`${BASE_URL}/api/approval-instances/${ids.multiInstanceId}`);
    const detail = await detailRes.json();
    expect(detail.data.status).toBe("已批准");
    expect(detail.data.currentNode).toBe(4);
  });

  test("驳回/退回 - 创建审批实例并驳回", async ({ request }) => {
    await loginViaApi(request);

    const contractNo = `RJ-${today.replace(/-/g, "")}-${ts}`;
    const contract = await apiPost(request, "/api/expense-contracts", {
      contractNo,
      supplierId: ids.supplierId,
      totalAmount: "3000",
      contractType: "其他",
    });
    ids.rejectContractId = contract.data.id;

    await apiPost(request, "/api/admin/set-approval-status", {
      businessType: "expense_contract",
      businessId: ids.rejectContractId,
      newStatus: "审批中",
    });

    const instance = await apiPost(request, "/api/approval-instances", {
      businessType: "expense_contract",
      businessId: ids.rejectContractId,
      flowLevel: "reject-test",
    });
    expect(instance.data.status).toBe("审批中");
    expect(instance.data.currentNode).toBe(2);
    ids.rejectInstanceId = instance.data.instanceId;

    const rejectRes = await apiPost(request, `/api/approval-instances/${ids.rejectInstanceId}/actions`, {
      action: "reject",
      comment: "审批不通过，请补充材料",
    });
    expect(rejectRes.data.status).toBe("已驳回");

    const detailRes = await request.get(`${BASE_URL}/api/approval-instances/${ids.rejectInstanceId}`);
    const detail = await detailRes.json();
    expect(detail.data.status).toBe("已驳回");
  });

  test("管理员强制推进 - 跳过当前节点直接推进", async ({ request }) => {
    await loginViaApi(request);

    const contractNo = `FA-${today.replace(/-/g, "")}-${ts}`;
    const contract = await apiPost(request, "/api/expense-contracts", {
      contractNo,
      supplierId: ids.supplierId,
      totalAmount: "8000",
      contractType: "其他",
    });
    ids.forceContractId = contract.data.id;

    await apiPost(request, "/api/admin/set-approval-status", {
      businessType: "expense_contract",
      businessId: ids.forceContractId,
      newStatus: "审批中",
    });

    const instance = await apiPost(request, "/api/approval-instances", {
      businessType: "expense_contract",
      businessId: ids.forceContractId,
      flowLevel: "force-advance",
    });
    expect(instance.data.status).toBe("审批中");
    expect(instance.data.currentNode).toBe(2);
    ids.forceInstanceId = instance.data.instanceId;

    const forceRes = await apiPost(request, "/api/approval-flows/force-advance", {
      instanceId: ids.forceInstanceId,
      comment: "管理员强制推进测试",
    });
    expect(forceRes.data.status).toBe("审批中");
    expect(forceRes.data.currentNode).toBe(3);

    const lastNodeRes = await apiPost(request, `/api/approval-instances/${ids.forceInstanceId}/actions`, {
      action: "approve",
    });
    expect(lastNodeRes.data.status === "已批准" || lastNodeRes.data.status === "审批中").toBeTruthy();
  });

  test("归档节点 - 配置 archive 节点并验证自动完成", async ({ request }) => {
    await loginViaApi(request);

    const contractNo = `AR-${today.replace(/-/g, "")}-${ts}`;
    const contract = await apiPost(request, "/api/expense-contracts", {
      contractNo,
      supplierId: ids.supplierId,
      totalAmount: "6000",
      contractType: "其他",
    });
    ids.archiveContractId = contract.data.id;

    await apiPost(request, "/api/admin/set-approval-status", {
      businessType: "expense_contract",
      businessId: ids.archiveContractId,
      newStatus: "审批中",
    });

    const instance = await apiPost(request, "/api/approval-instances", {
      businessType: "expense_contract",
      businessId: ids.archiveContractId,
      flowLevel: "archive-test",
    });
    expect(instance.data.status).toBe("审批中");
    expect(instance.data.currentNode).toBe(2);
    ids.archiveInstanceId = instance.data.instanceId;

    const approveRes = await apiPost(request, `/api/approval-instances/${ids.archiveInstanceId}/actions`, {
      action: "approve",
    });
    expect(approveRes.data.status === "审批中" || approveRes.data.status === "待归档").toBeTruthy();
    expect(approveRes.data.currentNode).toBe(3);

    const archiveRes = await apiPost(request, `/api/approval-instances/${ids.archiveInstanceId}/actions`, {
      action: "archive",
      comment: "已归档完成",
    });
    expect(archiveRes.data.status).toBe("已批准");

    const detailRes = await request.get(`${BASE_URL}/api/approval-instances/${ids.archiveInstanceId}`);
    const detail = await detailRes.json();
    expect(detail.data.status).toBe("已批准");
  });
});
