import { Injectable, Logger } from '@nestjs/common';
import { loadConfig } from '../../config/env';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

export interface ChatResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

/** Provider abstraction so Mistral can be replaced by another model without touching callers. */
export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
}

export class LlmUnavailableError extends Error {}

/** Mistral chat-completions provider. The API key never leaves the server. */
export class MistralProvider implements LLMProvider {
  readonly name = 'mistral';
  private readonly logger = new Logger(MistralProvider.name);

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 900,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`Mistral error ${res.status}: ${text.slice(0, 200)}`);
        throw new LlmUnavailableError(`AI provider returned ${res.status}`);
      }
      const body = (await res.json()) as { choices: { message: { content: string } }[]; model: string; usage?: { prompt_tokens: number; completion_tokens: number } };
      return { content: body.choices[0]?.message?.content ?? '', model: body.model, promptTokens: body.usage?.prompt_tokens, completionTokens: body.usage?.completion_tokens };
    } catch (e) {
      if (e instanceof LlmUnavailableError) throw e;
      throw new LlmUnavailableError(`AI provider unreachable: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

@Injectable()
export class LlmRegistry {
  private provider: LLMProvider | null | undefined;

  /** Returns the configured provider, or null when no API key is configured. */
  get(): LLMProvider | null {
    if (this.provider !== undefined) return this.provider;
    const cfg = loadConfig();
    this.provider = cfg.mistralApiKey ? new MistralProvider(cfg.mistralApiKey, cfg.mistralModel, cfg.mistralBaseUrl) : null;
    return this.provider;
  }

  /** For tests. */
  set(p: LLMProvider | null) {
    this.provider = p;
  }

  status() {
    const p = this.get();
    return { configured: !!p, provider: p?.name ?? null, model: p?.model ?? null };
  }
}
