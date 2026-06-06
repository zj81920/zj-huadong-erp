import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";

describe("SupplierChange 模型", () => {
  let supplierId: string;
  let changeId: string;

  beforeAll(async () => {
    const supplier = await prisma.supplier.create({
      data: {
        name: `测试供应商_${Date.now()}`,
        supplierType: "企业",
        status: "当前有效",
        approvalStatus: "已批准",
      },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    if (changeId) await prisma.supplierChange.delete({ where: { id: changeId } }).catch(() => {});
    if (supplierId) await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
  });

  it("可以创建供应商变更单", async () => {
    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        name: "变更后供应商名",
        supplierType: "企业",
        status: "已失效",
        contactPerson: "张三",
        phone: "13800001111",
        email: "test@example.com",
        address: "北京市",
        bankName: "中国银行",
        bankAccount: "6222000000000001",
        remark: "测试变更",
        approvalStatus: "草稿",
      },
    });
    changeId = change.id;
    expect(change.id).toBeDefined();
    expect(change.approvalStatus).toBe("草稿");
    expect(change.supplierId).toBe(supplierId);
  });

  it("变更单必须关联有效的供应商", async () => {
    await expect(
      prisma.supplierChange.create({
        data: {
          supplierId: "non-existent-id",
          name: "test",
          supplierType: "企业",
          status: "当前有效",
        },
      })
    ).rejects.toThrow();
  });
});
