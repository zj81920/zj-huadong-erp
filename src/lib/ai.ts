import prisma from "@/lib/prisma";

interface AIConfig {
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
