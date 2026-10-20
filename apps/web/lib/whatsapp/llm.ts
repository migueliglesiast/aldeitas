export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type ToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

type Provider = { baseUrl: string; apiKey: string; model: string };

/** OpenAI-compatible providers, primary first. Defaults: Groq (Qwen), then Z.ai (GLM Flash); both have free tiers. */
export function configuredProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.AGENT_LLM_API_KEY) {
    providers.push({
      baseUrl: process.env.AGENT_LLM_BASE_URL || "https://api.groq.com/openai/v1",
      apiKey: process.env.AGENT_LLM_API_KEY,
      model: process.env.AGENT_LLM_MODEL || "qwen/qwen3.8-27b",
    });
  }
  if (process.env.AGENT_LLM_FALLBACK_API_KEY) {
    providers.push({
      baseUrl: process.env.AGENT_LLM_FALLBACK_BASE_URL || "https://api.z.ai/api/paas/v4",
      apiKey: process.env.AGENT_LLM_FALLBACK_API_KEY,
      model: process.env.AGENT_LLM_FALLBACK_MODEL || "glm-4.7-flash",
    });
  }
  return providers;
}

export type ChatResult = { content: string | null; toolCalls: ToolCall[] };

async function callProvider(provider: Provider, messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatResult> {
  const res = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(Number(process.env.AGENT_LLM_TIMEOUT_MS) || 20000),
  });
  if (!res.ok) throw new Error(`${provider.model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  };
  const message = data.choices?.[0]?.message;
  const content = message?.content?.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || null;
  return { content, toolCalls: message?.tool_calls ?? [] };
}

export async function chatCompletion(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatResult> {
  const providers = configuredProviders();
  if (providers.length === 0) throw new Error("no LLM provider configured");
  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await callProvider(provider, messages, tools);
    } catch (error) {
      lastError = error;
      console.error("[whatsapp-agent] LLM provider failed", error);
    }
  }
  throw lastError;
}
