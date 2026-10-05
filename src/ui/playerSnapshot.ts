/** Pure helpers for `useSyncExternalStore` snapshot strings (React-free). */

/**
 * A stable digest of every relationship id→affinity pair. Used in store
 * snapshots so a change to an existing NPC's affinity (which leaves
 * `relationships.size` unchanged) still triggers a re-render.
 */
export function relationshipDigest(
  relationships: Iterable<[string, number]>,
): string {
  const parts: string[] = [];
  for (const [id, value] of relationships) parts.push(`${id}:${value}`);
  return parts.join(",");
}
