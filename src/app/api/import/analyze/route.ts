// src/app/api/import/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseExcel } from "@/lib/import/excel-parser";
import { analyzeExcel } from "@/lib/import/ai-mapper";
import { getRegisteredModules, getModuleConfig } from "@/lib/import/module-registry";
import type { AnalyzeResult } from "@/lib/import/types";

/**
 * POST /api/import/analyze
 * 上传 Excel 文件，AI 自动分析表头映射
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.username !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "请上传文件" }, { status: 400 });
    }

    const results: AnalyzeResult[] = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const fileName = file.name;

      try {
        const parsed = parseExcel(buffer);
        if (parsed.rowCount === 0) {
          // 空文件跳过
          continue;
        }

        const { result } = analyzeExcel(buffer, fileName);
        if (result) {
          results.push({
            ...result,
            fileName,
          });
        }
      } catch {
        // 跳过无法解析的文件
        continue;
      }
    }

    // 返回可用模块列表
    const availableModules = getRegisteredModules().map((m) => {
      const cfg = getModuleConfig(m);
      return {
        module: m,
        name: cfg.moduleName,
        dependsOn: cfg.dependsOn,
        fields: cfg.fields.map((f) => ({
          field: f.field,
          label: f.label,
          type: f.type,
          required: f.required,
        })),
      };
    });

    return NextResponse.json({
      results,
      availableModules,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `分析失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
