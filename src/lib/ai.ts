import prisma from "@/lib/prisma";

interface AIConfig {
  modelId: string;
  apiKey: string;
  baseUrl: string;
}

interface EmbeddingConfig {
  modelId: string;
  apiKey: string;
  baseUrl: string;
}

export async function getAIConfig(): Promise<AIConfig | null> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { in: ["ai_model_id", "ai_api_key", "ai_base_url"] },
    },
  });

  const map: Record<string, string> = {};
  settings.forEach((s) => {
    map[s.key] = s.value;
  });

  if (!map.ai_model_id || !map.ai_api_key || !map.ai_base_url) {
    return null;
  }

  return {
    modelId: map.ai_model_id,
    apiKey: map.ai_api_key,
    baseUrl: map.ai_base_url,
  };
}

// 获取独立的 Embedding 向量模型配置
export async function getEmbeddingConfig(): Promise<EmbeddingConfig | null> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { in: ["ai_embedding_model", "ai_embedding_api_key", "ai_embedding_base_url"] },
    },
  });

  const map: Record<string, string> = {};
  settings.forEach((s) => {
    map[s.key] = s.value;
  });

  if (!map.ai_embedding_model || !map.ai_embedding_api_key || !map.ai_embedding_base_url) {
    return null;
  }

  return {
    modelId: map.ai_embedding_model,
    apiKey: map.ai_embedding_api_key,
    baseUrl: map.ai_embedding_base_url,
  };
}

export async function callAIModel(
  messages: Array<{ role: string; content: unknown }>,
  config?: AIConfig
): Promise<string> {
  const aiConfig = config || (await getAIConfig());
  if (!aiConfig) {
    throw new Error("AI 模型未配置，请在系统设置中配置模型参数");
  }

  const { modelId, apiKey, baseUrl } = aiConfig;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI 模型调用失败 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/** 流式调用 AI 模型，返回 ReadableStream<string>，每个 chunk 是文本片段 */
export async function callAIModelStream(
  messages: Array<{ role: string; content: unknown }>,
  config?: AIConfig
): Promise<ReadableStream<string>> {
  const aiConfig = config || (await getAIConfig());
  if (!aiConfig) {
    throw new Error("AI 模型未配置，请在系统设置中配置模型参数");
  }

  const { modelId, apiKey, baseUrl } = aiConfig;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI 模型调用失败 (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("AI 模型响应无 body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<string>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(content);
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      } catch (e: any) {
        controller.error(e);
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

// Embedding：将文本转为向量（带重试和退避）
export async function getEmbedding(text: string, retryCount = 0): Promise<number[]> {
  // 优先使用独立的 Embedding 模型配置
  let embedConfig = await getEmbeddingConfig();
  let baseUrl: string;
  let apiKey: string;
  let model: string;

  if (embedConfig) {
    baseUrl = embedConfig.baseUrl.replace(/\/+$/, '');
    apiKey = embedConfig.apiKey;
    model = embedConfig.modelId;
  } else {
    // 没有独立 embedding 配置时，回退到对话模型
    const chatConfig = await getAIConfig();
    if (!chatConfig) {
      throw new Error('Embedding 模型未配置，请在系统设置中配置向量模型参数');
    }
    baseUrl = chatConfig.baseUrl.replace(/\/+$/, '');
    apiKey = chatConfig.apiKey;
    const isDashscope = baseUrl.includes('dashscope');
    model = isDashscope ? 'text-embedding-v2' : 'text-embedding-3-small';
  }

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      encoding_format: 'float',
      dimensions: 1536,
    }),
  });

  if (response.status === 429 && retryCount < 5) {
    const delay = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 30000);
    await new Promise(r => setTimeout(r, delay));
    return getEmbedding(text, retryCount + 1);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Embedding API error: ${response.status} ${response.statusText}${errText ? ' - ' + errText : ''}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  // 串行调用来避免触发限流，chunk 之间加 200ms 延迟
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    if (i > 0) {
      await new Promise(r => setTimeout(r, 200));
    }
    results.push(await getEmbedding(texts[i]));
  }
  return results;
}
