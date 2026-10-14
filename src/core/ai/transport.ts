import {
  deepseekChat,
  type DeepSeekOptions,
  type DeepSeekResult,
} from "./deepseek.js";
import type { ChatMessage } from "../../world/careers/interview.js";

/**
 * The seam every model call goes through.
 *
 * `deepseekChat` is the real thing; this is the indirection that lets a test or
 * a headless harness answer in its place. Without it, every path that talks to
 * the model — inventing a person, inventing an event, filing a letter — can only
 * be exercised with a live key and a live network, which means in practice it is
 * never exercised at all.
 *
 * A module global rather than a container service, for the same reason
 * `translator.ts` is one: the harnesses that install a fake run outside the
 * composition root's construction order.
 */
export type ChatFn = (
  apiKey: string,
  messages: ChatMessage[],
  options?: DeepSeekOptions,
) => Promise<DeepSeekResult>;

let override: ChatFn | null = null;

/** Answer in the model's place. Pass `null` to put the real one back. */
export function setChatTransport(fn: ChatFn | null): void {
  override = fn;
}

/** Ask the model — or whatever is standing in for it. */
export function chat(
  apiKey: string,
  messages: ChatMessage[],
  options?: DeepSeekOptions,
): Promise<DeepSeekResult> {
  return (override ?? deepseekChat)(apiKey, messages, options);
}
