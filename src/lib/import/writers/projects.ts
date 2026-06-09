// src/lib/import/writers/projects.ts
import type { WriteResult } from "./base";
import { PrismaClient } from "@prisma/client";
import { lookupCustomerId, parseDate, lookupOrganizationId } from "./base";

const prisma = new PrismaClient();

export interface ProjectImportRow {
  projectCode: string;
  name: string;
  customerName: string;
  type?: string;
  projectCategory?: string;
  address?: string;
  status?: string;
  startDate?: string;
  plannedEndDate?: string;
  actualCloseDate?: string;
  organizationName?: string;
}

/**
 * 写入项目数据
 * 自动创建关联的 ProjectLead（来源=直接委托，状态=已立项）
 */
export async function writeProjects(
  rows: ProjectImportRow[],
): Promise<WriteResult> {
  const result: WriteResult = { successCount: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // 查找客户
      const customerId = await lookupCustomerId(row.customerName);
      if (!customerId) {
        result.errors.push({
          row: i + 1,
          message: `客户 "${row.customerName}" 在系统中不存在，请先导入客户数据`,
        });
        continue;
      }

      // 去重检查（按 projectCode）
      const existing = await prisma.project.findUnique({
        where: { projectCode: row.projectCode },
        select: { id: true },
      });
      if (existing) {
        result.successCount++;
        continue;
      }

      const orgName = row.organizationName || "华东工程";
      const organizationId = await lookupOrganizationId(orgName);

      // 使用事务：同时创建 ProjectLead 和 Project
      await prisma.$transaction(async (tx) => {
        // 1. 创建项目线索（来源=直接委托，状态=已立项）
        await tx.projectLead.create({
          data: {
            projectSourceId: row.projectCode,
            customerId,
            projectName: row.name,
            implementationEntity: "华东工程",
            currentStatus: "已立项",
            leadMode: "直接委托",
            organizationId: organizationId || undefined,
          },
        });

        // 2. 创建项目
        await tx.project.create({
          data: {
            projectCode: row.projectCode,
            projectSourceId: row.projectCode,
            name: row.name,
            customerId,
            source: "直接委托",
            sourceRefId: row.projectCode,
            type: row.type || "",
            address: row.address || "",
            projectCategory: row.projectCategory || "",
            status: row.status || "执行",
            startDate: parseDate(row.startDate),
            plannedEndDate: parseDate(row.plannedEndDate),
            actualCloseDate: parseDate(row.actualCloseDate),
            organizationId: organizationId || undefined,
          },
        });
      });

      result.successCount++;
    } catch (e) {
      result.errors.push({
        row: i + 1,
        message: `项目 "${row.name}" 导入失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return result;
}
