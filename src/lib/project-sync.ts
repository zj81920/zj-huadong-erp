import { dsCreateProject, dsUpdateProject, dsFindUserByEmail, dsClearUserCache, dsFindFallbackUser } from "./ds-client";
import prisma from "./prisma";

const ERP_TO_DS_STATUS: Record<string, string> = {
  "执行": "ACTIVE",
  "暂停": "PAUSED",
  "关闭": "CLOSED",
};

/** 设计阶段中文 → DS 英文枚举映射 */
const PHASE_MAP: Record<string, string> = {
  "方案设计": "SCHEME_DESIGN",
  "初步设计": "PRELIMINARY_DESIGN",
  "详细设计": "DETAILED_DESIGN",
  "施工图设计": "DETAILED_DESIGN",
  "竣工图设计": "AS_BUILT_DESIGN",
};

interface SyncInput {
  id: string;
  projectCode: string;
  name: string;
  projectContent?: string | null;
  status?: string;
  dsProjectCode?: string | null;
  customerId?: string | null;
  address?: string | null;
  designManagerId?: string | null;
  supervisorLeaderId?: string | null;
  designPhases?: string | null;
}

interface SyncResult {
  success: boolean;
  dsCode?: string;
  error?: string;
}

/**
 * 同步项目到 DS 系统。有 dsProjectCode 则更新，无则创建。
 * 同步失败不抛异常，返回 { success: false }。
 */
export async function syncProjectToDS(input: SyncInput): Promise<SyncResult> {
  // 构建 DS API payload
  const dsStatus = input.status ? ERP_TO_DS_STATUS[input.status] || "ACTIVE" : undefined;

  // 查询客户名称
  let clientName: string | null = null;
  if (input.customerId) {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { name: true },
      });
      clientName = customer?.name || null;
    } catch {
      // 客户查找失败不阻塞同步
    }
  }

  // 按 email 映射用户
  let designManagerId: string | null = null;
  let leaderId: string | null = null;
  try {
    if (input.designManagerId) {
      const erpUser = await prisma.user.findUnique({
        where: { id: input.designManagerId },
        select: { email: true },
      });
      if (erpUser?.email) {
        designManagerId = await dsFindUserByEmail(erpUser.email);
      }
    }
    if (input.supervisorLeaderId) {
      const erpUser = await prisma.user.findUnique({
        where: { id: input.supervisorLeaderId },
        select: { email: true },
      });
      if (erpUser?.email) {
        leaderId = await dsFindUserByEmail(erpUser.email);
      }
    }
  } catch {
    // 用户映射失败不阻塞同步
  }

  // email 映射失败时，使用 DS 系统第一个可用用户作为兜底
  if (!designManagerId || !leaderId) {
    try {
      const fallback = await dsFindFallbackUser();
      if (!designManagerId && fallback) designManagerId = fallback;
      if (!leaderId && fallback) leaderId = fallback;
    } catch {
      // 兜底失败不阻塞
    }
  }

  // 转换设计阶段
  let projectStages: string | null = null;
  if (input.designPhases) {
    try {
      const phases: string[] = JSON.parse(input.designPhases);
      const dsStages = phases
        .map((p) => PHASE_MAP[p])
        .filter(Boolean);
      if (dsStages.length > 0) {
        projectStages = dsStages.join(",");
      }
    } catch {
      // 解析失败不阻塞同步
    }
  }

  const payload = {
    code: input.projectCode,
    name: input.name,
    description: input.projectContent || null,
    ...(dsStatus ? { status: dsStatus } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(clientName ? { clientName } : {}),
    ...(designManagerId ? { designManagerId } : {}),
    ...(leaderId ? { leaderId } : {}),
    ...(projectStages ? { projectStages: projectStages.split(",") } : {}),
  };

  try {
    if (input.dsProjectCode) {
      await dsUpdateProject(input.dsProjectCode, payload);
      return { success: true, dsCode: input.dsProjectCode };
    } else {
      const created = await dsCreateProject(payload);
      return { success: true, dsCode: created.project?.code || input.projectCode };
    }
  } catch (error: any) {
    console.error("[project-sync] DS 同步失败:", error.message);
    return { success: false, error: error.message };
  }
}

/** 暴露用户缓存清除，供外部调用 */
export { dsClearUserCache };
