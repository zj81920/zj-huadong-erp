import { NextRequest, NextResponse } from "next/server";
import { getAIConfig, callAIModel } from "@/lib/ai";
import { getOSSClient } from "@/lib/oss";

const SYSTEM_PROMPT = `你是一个专业的招标文件分析助手。请根据提供的招标文件内容，提取以下要点并以 Markdown 格式输出：

## 1. 项目概况
- 项目名称、项目编号、招标单位

## 2. 投标资格要求
- 资质要求、业绩要求、人员要求

## 3. 关键时间节点
- 报名截止时间、投标截止时间、开标时间

## 4. 评标方法
- 评标方式（综合评分法/最低价中标法等）、评分细则

## 5. 技术要求摘要
- 核心技术指标和参数要求

## 6. 商务条款
- 付款方式、质保期、违约责任

## 7. 投标注意事项
- 保证金金额及缴纳方式、投标文件格式要求

请严格按照以上格式输出，如果文件中某些信息未提及，标注"文件中未明确"。`;

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
        { error: "请先上传招标文件" },
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
        content: `请分析以下招标文件内容：\n\n${combinedContent}`,
      },
    ];

    const result = await callAIModel(messages, config);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("招标文件解析失败:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "招标文件解析失败",
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
      // 防止路径遍历
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
        const result = await client.get(key);
        const content = result.content?.toString("utf-8");
        return content || null;
      }
    }

    // 只允许 OSS 域名，禁止对任意 URL 发起请求（SSRF 防护）
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
