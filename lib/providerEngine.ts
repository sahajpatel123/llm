import crypto from "crypto";

type ProviderKey = "A" | "B";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type Mode = "exploration" | "verified";

type ProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

function getMode(): "mock" | "live" {
  const mode = (process.env.PROVIDER_MODE ?? "mock").toLowerCase();
  return mode === "live" ? "live" : "mock";
}

export function getProviderMode() {
  return getMode();
}

function getProviderConfig(key: ProviderKey): ProviderConfig | null {
  const suffix = key === "A" ? "A" : "B";
  const baseUrl = process.env[`PROVIDER_${suffix}_BASE_URL`] ?? "";
  const apiKey = process.env[`PROVIDER_${suffix}_API_KEY`] ?? "";
  const model = process.env[`PROVIDER_${suffix}_MODEL`] ?? "";
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl, apiKey, model };
}

export function isLiveConfigured(key: ProviderKey) {
  return Boolean(getProviderConfig(key));
}

function getSystemPrompt(mode: Mode) {
  if (mode === "verified") {
    return "You are a careful assistant. Provide: (1) key claim, (2) reasoning, (3) uncertainty/assumptions, (4) what would change the conclusion. Keep it concise.";
  }
  return "You are a helpful assistant. Be concise and clear.";
}

function getMaxTokens(mode: Mode) {
  const raw = mode === "verified" ? process.env.MAX_OUTPUT_TOKENS_VERIFIED : process.env.MAX_OUTPUT_TOKENS_EXPLORATION;
  const fallback = mode === "verified" ? 1200 : 900;
  const parsed = Number(raw ?? fallback);
  return Math.min(2000, Math.max(300, Number.isFinite(parsed) ? parsed : fallback));
}

function getTemperature(mode: Mode) {
  return mode === "verified" ? 0.2 : 0.7;
}

function deterministicSeed(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 8);
}

function mockResponse(key: ProviderKey, userMessage: string, mode: Mode) {
  const seed = deterministicSeed(`${key}-${mode}-${userMessage}`);
  if (key === "A") {
    return `Summary (${seed}): ${userMessage.slice(0, 120)}\n\n- Point 1: ...\n- Point 2: ...\n- Next: ...`;
  }
  return `Answer (${seed}): ${userMessage.slice(0, 140)}\n\nKey idea: ...`;
}

export async function generateFromProvider(
  key: ProviderKey,
  messages: ChatMessage[],
  mode: Mode,
): Promise<string> {
  const providerMode = getMode();
  const userMessage = [...messages].reverse().find((msg) => msg.role === "user")?.content ?? "";

  if (providerMode === "mock") {
    return mockResponse(key, userMessage, mode);
  }

  const config = getProviderConfig(key);
  if (!config) {
    throw new Error("provider_not_configured");
  }

  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const payload = {
    model: config.model,
    messages: [{ role: "system", content: getSystemPrompt(mode) }, ...messages],
    temperature: getTemperature(mode),
    max_tokens: getMaxTokens(mode),
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("provider_error");
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("provider_error");
  }

  return content;
}
