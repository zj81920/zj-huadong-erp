import { APIRequestContext, Page } from "@playwright/test";

// ========== 基础配置 ==========

const BASE_URL = "http://localhost:3000";

/** 测试用户凭据（密码为占位符，后续手动填入实际密码） */
const TEST_USER = { username: "zhangjing@hcec.group", password: "123456" };

// ========== 工具函数 ==========

/** 生成唯一后缀，避免测试数据冲突 */
export function uniqueSuffix(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ========== 认证 ==========

/**
 * API 登录（供 beforeAll 使用）。
 * Playwright 的 APIRequestContext 会自动存储响应中的 Set-Cookie，
 * 后续请求自动携带认证 cookie。
 */
export async function apiLogin(request: APIRequestContext) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: TEST_USER,
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    const body = await res.json();
    throw new Error(`API 登录失败: ${body.error || res.status()}`);
  }
  return res;
}

/**
 * UI 登录（供 beforeEach 使用）。
 * 通过浏览器页面填写登录表单完成登录。
 */
export async function uiLogin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[placeholder="请输入用户名"]');
  await page.fill('input[placeholder="请输入用户名"]', TEST_USER.username);
  await page.fill('input[placeholder="请输入密码"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/");
  await page.waitForTimeout(1500);
}

// ========== 查询类辅助 ==========

/** 获取经营主体列表 */
export async function getOrganizations(request: APIRequestContext) {
  const res = await request.get(`${BASE_URL}/api/organizations`);
  if (!res.ok()) {
    const body = await res.json();
    throw new Error(`获取经营主体失败: ${body.error || res.status()}`);
  }
  const json = await res.json();
  return json.data || json;
}

/** 获取部门列表 */
export async function getDepartments(request: APIRequestContext) {
  const res = await request.get(`${BASE_URL}/api/departments`);
  if (!res.ok()) {
    const body = await res.json();
    throw new Error(`获取部门列表失败: ${body.error || res.status()}`);
  }
  const json = await res.json();
  return json.data || json;
}

// ========== 创建类辅助 ==========

/**
 * 创建客户。
 * 必填: name；可选: contactPerson, contactPhone, industryType 等
 */
export async function createCustomer(
  request: APIRequestContext,
  data: {
    name: string;
    contactPerson?: string;
    contactPhone?: string;
    industryType?: string;
    customerGrade?: string;
  }
) {
  const res = await request.post(`${BASE_URL}/api/customers`, {
    data: {
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.contactPhone || null,
      industryType: data.industryType || null,
      customerGrade: data.customerGrade || null,
    },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    const body = await res.json();
    throw new Error(`创建客户失败: ${JSON.stringify(body)}`);
  }
  const json = await res.json();
  return json.data || json;
}

/**
 * 创建员工。
 * 必填: name, departmentId；其余字段可选
 */
export async function createEmployee(
  request: APIRequestContext,
  data: {
    name: string;
    departmentId: string;
    role?: string;
    phone?: string;
    position?: string;
  }
) {
  const res = await request.post(`${BASE_URL}/api/hr/employees`, {
    data: {
      username: `e2e_${uniqueSuffix()}`,
      realName: data.name,
      department: data.departmentId,
      role: data.role || "staff",
      phone: data.phone || null,
      position: data.position || null,
    },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    const body = await res.json();
    throw new Error(`创建员工失败: ${JSON.stringify(body)}`);
  }
  const json = await res.json();
  return json.data || json;
}

/**
 * 创建银行账户。
 * 必填: bankName, accountNumber, accountName
 */
export async function createBankAccount(
  request: APIRequestContext,
  data: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    accountType?: "公司账户" | "个人账户";
  }
) {
  const res = await request.post(`${BASE_URL}/api/bank-accounts`, {
    data: {
      bankName: data.bankName,
      accountNo: data.accountNumber,
      accountName: data.accountName,
      accountType: data.accountType || "公司账户",
    },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    const body = await res.json();
    throw new Error(`创建银行账户失败: ${JSON.stringify(body)}`);
  }
  const json = await res.json();
  return json.data || json;
}

export { TEST_USER, BASE_URL };
