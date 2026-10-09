/** The minimum a plugin must expose to be ordered: an id and its dependencies. */
export interface LoadablePlugin {
  /** Folder name inside its root — what a skip message points the user at. */
  dirName: string;
  id: string;
  manifest: { dependencies: Record<string, string> };
}

export interface LoadOrderResult<T extends LoadablePlugin> {
  /** Plugins in dependency order (dependencies first). */
  order: T[];
  /** Plugins that could not be loaded, with why. */
  skipped: Array<{ dirName: string; reason: string }>;
}

/**
 * Topologically sort plugins so dependencies load first. A plugin that depends
 * on a missing plugin — or that sits on a dependency cycle — is skipped rather
 * than crashing the game. Pure, so the ordering rules stay testable.
 */
export function resolveLoadOrder<T extends LoadablePlugin>(
  plugins: T[],
): LoadOrderResult<T> {
  const byId = new Map<string, T>();
  const skipped: Array<{ dirName: string; reason: string }> = [];

  for (const m of plugins) {
    if (byId.has(m.id)) {
      skipped.push({ dirName: m.dirName, reason: `重复 id "${m.id}"` });
      continue;
    }
    byId.set(m.id, m);
  }

  const order: T[] = [];
  const status = new Map<string, 0 | 1 | 2>(); // unvisited | visiting | done
  const failed = new Set<string>();

  const fail = (id: string, reason: string) => {
    if (failed.has(id)) return;
    failed.add(id);
    skipped.push({ dirName: byId.get(id)?.dirName ?? id, reason });
  };

  const visit = (id: string, stack: string[]): void => {
    if (failed.has(id) || status.get(id) === 2) return;
    if (status.get(id) === 1) {
      // cycle: everything from the repeated id onward is poisoned
      for (const cid of stack.slice(stack.indexOf(id))) fail(cid, "存在依赖环");
      return;
    }
    const mod = byId.get(id);
    if (!mod) return;

    status.set(id, 1);
    for (const dep of Object.keys(mod.manifest.dependencies)) {
      if (!byId.has(dep)) {
        fail(id, `缺少依赖 "${dep}"`);
        status.set(id, 2);
        return;
      }
      visit(dep, [...stack, id]);
      if (failed.has(dep)) {
        fail(id, `依赖 "${dep}" 不可用`);
        status.set(id, 2);
        return;
      }
    }
    status.set(id, 2);
    order.push(mod);
  };

  for (const id of byId.keys()) visit(id, []);

  return { order, skipped };
}
