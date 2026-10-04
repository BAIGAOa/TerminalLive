import z from "zod";
import { modEventSchema } from "../../types/EventJsonType.js";

/**
 * Validation for mod-authored event JSON, using the SAME schema the game loads
 * with (`modEventSchema`) so `validate-event` can't disagree with the loader.
 * Pure and testable.
 */

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function format(error: z.ZodError): string[] {
  return error.issues.map(
    (i) => `${i.path.length ? i.path.join(".") : "<root>"}: ${i.message}`,
  );
}

export function validateEventJson(raw: unknown): ValidationResult {
  const parsed = modEventSchema.safeParse(raw);
  return parsed.success
    ? { ok: true, errors: [] }
    : { ok: false, errors: format(parsed.error) };
}

/** Validate one event or an array of events (a whole mod events file). */
export function validateEventFile(raw: unknown): ValidationResult {
  const entries = Array.isArray(raw) ? raw : [raw];
  const errors: string[] = [];
  entries.forEach((entry, i) => {
    const r = validateEventJson(entry);
    if (!r.ok) errors.push(...r.errors.map((m) => `[${i}] ${m}`));
  });
  return { ok: errors.length === 0, errors };
}
