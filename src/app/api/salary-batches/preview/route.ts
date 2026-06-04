import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 提取薪酬计算逻辑，供 POST 和 preview 复用
function calculateSalaryItems(employees: any[]) {
  return employees.map((emp) => {
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
      employee: { id: emp.id, realName: emp.realName, username: emp.username },
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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "";
    const employeeIdsParam = searchParams.get("employeeIds");

    const where: Record<string, unknown> = {
      isActive: true,
      employmentStatus: { in: ["active", "probation"] },
    };

    if (employeeIdsParam) {
      where.id = { in: employeeIdsParam.split(",") };
    }

    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        realName: true,
        username: true,
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

    const items = calculateSalaryItems(employees);

    // 生成批次号（预览用）
    const count = await prisma.salaryBatch.count({ where: { period } });
    const batchNo = `SB${period.replace("-", "")}-${String(count + 1).padStart(3, "0")}`;

    const totalGrossSalary = items.reduce((s, i) => s + i.grossSalary, 0);
    const totalSIPersonal = items.reduce((s, i) => s + i.socialInsurancePersonal, 0);
    const totalSICompany = items.reduce((s, i) => s + i.socialInsuranceCompany, 0);
    const totalHFPersonal = items.reduce((s, i) => s + i.housingFundPersonal, 0);
    const totalHFCompany = items.reduce((s, i) => s + i.housingFundCompany, 0);
    const totalNetSalary = items.reduce((s, i) => s + i.netSalary, 0);
    const totalBankOutflow = totalNetSalary + totalSIPersonal + totalSICompany + totalHFPersonal + totalHFCompany;

    return NextResponse.json({
      data: {
        batchNo,
        period,
        employeeCount: employees.length,
        totalGrossSalary,
        totalSocialInsurancePersonal: totalSIPersonal,
        totalSocialInsuranceCompany: totalSICompany,
        totalHousingFundPersonal: totalHFPersonal,
        totalHousingFundCompany: totalHFCompany,
        totalNetSalary,
        totalBankOutflow,
        items,
      },
    });
  } catch (error) {
    console.error("获取薪酬预览失败:", error);
    return NextResponse.json({ error: "获取薪酬预览失败" }, { status: 500 });
  }
}
