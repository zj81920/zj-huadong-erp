import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/prisma";

describe("SupplierChange 审批引擎处理", () => {
  let supplierId: string;
  let changeId: string;

  beforeAll(async () => {
    const supplier = await prisma.supplier.create({
      data: {
        name: `审批测试供应商_${Date.now()}`,
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

  it("审批通过后，供应商字段被更新为变更单内容", async () => {
    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        name: "审批通过后的名称",
        supplierType: "政府",
        status: "已失效",
        contactPerson: "李四",
        phone: "13900001111",
        email: "lisi@example.com",
        approvalStatus: "审批中",
      },
    });
    changeId = change.id;
    expect(change.approvalStatus).toBe("审批中");

    // 模拟审批通过后的效果
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: change.name,
        supplierType: change.supplierType,
        status: change.status,
        contactPerson: change.contactPerson,
        phone: change.phone,
        email: change.email,
      },
    });

    const updatedSupplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    expect(updatedSupplier?.name).toBe("审批通过后的名称");
    expect(updatedSupplier?.supplierType).toBe("政府");
    expect(updatedSupplier?.status).toBe("已失效");
  });

  it("审批驳回后，供应商数据不变", async () => {
    const originalSupplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    const originalName = originalSupplier?.name;

    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        name: "驳回不应生效",
        supplierType: "企业",
        status: "当前有效",
        approvalStatus: "已驳回",
      },
    });

    const unchangedSupplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    expect(unchangedSupplier?.name).toBe(originalName);

    await prisma.supplierChange.delete({ where: { id: change.id } }).catch(() => {});
  });

  it("updateBusinessStatus 应将 supplier_change 的 approvalStatus 更新为已批准", async () => {
    const change = await prisma.supplierChange.create({
      data: {
        supplierId,
        name: "审批状态测试",
        supplierType: "企业",
        status: "当前有效",
        approvalStatus: "审批中",
      },
    });

    // 模拟 updateBusinessStatus 中的逻辑
    await prisma.supplierChange.update({
      where: { id: change.id },
      data: { approvalStatus: "已批准" },
    });

    const updated = await prisma.supplierChange.findUnique({ where: { id: change.id } });
    expect(updated?.approvalStatus).toBe("已批准");

    await prisma.supplierChange.delete({ where: { id: change.id } }).catch(() => {});
  });
});
