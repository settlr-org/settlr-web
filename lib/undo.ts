// Deferred commit with undo: run an action after a grace period unless it is
// undone first. Used where the API has no "restore" endpoint (skipping a
// planned payment), so "Undo" means "not sent yet".

type Entry = { timer: ReturnType<typeof setTimeout>; run: () => unknown };

export const UNDO_WINDOW_MS = 6000;

export class DeferredActions {
  private pending = new Map<string, Entry>();

  /** Queue `run` for `delayMs`. Scheduling a key again commits the earlier one first. */
  schedule(key: string, run: () => unknown, delayMs = UNDO_WINDOW_MS) {
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
  async commit(key: string) {
    const entry = this.pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(key);
    await entry.run();
  }

  /** Run everything queued now (e.g. when leaving the page). */
  async flushAll() {
    await Promise.all([...this.pending.keys()].map((key) => this.commit(key)));
  }
}

/** The set of ids to hide while their action is queued. */
export function withoutHeld<T extends { id: string }>(
  items: T[],
  held: ReadonlySet<string>,
): T[] {
  return held.size ? items.filter((item) => !held.has(item.id)) : items;
}
