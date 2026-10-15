// Deferred commit with undo: run an action after a grace period unless it is
// undone first. Used where the API has no "restore" endpoint (skipping a
// planned payment), so "Undo" means "not sent yet".

export type RunOptions = {
  /** The page is going away: send with fetch keepalive so it survives. */
  keepalive: boolean;
};
type Entry = {
  timer: ReturnType<typeof setTimeout>;
  run: (options: RunOptions) => unknown;
};

export const UNDO_WINDOW_MS = 6000;

export class DeferredActions {
  private pending = new Map<string, Entry>();

  /** Queue `run` for `delayMs`. Scheduling a key again commits the earlier one first. */
  schedule(
    key: string,
    run: (options: RunOptions) => unknown,
    delayMs = UNDO_WINDOW_MS,
  ) {
    void this.commit(key);
    const timer = setTimeout(() => void this.commit(key), delayMs);
    this.pending.set(key, { timer, run });
  }

  has(key: string) {
    return this.pending.has(key);
  }

  /** Cancel a queued action. Returns false when it already ran (too late). */
  undo(key: string): boolean {
    const entry = this.pending.get(key);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(key);
    return true;
  }

  /** Run one queued action now. */
  async commit(key: string, options: RunOptions = { keepalive: false }) {
    const entry = this.pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(key);
    await entry.run(options);
  }

  get size() {
    return this.pending.size;
  }

  /** Run everything queued now (leaving the page, or before a bulk action). */
  async flushAll(options: RunOptions = { keepalive: false }) {
    await Promise.all(
      [...this.pending.keys()].map((key) => this.commit(key, options)),
    );
  }
}

/** The set of ids to hide while their action is queued. */
export function withoutHeld<T extends { id: string }>(
  items: T[],
  held: ReadonlySet<string>,
): T[] {
  return held.size ? items.filter((item) => !held.has(item.id)) : items;
}

/**
 * Flush queued actions when the page is hidden or closed (tab close, reload,
 * navigation away). Returns the cleanup function.
 */
export function flushOnLeave(
  queue: DeferredActions,
  target: Pick<Window, "addEventListener" | "removeEventListener"> &
    Partial<Pick<Window, "document">> = window,
): () => void {
  const flush = () => void queue.flushAll({ keepalive: true });
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  target.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    target.removeEventListener("pagehide", flush);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
