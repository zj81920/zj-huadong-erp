import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
  aiFileSearch: true,
  createdAt: true,
  updatedAt: true,
  lastModifiedBy: true,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.user.findUnique({
      where: { id },
      select,
    });

    if (!employee) {
      return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    }

    return NextResponse.json({ data: employee });
  } catch (error) {
    console.error("获取员工详情失败:", error);
    return NextResponse.json({ error: "获取员工详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { realName, phone, email, role, department, isActive,
      idNumber, birthDate, position, employmentStatus, hireDate,
      leaveDate, bankName, bankAccount, baseSalary, socialInsuranceBase,
      housingFundBase, housingFundRate, socialInsuranceCompanyRate,
      housingFundCompanyRate, taxDeduction, remark, aiFileSearch } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    }

    if (existing?.username === "admin" && body.isActive === false) {
      return NextResponse.json({ error: "系统管理员账号不可禁用" }, { status: 403 });
    }

    const autoLeaveDate =
      (employmentStatus === "resigned" || employmentStatus === "dismissed") &&
      !leaveDate
        ? new Date()
        : leaveDate
          ? new Date(leaveDate)
          : undefined;

    const employee = await prisma.user.update({
      where: { id },
      data: {
        ...(realName !== undefined && { realName: realName.trim() }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(role !== undefined && { role }),
        ...(department !== undefined && { department: department || null }),
        ...(isActive !== undefined && { isActive }),
        ...(idNumber !== undefined && { idNumber: idNumber?.trim() || null }),
        ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
        ...(position !== undefined && { position: position?.trim() || null }),
        ...(employmentStatus !== undefined && { employmentStatus: employmentStatus || null }),
        ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
        ...(autoLeaveDate !== undefined && { leaveDate: autoLeaveDate }),
        ...(leaveDate !== undefined && autoLeaveDate === undefined && { leaveDate: leaveDate ? new Date(leaveDate) : null }),
        ...(bankName !== undefined && { bankName: bankName?.trim() || null }),
        ...(bankAccount !== undefined && { bankAccount: bankAccount?.trim() || null }),
        ...(baseSalary !== undefined && { baseSalary: baseSalary ? parseFloat(baseSalary) : null }),
        ...(socialInsuranceBase !== undefined && { socialInsuranceBase: socialInsuranceBase ? parseFloat(socialInsuranceBase) : null }),
        ...(housingFundBase !== undefined && { housingFundBase: housingFundBase ? parseFloat(housingFundBase) : null }),
        ...(housingFundRate !== undefined && { housingFundRate: housingFundRate ? parseFloat(housingFundRate) : null }),
        ...(socialInsuranceCompanyRate !== undefined && { socialInsuranceCompanyRate: socialInsuranceCompanyRate ? parseFloat(socialInsuranceCompanyRate) : null }),
        ...(housingFundCompanyRate !== undefined && { housingFundCompanyRate: housingFundCompanyRate ? parseFloat(housingFundCompanyRate) : null }),
        ...(taxDeduction !== undefined && { taxDeduction: taxDeduction ? parseFloat(taxDeduction) : null }),
        ...(remark !== undefined && { remark: remark?.trim() || null }),
        ...(aiFileSearch !== undefined && { aiFileSearch: !!aiFileSearch }),
        lastModifiedBy: (await getCurrentUser())?.realName || null,
      },
      select,
    });

    return NextResponse.json({ data: employee });
  } catch (error) {
    console.error("更新员工失败:", error);
    return NextResponse.json({ error: "更新员工失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "员工不存在" }, { status: 404 });
    }

    if (!existing.isActive) {
      return NextResponse.json({ error: "该员工已被禁用" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "员工已禁用" });
  } catch (error) {
    console.error("禁用员工失败:", error);
    return NextResponse.json({ error: "禁用员工失败" }, { status: 500 });
  }
}
