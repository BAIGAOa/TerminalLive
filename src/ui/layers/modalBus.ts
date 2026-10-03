import React from "react";
import {
  applyElementToModalLayer,
  closeModalLayer,
  openModalLayer,
} from "ink-cartridge";

const open = new Set<string>();

function ensureOpen(id: string, zIndex: number): void {
  if (!open.has(id)) {
    try {
      openModalLayer(id, zIndex);
    } catch {
      // already registered in the screen system
    }
    open.add(id);
  }
}

/** Open (or refresh) a modal layer rendering `element` with `props`. */
export function presentModal(
  id: string,
  element: React.ComponentType<any>,
  props: Record<string, unknown>,
  zIndex = 900,
): void {
  ensureOpen(id, zIndex);
  try {
    applyElementToModalLayer(id, { elementId: id, element, props });
  } catch {
    // The layer was cleared out from under us (e.g. a screen change while the
    // modal was open). Reopen it and try once more.
    open.delete(id);
    ensureOpen(id, zIndex);
    try {
      applyElementToModalLayer(id, { elementId: id, element, props });
    } catch {
      open.delete(id);
    }
  }
}

export function dismissModal(id: string): void {
  if (!open.has(id)) return;
  open.delete(id);
  try {
    closeModalLayer(id);
  } catch {
    /* already gone */
  }
}
