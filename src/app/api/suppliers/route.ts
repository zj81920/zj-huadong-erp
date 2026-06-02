import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const supplierType = searchParams.get("supplierType") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    if (supplierType) {
      where.supplierType = supplierType;
    }

    if (status) {
      where.status = status;
    }

    const approvalStatus = searchParams.get("approvalStatus") || "";
    if (approvalStatus) {
      where.approvalStatus = approvalStatus;
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({
      data: suppliers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取供应商列表失败:", error);
    return NextResponse.json({ error: "获取供应商列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const { name, supplierType, status, contactPerson, phone, email, address, bankName, bankAccount, remark, attachmentUrl } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "供应商名称不能为空" }, { status: 400 });
    }

    const existingSupplier = await prisma.supplier.findFirst({
      where: { name: name.trim(), isActive: true },
    });

    if (existingSupplier) {
      return NextResponse.json({ error: "该供应商名称已存在" }, { status: 409 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        supplierType: supplierType || "企业",
        status: status || "当前有效",
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        bankName: bankName?.trim() || null,
        bankAccount: bankAccount?.trim() || null,
        remark: remark?.trim() || null,
        attachmentUrl: attachmentUrl?.trim() || null,
        approvalStatus: "草稿",
        lastModifiedBy: currentUser?.realName || null,
      },
    });

    return NextResponse.json({ data: supplier }, { status: 201 });
  } catch (error) {
    console.error("创建供应商失败:", error);
    return NextResponse.json({ error: "创建供应商失败" }, { status: 500 });
  }
}
