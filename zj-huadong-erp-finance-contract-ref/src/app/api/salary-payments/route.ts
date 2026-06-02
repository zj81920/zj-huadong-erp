import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "";
    const status = searchParams.get("status") || "";
    const employeeId = searchParams.get("employeeId") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (period) {
      where.period = period;
    }

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const [data, total] = await Promise.all([
      prisma.salaryPayment.findMany({
        where,
        include: {
          employee: {
            select: { realName: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salaryPayment.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("获取工资发放列表失败:", error);
    return NextResponse.json(
      { error: "获取工资发放列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employeeId,
      period,
      baseSalary,
      bonus,
      allowance,
      deduction,
      netSalary,
      paymentDate,
      remark,
    } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: "必须提供员工" },
        { status: 400 }
      );
    }

    if (!period) {
      return NextResponse.json(
        { error: "必须提供工资期间" },
        { status: 400 }
      );
    }

    if (!baseSalary || parseFloat(baseSalary) < 0) {
      return NextResponse.json(
        { error: "基本工资不能为空或负数" },
        { status: 400 }
      );
    }

    if (netSalary === undefined || netSalary === null || parseFloat(netSalary) < 0) {
      return NextResponse.json(
        { error: "实发工资不能为空或负数" },
        { status: 400 }
      );
    }

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "员工不存在" },
        { status: 400 }
      );
    }

    const record = await prisma.salaryPayment.create({
      data: {
        employeeId,
        period,
        baseSalary: parseFloat(baseSalary),
        bonus: bonus ? parseFloat(bonus) : 0,
        allowance: allowance ? parseFloat(allowance) : 0,
        deduction: deduction ? parseFloat(deduction) : 0,
        netSalary: parseFloat(netSalary),
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        remark: remark?.trim() || null,
      },
      include: {
        employee: {
          select: { realName: true, username: true },
        },
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("创建工资发放失败:", error);
    return NextResponse.json(
      { error: "创建工资发放失败" },
      { status: 500 }
    );
  }
}
