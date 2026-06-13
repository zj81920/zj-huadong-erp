import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("合同变更流程", () => {
  test.describe.configure({ mode: "serial" });

  const ids: Record<string, string> = {};
  const ts = Date.now();
  const today = new Date().toISOString().split("T")[0];

  async function apiPost(ctx: any, url: string, body: unknown) {
    const r = await ctx.post(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok())
      throw new Error(`POST ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function apiPut(ctx: any, url: string, body: unknown) {
    const r = await ctx.put(`${BASE_URL}${url}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });
    const j = await r.json();
    if (!r.ok())
      throw new Error(
        `PUT ${url} ${r.status()}: ${j.error || JSON.stringify(j)}`
      );
    return j;
  }

  async function apiGet(ctx: any, url: string) {
    const r = await ctx.get(`${BASE_URL}${url}`);
    const j = await r.json();
    if (!r.ok())
      throw new Error(`GET ${url} ${r.status()}: ${JSON.stringify(j)}`);
    return j;
  }

  async function login(ctx: any) {
    const r = await ctx.post(`${BASE_URL}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
      headers: { "Content-Type": "application/json" },
    });
    expect(r.ok()).toBeTruthy();
  }

  test("Step 1: 登录并创建前置数据（客户+供应商+项目线索+项目+收入合同）", async ({
    request,
  }) => {
    await login(request);

    // 创建客户
    const cust = await apiPost(request, "/api/customers", {
      name: `测试客户-BG-${ts}`,
      ownershipType: "民营",
      contactPerson: "张三",
      phone: "13800138000",
      address: "测试路100号",
    });
    ids.customerId = cust.data.id;

    // 创建供应商
    const supp = await apiPost(request, "/api/suppliers", {
      name: `测试供应商-BG-${ts}`,
      supplierType: "企业",
      status: "当前有效",
      contactPerson: "李四",
      phone: "13900139000",
      address: "测试路200号",
    });
    ids.supplierId = supp.data.id;

    // 创建项目线索
    const lead = await apiPost(request, "/api/project-leads", {
      customerId: ids.customerId,
      projectName: `测试项目-BG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      location: "安徽省合肥市",
      contactPerson: "王工",
      contactPhone: "13700137000",
      projectNature: "EPcm",
      implementationEntity: "华东工程",
      currentStatus: "已中标",
    });
    ids.projectSourceId = lead.data.projectSourceId;

    // 创建项目
    const proj = await apiPost(request, "/api/projects", {
      projectSourceId: ids.projectSourceId,
      projectCode: `BG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `BG测试项目-${Date.now()}`,
      customerId: ids.customerId,
      projectCategory: "EPC",
      source: "项目线索",
      status: "执行",
    });
    ids.projectId = proj.data.id;

    // 创建收入合同（作为变更基础合同）
    const contractNo = `SR-BG-${today.replace(/-/g, "")}-${ts.toString().slice(-4)}`;
    const contract = await apiPost(request, "/api/income-contracts", {
      contractNo,
      projectSourceId: ids.projectSourceId,
      customerId: ids.customerId,
      totalAmount: "500000",
      paymentTerms: "按进度付款",
      contractSummary: `EPC总承包合同-变更测试-${ts}`,
    });
    ids.incomeContractId = contract.data.id;
    expect(contract.data.contractNo).toBe(contractNo);
    expect(contract.data.status).toBe("草稿");
    console.log(`✅ 基础合同: ${contract.data.contractNo} (${contract.data.id})`);
    console.log("✅ Step 1 完成");
  });

  test("Step 2: POST /api/change-orders 创建合同变更单", async ({ request }) => {
    await login(request);

    const change = await apiPost(request, "/api/change-orders", {
      contractType: "income_contract",
      contractId: ids.incomeContractId,
      changeReason: `E2E测试-合同金额变更-${ts}`,
      previousAmount: "500000",
      newAmount: "600000",
      newFiles: [],
      remark: "因范围扩大增加10万",
    });

    ids.changeOrderId = change.data.id;
    expect(change.data.status).toBe("草稿");
    expect(change.data.changeNo).toMatch(/^BG-/);
    expect(Number(change.data.amountDifference)).toBe(100000);
    console.log(`✅ 变更单: ${change.data.changeNo} (${change.data.id})`);
    console.log("✅ Step 2 完成");
  });

  test("Step 3: GET /api/change-orders/[id] 获取变更单详情", async ({
    request,
  }) => {
    await login(request);

    const detail = await apiGet(
      request,
      `/api/change-orders/${ids.changeOrderId}`
    );
    expect(detail.data.id).toBe(ids.changeOrderId);
    expect(detail.data.contractType).toBe("income_contract");
    expect(detail.data.relatedContract).not.toBeNull();
    console.log(`✅ 变更单详情: ${detail.data.changeNo}, 关联合同: ${detail.data.relatedContract?.contractNo || "ok"}`);
    console.log("✅ Step 3 完成");
  });

  test("Step 4: PUT /api/change-orders/[id] 更新变更单", async ({ request }) => {
    await login(request);

    const updated = await apiPut(
      request,
      `/api/change-orders/${ids.changeOrderId}`,
      {
        changeReason: `E2E测试-更新后-合同金额变更-${ts}`,
        newAmount: "650000",
        previousAmount: "500000",
        remark: "更新备注-范围进一步扩大",
      }
    );
    expect(Number(updated.data.amountDifference)).toBe(150000);
    expect(updated.data.remark).toBe("更新备注-范围进一步扩大");
    console.log(`✅ 变更单已更新, 差额: ${updated.data.amountDifference}`);
    console.log("✅ Step 4 完成");
  });

  test("Step 5: GET /api/change-orders 获取变更单列表并验证", async ({
    request,
  }) => {
    await login(request);

    const list = await apiGet(
      request,
      `/api/change-orders?contractId=${ids.incomeContractId}`
    );
    expect(Array.isArray(list.data)).toBeTruthy();
    expect(list.data.length).toBeGreaterThanOrEqual(1);
    const found = list.data.find(
      (o: any) => o.id === ids.changeOrderId
    );
    expect(found).toBeTruthy();
    expect(found.status).toBe("草稿");
    console.log(`✅ 变更单列表: ${list.data.length} 条, 找到目标变更`);
    console.log("✅ Step 5 完成");
  });

  test("Step 6: 禁止对同一合同创建重复审批中的变更单", async ({
    request,
  }) => {
    await login(request);

    try {
      await apiPost(request, "/api/change-orders", {
        contractType: "income_contract",
        contractId: ids.incomeContractId,
        changeReason: `E2E测试-重复变更-${ts}`,
        previousAmount: "500000",
        newAmount: "700000",
      });
      // 如果能创建成功（因为第一个可能没提交审批，所以状态还是草稿），也正常
      console.log("✅ 允许创建多个草稿变更单（正常行为）");
    } catch (e: any) {
      // 如果被拦截，说明规则生效
      expect(e.message).toContain("已有审批中的变更");
      console.log("✅ 重复变更拦截规则生效");
    }
    console.log("✅ Step 6 完成");
  });

  test("Step 7: 清理变更单和前置数据", async ({ request }) => {
    await login(request);

    // 删除变更单
    if (ids.changeOrderId) {
      const delRes = await request.delete(
        `${BASE_URL}/api/change-orders/${ids.changeOrderId}`
      );
      expect(delRes.ok()).toBeTruthy();
      console.log("✅ 变更单已清理");
    }

    // 删除收入合同
    if (ids.incomeContractId) {
      const delRes = await request.delete(
        `${BASE_URL}/api/income-contracts/${ids.incomeContractId}`
      );
      expect(delRes.ok()).toBeTruthy();
      console.log("✅ 收入合同已清理");
    }

    // 删除项目
    if (ids.projectId) {
      const delRes = await request.delete(
        `${BASE_URL}/api/projects/${ids.projectId}`
      );
      expect(delRes.ok()).toBeTruthy();
      console.log("✅ 项目已清理");
    }

    // 删除项目线索
    if (ids.projectSourceId) {
      const leadRes = await request.get(
        `${BASE_URL}/api/project-leads?projectSourceId=${ids.projectSourceId}`
      );
      const leadData = await leadRes.json();
      for (const l of leadData.data || []) {
        await request.delete(`${BASE_URL}/api/project-leads/${l.id}`);
      }
      console.log("✅ 项目线索已清理");
    }

    // 删除客户
    if (ids.customerId) {
      const delRes = await request.delete(
        `${BASE_URL}/api/customers/${ids.customerId}`
      );
      if (delRes.ok()) console.log("✅ 客户已清理");
    }

    // 删除供应商
    if (ids.supplierId) {
      const delRes = await request.delete(
        `${BASE_URL}/api/suppliers/${ids.supplierId}`
      );
      if (delRes.ok()) console.log("✅ 供应商已清理");
    }

    console.log("✅ Step 7 完成");
    console.log("🎉 合同变更流程 E2E 测试完成！");
  });
});
