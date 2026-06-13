// src/lib/import/writers/customers.ts
import type { WriteResult } from "./base";
import prisma from "@/lib/prisma";
import { getModuleConfig } from "../module-registry";

export interface CustomerImportRow {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  ownershipType?: string;
  customerGrade?: string;
}

/** 写入客户数据（去重：按 name 检查是否已存在） */
export async function writeCustomers(
  rows: CustomerImportRow[],
): Promise<WriteResult> {
  const result: WriteResult = { successCount: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // 去重检查
      const existing = await prisma.customer.findFirst({
        where: { name: row.name },
        select: { id: true },
      });

      if (existing) {
        // 已存在的跳过，计入成功（不重复创建）
        result.successCount++;
        continue;
      }

      await prisma.customer.create({
        data: {
          name: row.name,
          contactPerson: row.contactPerson || "",
          phone: row.phone || "",
          email: row.email || "",
          address: row.address || "",
          ownershipType: row.ownershipType || "",
          customerGrade: row.customerGrade || "C",
        },
      });
      result.successCount++;
    } catch (e) {
      result.errors.push({
        row: i + 1,
        message: `客户 "${row.name}" 导入失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  return result;
}
