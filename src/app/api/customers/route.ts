import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkReadPermission } from "@/lib/permission-check";

export async function GET(request: NextRequest) {
  try {
    const { canReadAll, userId } = await checkReadPermission("business")
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const industryType = searchParams.get("industryType") || "";
    const customerGrade = searchParams.get("customerGrade") || "";
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
        { maintainer: { contains: search, mode: "insensitive" } },
      ];
    }

    if (industryType) {
      where.industryType = industryType;
    }

    if (customerGrade) {
      where.customerGrade = customerGrade;
    }

    // 权限过滤
    if (!canReadAll && userId) {
      where.createdById = userId;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      data: customers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取客户列表失败:", error);
    return NextResponse.json({ error: "获取客户列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const { name, address, contactPerson, phone, email, maintainer, industryType, customerGrade } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "客户名称不能为空" }, { status: 400 });
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: { name: name.trim(), isActive: true },
    });

    if (existingCustomer) {
      return NextResponse.json({ error: "该客户名称已存在" }, { status: 409 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        maintainer: maintainer?.trim() || null,
        industryType: industryType || null,
        customerGrade: customerGrade || "C",
        lastModifiedBy: currentUser?.realName || null,
        createdById: currentUser?.id || null,
      },
    });

    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (error) {
    console.error("创建客户失败:", error);
    return NextResponse.json({ error: "创建客户失败" }, { status: 500 });
  }
}
