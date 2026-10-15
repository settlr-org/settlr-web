// Small copy/format helpers shared by pages.

/** "1 result", "0 results", "2 results". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
