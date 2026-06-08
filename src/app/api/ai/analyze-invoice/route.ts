import { NextRequest, NextResponse } from "next/server";
import { getAIConfig, callAIModel } from "@/lib/ai";
import { getOSSClient } from "@/lib/oss";
import { parseInvoiceFromAI, extractInvoiceJSON } from "@/lib/invoice-parser";

const SYSTEM_PROMPT = `你是一个专业的发票识别助手。请识别提供的发票文件内容，提取以下信息并以 JSON 格式输出：

{
  "invoiceNo": "发票号码",
  "invoiceCode": "发票代码",
  "invoiceType": "发票类型（增值税专用发票/增值税普通发票等）",
  "invoiceDate": "开票日期（YYYY-MM-DD）",
  "amountWithoutTax": 不含税金额（数字）,
  "taxRate": 税率（数字，如6表示6%）,
  "taxAmount": 税额（数字）,
  "totalAmount": 价税合计（数字）,
  "sellerName": "销方名称",
  "sellerTaxNo": "销方纳税人识别号",
  "buyerName": "购方名称",
  "buyerTaxNo": "购方纳税人识别号",
  "remark": "备注"
}

要求：
1. 所有金额字段必须为数字类型，不要包含单位或货币符号
2. 税率为百分比数字（如 6 表示 6%）
3. 日期格式为 YYYY-MM-DD
4. 如果某字段无法识别，使用空字符串（金额类使用 0）
5. 严格按照 JSON 格式输出，不要输出其他内容`;

export async function POST(request: NextRequest) {
  try {
    const config = await getAIConfig();
    if (!config) {
      return NextResponse.json(
        { error: "AI 模型未配置，请在系统设置中配置模型参数" },
        { status: 400 }
      );
    }

    const { fileUrls } = (await request.json()) as { fileUrls: string[] };

    if (!fileUrls || fileUrls.length === 0) {
      return NextResponse.json(
        { error: "请先上传发票文件" },
        { status: 400 }
      );
    }

    const fileContents: string[] = [];

    for (const url of fileUrls) {
      try {
        const content = await fetchFileContent(url);
        if (content) {
          fileContents.push(content);
        }
      } catch (err) {
        console.error("读取文件失败:", url, err);
      }
    }

    if (fileContents.length === 0) {
      return NextResponse.json(
        { error: "无法读取文件内容，请确认文件格式正确" },
        { status: 400 }
      );
    }

    const combinedContent = fileContents.join("\n\n---\n\n");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `请识别以下发票文件内容：\n\n${combinedContent}`,
      },
    ];

    const result = await callAIModel(messages, config);

    let raw: Record<string, unknown> = {};

    if (typeof result === "string") {
      raw = extractInvoiceJSON(result) || {};
    } else if (typeof result === "object" && result !== null) {
      raw = result as Record<string, unknown>;
    }

    const data = parseInvoiceFromAI(raw);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("发票识别失败:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "发票识别失败",
      },
      { status: 500 }
    );
  }
}

async function fetchFileContent(url: string): Promise<string | null> {
  try {
    if (url.startsWith("/uploads/")) {
      const fs = await import("fs");
      const path = await import("path");
      const realPath = path.resolve(process.cwd(), url);
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      if (!realPath.startsWith(uploadsDir)) return null;
      if (fs.existsSync(realPath)) {
        const buffer = fs.readFileSync(realPath);
        return buffer.toString("utf-8");
      }
      return null;
    }

    if (url.includes("aliyuncs.com")) {
      const client = getOSSClient();
      const key = extractOSSKey(url);
      if (key) {
        const ossResult = await client.get(key);
        const content = ossResult.content?.toString("utf-8");
        return content || null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function extractOSSKey(url: string): string | null {
  try {
    const u = new URL(url);
    const pathPart = u.pathname.startsWith("/") ? u.pathname.slice(1) : u.pathname;
    return pathPart || null;
  } catch {
    const match = url.match(/\.com\/(.+)/);
    return match ? match[1] : null;
  }
}
