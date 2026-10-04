import React from "react";
import {
  applyElementToModalLayer,
  closeModalLayer,
  openModalLayer,
} from "ink-cartridge";

/** Ids we have presented, so `dismissModal` never touches an unknown layer. */
const opened = new Set<string>();

/**
 * Open (or refresh) a modal layer rendering `element` with `props`.
 *
 * The layer is re-asserted before the element is applied: navigating between
 * screens prunes every non-cross-page modal layer, so a cached "open" flag here
 * would be stale and the following apply would throw. That throw happens later,
 * during React's render phase (the reducer runs when the queued action is
 * processed), so an inline try/catch around the call site cannot catch it.
 * `openModalLayer` is a no-op when the layer is already registered.
 */
export function presentModal(
  id: string,
  element: React.ComponentType<any>,
  props: Record<string, unknown>,
  zIndex = 900,
): void {
  try {
    openModalLayer(id, zIndex);
    applyElementToModalLayer(id, { elementId: id, element, props });
    opened.add(id);
  } catch {
    // No provider mounted (screen teardown) — nothing to present.
  }
}

export function dismissModal(id: string): void {
  if (!opened.has(id)) return;
  opened.delete(id);
  try {
    closeModalLayer(id);
  } catch {
    /* no provider, or already gone */
  }
}
