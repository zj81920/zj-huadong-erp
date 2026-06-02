import { NextRequest, NextResponse } from "next/server";
import { getAIConfig, callAIModel } from "@/lib/ai";
import { getOSSClient } from "@/lib/oss";

const SYSTEM_PROMPT = `你是一个专业的合同分析助手。请根据提供的合同文件内容，提取以下信息并以 JSON 格式输出：

{
  "summary": "合同概要（不超过300字，包括合同类型、甲乙方、合同标的、合同期限、关键条款等核心内容的精要总结）",
  "paymentTerms": "付款方式（列出合同中约定的付款方式、付款节点、付款比例等信息）"
}

要求：
1. summary 不超过300字
2. 如果文件中未明确付款方式，paymentTerms 输出"文件中未明确付款方式"
3. 严格按照 JSON 格式输出，不要输出其他内容`;

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
        { error: "请先上传合同文件" },
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
        content: `请分析以下合同文件内容：\n\n${combinedContent}`,
      },
    ];

    const result = await callAIModel(messages, config);

    let parsed: { summary?: string; paymentTerms?: string } = {};

    if (typeof result === "string") {
      try {
        parsed = JSON.parse(result);
      } catch {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            parsed = {
              summary: result,
              paymentTerms: "文件中未明确付款方式",
            };
          }
        } else {
          parsed = {
            summary: result,
            paymentTerms: "文件中未明确付款方式",
          };
        }
      }
    } else if (typeof result === "object" && result !== null) {
      parsed = result as { summary?: string; paymentTerms?: string };
    }

    return NextResponse.json({
      data: {
        summary: parsed.summary || "未能提取合同概要",
        paymentTerms: parsed.paymentTerms || "文件中未明确付款方式",
      },
    });
  } catch (error) {
    console.error("合同文件解析失败:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "合同文件解析失败",
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
      const filePath = path.join(process.cwd(), url);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
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

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      return await response.text();
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
