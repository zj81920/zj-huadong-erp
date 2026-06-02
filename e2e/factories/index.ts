export function uniqueSuffix(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export const TEST_USER = {
  username: "admin",
  password: "admin123",
  realName: "系统管理员",
};
