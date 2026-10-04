type Listener = () => void;

let typing = false;
const listeners = new Set<Listener>();

/**
 * Whether the main terminal is capturing raw typing. The app disables its
 * letter global-keys (p / ? / q) while this is true so they can be typed into
 * the prompt instead of triggering shortcuts.
 */
export const replInput = {
  isTyping: (): boolean => typing,
  set(next: boolean): void {
    if (typing === next) return;
    typing = next;
    listeners.forEach((fn) => fn());
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
