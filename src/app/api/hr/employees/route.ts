import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const department = searchParams.get("department") || "";
    const role = searchParams.get("role") || "";
    const isActiveParam = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {
      username: { not: "admin" },
    };

    if (search) {
      where.OR = [
        { realName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    if (department) {
      where.department = department;
    }

    if (role) {
      where.role = role;
    }

    if (isActiveParam !== null && isActiveParam !== "") {
      where.isActive = isActiveParam === "true";
    }

    const employmentStatus = searchParams.get("employmentStatus") || "";
    if (employmentStatus) {
      where.employmentStatus = employmentStatus;
    }

    const select = {
      id: true,
      username: true,
      realName: true,
      phone: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      idNumber: true,
      birthDate: true,
      position: true,
      employmentStatus: true,
      hireDate: true,
      leaveDate: true,
      bankName: true,
      bankAccount: true,
      baseSalary: true,
      socialInsuranceBase: true,
      housingFundBase: true,
      housingFundRate: true,
      socialInsuranceCompanyRate: true,
      housingFundCompanyRate: true,
      taxDeduction: true,
      remark: true,
      createdAt: true,
      updatedAt: true,
      lastModifiedBy: true,
    };

    const [employees, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      data: employees,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取员工列表失败:", error);
    return NextResponse.json({ error: "获取员工列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentUser = await getCurrentUser();
    const { username, realName, phone, email, role, department,
      idNumber, birthDate, position, employmentStatus, hireDate,
      bankName, bankAccount, baseSalary, socialInsuranceBase,
      housingFundBase, housingFundRate, socialInsuranceCompanyRate,
      housingFundCompanyRate, taxDeduction, remark } = body;

    if (!username || !username.trim()) {
      return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });
    }

    if (!realName || !realName.trim()) {
      return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (existingUser) {
      return NextResponse.json({ error: "该用户名已存在" }, { status: 409 });
    }

    const employee = await prisma.user.create({
      data: {
        username: username.trim(),
        password: "123456",
        realName: realName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        role: role || "staff",
        department: department || null,
        idNumber: idNumber?.trim() || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        position: position?.trim() || null,
        employmentStatus: employmentStatus || null,
        hireDate: hireDate ? new Date(hireDate) : null,
        leaveDate: null,
        bankName: bankName?.trim() || null,
        bankAccount: bankAccount?.trim() || null,
        baseSalary: baseSalary ? parseFloat(baseSalary) : null,
        socialInsuranceBase: socialInsuranceBase ? parseFloat(socialInsuranceBase) : null,
        housingFundBase: housingFundBase ? parseFloat(housingFundBase) : null,
        housingFundRate: housingFundRate ? parseFloat(housingFundRate) : null,
        socialInsuranceCompanyRate: socialInsuranceCompanyRate ? parseFloat(socialInsuranceCompanyRate) : null,
        housingFundCompanyRate: housingFundCompanyRate ? parseFloat(housingFundCompanyRate) : null,
        taxDeduction: taxDeduction ? parseFloat(taxDeduction) : null,
        remark: remark?.trim() || null,
        lastModifiedBy: currentUser?.realName || null,
      },
      select: {
        id: true,
        username: true,
        realName: true,
        phone: true,
        email: true,
        role: true,
        department: true,
        isActive: true,
        idNumber: true,
        birthDate: true,
        position: true,
        employmentStatus: true,
        hireDate: true,
        leaveDate: true,
        bankName: true,
        bankAccount: true,
        baseSalary: true,
        socialInsuranceBase: true,
        housingFundBase: true,
        housingFundRate: true,
        socialInsuranceCompanyRate: true,
        housingFundCompanyRate: true,
        taxDeduction: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
        lastModifiedBy: true,
      },
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (error) {
    console.error("创建员工失败:", error);
    return NextResponse.json({ error: "创建员工失败" }, { status: 500 });
  }
}
