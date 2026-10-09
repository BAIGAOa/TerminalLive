import type { PluginManifest, PluginRef } from "./manifest.js";

/** How a plugin entry file is evaluated by the host. */
export type ExecutionMode = "sandbox" | "host";

/**
 * Which plugins the user has decided to trust with full access.
 *
 * The mod sandbox is defence-in-depth, not a security boundary: the host must
 * hand a plugin live game objects, so a determined plugin can escape it anyway.
 * Rather than pretend otherwise, trust is explicit — a plugin asks for it in
 * its manifest, or the user opts it in by id — and everything else stays in the
 * sandbox by default.
 */
export interface TrustPolicy {
  /** Plugin ids the user marked trusted, regardless of their manifest. */
  trusted?: readonly string[];
  /**
   * Force every plugin into the sandbox, ignoring both the manifest and the
   * trusted list. The escape hatch for "run this mod I do not trust at all".
   */
  forceSandbox?: boolean;
}

/**
 * How this plugin's entry should be evaluated. Pure: it reads the manifest and
 * the policy, nothing else.
 */
export function resolveExecutionMode(
  manifest: PluginManifest,
  policy: TrustPolicy = {},
): ExecutionMode {
  if (policy.forceSandbox) return "sandbox";
  if (manifest.trust === "full") return "host";
  return policy.trusted?.includes(manifest.id ?? "") ? "host" : "sandbox";
}

/** Split plugins by execution mode, preserving the order they were given in. */
export function partitionByTrust<T extends { ref: PluginRef }>(
  entries: T[],
  policy: TrustPolicy = {},
): { sandboxed: T[]; trusted: T[] } {
  const sandboxed: T[] = [];
  const trusted: T[] = [];
  for (const entry of entries) {
    const target =
      resolveExecutionMode(entry.ref.manifest, policy) === "host"
        ? trusted
        : sandboxed;
    target.push(entry);
  }
  return { sandboxed, trusted };
}
