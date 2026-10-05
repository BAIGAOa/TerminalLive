/**
 * A content registry whose contents can be snapshotted, restored and cleared,
 * so the active World can re-layer its own content over the built-in baseline
 * (and a mod overlay can be re-applied after each reset). No React/DI — pure
 * data in, pure data out.
 */
export interface Resettable<TSnapshot> {
  snapshot(): TSnapshot;
  restore(snapshot: TSnapshot): void;
  clear(): void;
}
