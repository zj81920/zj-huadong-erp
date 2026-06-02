import { Page, APIRequestContext } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

export async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[placeholder="请输入用户名"]');
  await page.fill('input[placeholder="请输入用户名"]', "admin");
  await page.fill('input[placeholder="请输入密码"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/");
  await page.waitForTimeout(1500);
}

export async function loginViaApi(request: APIRequestContext) {
  const r = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { username: "admin", password: "admin123" },
    headers: { "Content-Type": "application/json" },
  });
  return r.ok();
}

export async function getAuthCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.map(c => `${c.name}=${c.value}`).join("; ");
}

export async function apiGet(page: Page, url: string) {
  const cookie = await getAuthCookie(page);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "GET",
    headers: { Cookie: cookie },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API GET ${url} 失败: ${json.error || res.status}`);
  return json;
}

export async function apiPost(page: Page, url: string, body: unknown) {
  const cookie = await getAuthCookie(page);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API POST ${url} 失败: ${json.error || res.status}`);
  return json;
}

export async function apiPut(page: Page, url: string, body: unknown) {
  const cookie = await getAuthCookie(page);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API PUT ${url} 失败: ${json.error || res.status}`);
  return json;
}

export async function apiDelete(page: Page, url: string) {
  const cookie = await getAuthCookie(page);
  const res = await fetch(`${BASE_URL}${url}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API DELETE ${url} 失败: ${json.error || res.status}`);
  return json;
}

export async function adminSetStatus(page: Page, businessType: string, businessId: string, newStatus: string) {
  return apiPost(page, "/api/admin/set-approval-status", { businessType, businessId, newStatus });
}

export const API_BASE = BASE_URL;
