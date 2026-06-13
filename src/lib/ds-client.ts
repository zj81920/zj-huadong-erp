function getConfig() {
  return {
    baseUrl: process.env.DS_API_BASE_URL || "http://localhost:3000",
    apiKey: process.env.DS_INTERNAL_API_KEY || "",
    timeout: 5000, // 5 秒超时，避免阻塞 ERP 业务
  };
}

export interface DsProjectPayload {
  code: string;
  name: string;
  description?: string | null;
  status?: string;
  address?: string | null;
  clientName?: string | null;
  designManagerId?: string | null;
  leaderId?: string | null;
  projectStages?: string[] | null;
}

async function dsFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getConfig().timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function dsCreateProject(payload: DsProjectPayload) {
  const { baseUrl, apiKey } = getConfig();
  const res = await dsFetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `DS API POST failed: ${res.status}`);
  }

  return res.json();
}

export async function dsUpdateProject(code: string, payload: Partial<DsProjectPayload>) {
  const { baseUrl, apiKey } = getConfig();
  const res = await dsFetch(`${baseUrl}/api/projects/${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `DS API PATCH failed: ${res.status}`);
  }

  return res.json();
}

export interface DsUser {
  id: string;
  email: string;
  name: string;
}

let cachedDsUsers: DsUser[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60000; // 1 分钟缓存

/** 获取 DS 系统用户列表（带缓存） */
export async function dsListUsers(): Promise<DsUser[]> {
  const now = Date.now();
  if (cachedDsUsers && now < cacheExpiry) {
    return cachedDsUsers;
  }

  const { baseUrl, apiKey } = getConfig();
  const res = await dsFetch(`${baseUrl}/api/admin/users`, {
    headers: { "x-internal-key": apiKey },
  });

  if (!res.ok) {
    throw new Error(`DS 用户列表请求失败: ${res.status}`);
  }

  const data = await res.json();
  cachedDsUsers = data.users || [];
  cacheExpiry = now + CACHE_TTL;
  return cachedDsUsers as DsUser[];
}

/** 按 email 查找 DS 用户 ID */
export async function dsFindUserByEmail(email: string): Promise<string | null> {
  const users = await dsListUsers();
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id || null;
}

/** 清除用户缓存（用户信息变更时调用） */
export function dsClearUserCache() {
  cachedDsUsers = null;
  cacheExpiry = 0;
}

/** 检查 DS 系统中项目是否存在（通过项目列表 API 按编号匹配） */
export async function dsProjectExists(code: string): Promise<boolean> {
  const { baseUrl, apiKey } = getConfig();
  try {
    const res = await dsFetch(`${baseUrl}/api/projects?limit=1000`, {
      headers: { "x-internal-key": apiKey },
    });
    if (!res.ok) return false;
    const data = await res.json();
    const projects = data.projects || [];
    return projects.some((p: { code: string }) => p.code === code);
  } catch {
    return false;
  }
}

/** 创建用户到 DS */
export async function dsCreateUser(payload: {
  name: string;
  email: string;
  password: string;
  signatureImage?: string | null;
}): Promise<{ id: string }> {
  const { baseUrl, apiKey } = getConfig();
  const res = await dsFetch(`${baseUrl}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": apiKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "未知错误" }));
    throw new Error(`DS 创建用户失败: ${err.error || res.statusText}`);
  }
  const data = await res.json();
  return { id: data.user.id };
}

/** 更新 DS 用户（按 email 查找后按 ID 更新） */
export async function dsUpdateUser(
  email: string,
  payload: { name?: string; email?: string; signatureImage?: string | null }
): Promise<void> {
  const userId = await dsFindUserByEmail(email);
  if (!userId) {
    console.warn(`[ds-client] DS 用户 ${email} 不存在，跳过更新`);
    return;
  }
  const { baseUrl, apiKey } = getConfig();
  const res = await dsFetch(`${baseUrl}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-key": apiKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "未知错误" }));
    throw new Error(`DS 更新用户失败: ${err.error || res.statusText}`);
  }
}

/** 删除 DS 用户（按 email 查找后按 ID 删除） */
export async function dsDeleteUser(email: string): Promise<void> {
  const userId = await dsFindUserByEmail(email);
  if (!userId) {
    console.warn(`[ds-client] DS 用户 ${email} 不存在，跳过删除`);
    return;
  }
  const { baseUrl, apiKey } = getConfig();
  const res = await dsFetch(`${baseUrl}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: { "x-internal-key": apiKey },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "未知错误" }));
    throw new Error(`DS 删除用户失败: ${err.error || res.statusText}`);
  }
}

/** 获取 DS 第一个可用用户 ID（当 email 映射失败时的兜底） */
export async function dsFindFallbackUser(): Promise<string | null> {
  const users = await dsListUsers();
  return users[0]?.id || null;
}

export interface DsDiscipline {
  id: string;
  code: string;
  name: string;
  shortCode?: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** 获取 DS 系统所有专业列表（含已停用） */
export async function dsListDisciplines(): Promise<DsDiscipline[]> {
  const { baseUrl, apiKey } = getConfig();
  const res = await dsFetch(`${baseUrl}/api/admin/disciplines`, {
    headers: { "x-internal-key": apiKey },
  });

  if (!res.ok) {
    throw new Error(`DS 专业列表请求失败: ${res.status}`);
  }

  const data = await res.json();
  return data.disciplines || [];
}
