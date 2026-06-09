// src/app/api/import/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseExcel } from "@/lib/import/excel-parser";
import { analyzeExcel } from "@/lib/import/ai-mapper";
import { getModuleConfig } from "@/lib/import/module-registry";
import { buildPreviewRows, validateRequired } from "@/lib/import/writers/base";
import type { ImportModule, PreviewRow } from "@/lib/import/types";

/**
 * POST /api/import/preview
 * 上传文件并预览解析+校验结果
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.username !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const moduleStr = formData.get("module") as string;

    if (!file || !moduleStr) {
      return NextResponse.json({ error: "缺少文件或模块参数" }, { status: 400 });
    }

    const module = moduleStr as ImportModule;
    const config = getModuleConfig(module);
    if (!config) {
      return NextResponse.json({ error: `未知模块: ${module}` }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseExcel(buffer);

    if (parsed.rowCount === 0) {
      return NextResponse.json({ error: "文件无数据" }, { status: 400 });
    }

    // AI 分析列映射
    const { result: mapping } = analyzeExcel(buffer, file.name);

    // 构建预览行
    const requiredFields = config.fields.filter((f) => f.required).map((f) => f.field);
    const previewRows: PreviewRow[] = parsed.rows.map((row, idx) => {
      const errors = validateRequired(row, requiredFields);
      // 额外校验日期格式
      for (const field of config.fields) {
        if (field.type === "date" && row[field.field]) {
          const val = row[field.field];
          if (val && isNaN(Date.parse(val))) {
            errors.push({
              field: field.field,
              message: `${field.label} 日期格式错误，请使用 yyyy-MM-dd`,
              type: "format",
            });
          }
        }
        if (field.type === "decimal" && row[field.field]) {
          const val = Number(row[field.field]);
          if (isNaN(val)) {
            errors.push({
              field: field.field,
              message: `${field.label} 金额格式错误`,
              type: "format",
            });
          }
        }
      }

      return {
        rowIndex: idx + 1,
        data: row as Record<string, unknown>,
        errors,
        warnings: [],
      };
    });

    return NextResponse.json({
      module,
      moduleName: config.moduleName,
      headers: parsed.headers,
      mappings: mapping,
      previewRows,
      totalRows: parsed.rowCount,
      errorRows: previewRows.filter((r) => r.errors.length > 0).length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `预览失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
