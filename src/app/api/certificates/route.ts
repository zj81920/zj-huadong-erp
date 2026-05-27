import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const certType = searchParams.get("certType") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { certNo: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (certType) {
      where.certType = certType;
    }

    const [data, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.certificate.count({ where }),
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
    console.error("获取证照列表失败:", error);
    return NextResponse.json({ error: "获取证照列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, certNo, certType, issuer, issueDate, expireDate, holder, status, location, remark } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "证照名称不能为空" }, { status: 400 });
    }

    const certificate = await prisma.certificate.create({
      data: {
        name: name.trim(),
        certNo: certNo?.trim() || null,
        certType: certType || null,
        issuer: issuer?.trim() || null,
        issueDate: issueDate ? new Date(issueDate) : null,
        expireDate: expireDate ? new Date(expireDate) : null,
        holder: holder?.trim() || null,
        status: status || "有效",
        location: location?.trim() || null,
        remark: remark?.trim() || null,
      },
    });

    return NextResponse.json({ data: certificate }, { status: 201 });
  } catch (error) {
    console.error("创建证照失败:", error);
    return NextResponse.json({ error: "创建证照失败" }, { status: 500 });
  }
}
