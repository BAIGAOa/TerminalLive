/**
 * The one place that talks to DeepSeek.
 *
 * Deliberately small and dependency-free: Node 18+ ships a global `fetch`, and
 * the chat-completions shape is stable enough that a client library would only
 * add weight. Everything about the *prompt* lives in
 * `src/world/careers/interview.ts`; this file only moves bytes.
 *
 * Failures are returned, never thrown — a bad key or a dead network is a normal
 * thing to happen mid-game and must not take the TUI down with it.
 */

import type { ChatMessage } from "../../world/careers/interview.js";

export const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-chat";

/** Why a call failed, so the UI can say something more useful than "error". */
export type DeepSeekErrorKind =
  /** No key configured, or the key was rejected (401/403). */
  | "auth"
  /** The request never got a reply: offline, DNS, timeout. */
  | "network"
  /** The endpoint answered with a non-2xx status. */
  | "http"
  /** A reply arrived, but without the content we asked for. */
  | "shape";

export type DeepSeekResult =
  | { ok: true; text: string }
  | { ok: false; kind: DeepSeekErrorKind; error: string; status?: number };

export interface DeepSeekOptions {
  /** Milliseconds before the request is abandoned. Default 30s. */
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

/** Ask the model once, and return its first message's text. */
export async function deepseekChat(
  apiKey: string,
  messages: ChatMessage[],
  options: DeepSeekOptions = {},
): Promise<DeepSeekResult> {
  const key = apiKey.trim();
  if (!key) return { ok: false, kind: "auth", error: "No API key configured." };

  const doFetch = options.fetchImpl ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    return { ok: false, kind: "network", error: "This runtime has no fetch()." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  let response: Response;
  try {
    response = await doFetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 400,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = (err as { name?: string }).name === "AbortError";
    return {
      ok: false,
      kind: "network",
      error: aborted ? "The interviewer timed out." : String((err as Error).message ?? err),
    };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      kind: response.status === 401 || response.status === 403 ? "auth" : "http",
      status: response.status,
      error: body.slice(0, 200) || `HTTP ${response.status}`,
    };
  }

  let data: ChatCompletionResponse;
  try {
    data = (await response.json()) as ChatCompletionResponse;
  } catch (err) {
    return { ok: false, kind: "shape", error: String((err as Error).message ?? err) };
  }

  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    return { ok: false, kind: "shape", error: "The reply carried no message content." };
  }
  return { ok: true, text };
}
