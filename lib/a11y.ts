// Pure helpers for keyboard patterns, kept framework-free so they can be unit tested.

/**
 * Index of the radio to move to for an arrow/Home/End key, wrapping at the
 * ends (WAI-ARIA radio group pattern). Returns null for other keys.
 */
export function nextRadioIndex(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  const start = Math.min(Math.max(current, 0), count - 1);
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (start + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (start - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
