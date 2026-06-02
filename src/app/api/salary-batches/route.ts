import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const batchSelect = {
  id: true,
  batchNo: true,
  period: true,
  title: true,
  employeeCount: true,
  totalGrossSalary: true,
  totalSocialInsurancePersonal: true,
  totalSocialInsuranceCompany: true,
  totalHousingFundPersonal: true,
  totalHousingFundCompany: true,
  totalIncomeTax: true,
  totalOtherDeduction: true,
  totalNetSalary: true,
  totalBankOutflow: true,
  status: true,
  approvalInstanceId: true,
  bankAccountId: true,
  paymentMethod: true,
  paidAt: true,
  remark: true,
  createdAt: true,
  updatedAt: true,
  lastModifiedBy: true,
  items: {
    include: {
      employee: { select: { id: true, realName: true, username: true } },
    },
    orderBy: { employee: { realName: "asc" as const } },
  },
  bankAccount: {
    select: { id: true, accountName: true, bankName: true, accountNo: true },
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const period = searchParams.get("period") || "";
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { batchNo: { contains: search, mode: "insensitive" } },
      ];
    }
    if (period) where.period = period;
    if (status) where.status = status;

    const [batches, total] = await Promise.all([
      prisma.salaryBatch.findMany({
        where,
        select: batchSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salaryBatch.count({ where }),
    ]);

    return NextResponse.json({
      data: batches,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("获取工资批次列表失败:", error);
    return NextResponse.json({ error: "获取工资批次列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    const body = await request.json();
    const { period, title, employeeIds, remark } = body;

    if (!period) return NextResponse.json({ error: "请选择工资周期" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "请输入批次名称" }, { status: 400 });
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: "请选择发放员工" }, { status: 400 });
    }

    const employees = await prisma.user.findMany({
      where: { id: { in: employeeIds }, isActive: true, employmentStatus: { in: ["active", "probation"] } },
      select: {
        id: true,
        realName: true,
        baseSalary: true,
        socialInsuranceBase: true,
        housingFundBase: true,
        housingFundRate: true,
        socialInsuranceCompanyRate: true,
        housingFundCompanyRate: true,
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: "未找到有效的在职员工" }, { status: 400 });
    }

    const count = await prisma.salaryBatch.count({ where: { period } });
    const batchNo = `SB${period.replace("-", "")}-${String(count + 1).padStart(3, "0")}`;

    const items = employees.map((emp) => {
      const baseSalary = Number(emp.baseSalary || 0);
      const socialBase = Number(emp.socialInsuranceBase || 0);
      const hfBase = Number(emp.housingFundBase || 0);
      const hfRate = Number(emp.housingFundRate || 0);
      const siCompanyRate = Number(emp.socialInsuranceCompanyRate || 0);
      const hfCompanyRate = Number(emp.housingFundCompanyRate || 0);

      const siPersonal = Math.round(socialBase * 0.105 * 100) / 100;
      const hfPersonal = Math.round(hfBase * hfRate * 100) / 100;
      const siCompany = Math.round(socialBase * siCompanyRate * 100) / 100;
      const hfCompany = Math.round(hfBase * hfCompanyRate * 100) / 100;

      const grossSalary = baseSalary;
      const totalDeduction = siPersonal + hfPersonal;
      const netSalary = Math.round((grossSalary - totalDeduction) * 100) / 100;

      return {
        employeeId: emp.id,
        baseSalary,
        grossSalary,
        socialInsurancePersonal: siPersonal,
        socialInsuranceCompany: siCompany,
        housingFundPersonal: hfPersonal,
        housingFundCompany: hfCompany,
        totalDeduction,
        netSalary,
      };
    });

    const totalGrossSalary = items.reduce((s, i) => s + i.baseSalary, 0);
    const totalSIPersonal = items.reduce((s, i) => s + i.socialInsurancePersonal, 0);
    const totalSICompany = items.reduce((s, i) => s + i.socialInsuranceCompany, 0);
    const totalHFPersonal = items.reduce((s, i) => s + i.housingFundPersonal, 0);
    const totalHFCompany = items.reduce((s, i) => s + i.housingFundCompany, 0);
    const totalNetSalary = items.reduce((s, i) => s + i.netSalary, 0);
    const totalBankOutflow = totalNetSalary + totalSIPersonal + totalSICompany + totalHFPersonal + totalHFCompany;

    const batch = await prisma.salaryBatch.create({
      data: {
        batchNo,
        period,
        title,
        employeeCount: employees.length,
        totalGrossSalary,
        totalSocialInsurancePersonal: totalSIPersonal,
        totalSocialInsuranceCompany: totalSICompany,
        totalHousingFundPersonal: totalHFPersonal,
        totalHousingFundCompany: totalHFCompany,
        totalNetSalary,
        totalBankOutflow,
        remark: remark?.trim() || null,
        lastModifiedBy: currentUser?.realName || null,
        items: { create: items },
      },
      select: batchSelect,
    });

    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (error) {
    console.error("创建工资批次失败:", error);
    return NextResponse.json({ error: "创建工资批次失败" }, { status: 500 });
  }
}
