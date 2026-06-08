import { NextRequest, NextResponse } from "next/server";
import { getAIConfig, callAIModel } from "@/lib/ai";
import { getOSSClient } from "@/lib/oss";

const SYSTEM_PROMPT = `你是一个专业的合同风险审查助手。请对提供的合同草稿文件进行风险审查，并以 JSON 格式输出审查结果。

注意：审查对象为合同草稿件（未签章），不检查签章和签订日期。

输出格式：
{
  "riskLevel": "low" | "medium" | "high",
  "riskSummary": "总体风险评估（不超过100字）",
  "items": [
    {
      "category": "关键条款风险",
      "riskLevel": "low" | "medium" | "high",
      "detail": "具体风险说明"
    },
    {
      "category": "付款条款风险",
      "riskLevel": "low" | "medium" | "high",
      "detail": "具体风险说明"
    },
    {
      "category": "合同完整性",
      "riskLevel": "low" | "medium" | "high",
      "detail": "缺失要素说明（不含签章和日期）"
    },
    {
      "category": "合规提示",
      "riskLevel": "low" | "medium" | "high",
      "detail": "合规注意事项"
    }
  ]
}

审查要求：
1. 关键条款风险：检查违约金比例是否过高（通常不超过合同总额的20%）、责任条款是否对等、有无无限责任条款
2. 付款条款风险：检查付款节点是否合理、有无大额预付款风险、付款条件是否清晰
3. 合同完整性：检查合同标的、金额、双方主体信息、履行期限等核心要素是否齐全（不检查签章和签订日期）
4. 合规提示：检查税率是否明确、质保期是否约定等合规事项
5. 如某项无风险，riskLevel 为 "low"，detail 说明"未发现明显风险"
6. 严格按照 JSON 格式输出，不要输出其他内容`;

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
        content: `请审查以下合同草稿内容：\n\n${combinedContent}`,
      },
    ];

    const result = await callAIModel(messages, config);

    let parsed = {};

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
              riskLevel: "low",
              riskSummary: "无法解析审查结果",
              items: [],
            };
          }
        }
      }
    } else if (typeof result === "object" && result !== null) {
      parsed = result;
    }

    return NextResponse.json({ data: parsed });
  } catch (error) {
    console.error("合同审查失败:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "合同审查失败",
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
