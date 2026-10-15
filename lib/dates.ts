// One date style across the app: "Oct 15" within the current year,
// "Oct 15, 2026" otherwise; times as "9:00 AM".

type DateInput = string | number | Date | null | undefined;

const toDate = (value: DateInput): Date | null => {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function formatDate(
  value: DateInput,
  now: Date = new Date(),
  locale?: string,
): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function formatTime(value: DateInput, locale?: string): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(
  value: DateInput,
  now: Date = new Date(),
  locale?: string,
): string {
  const date = toDate(value);
  if (!date) return "";
  return `${formatDate(date, now, locale)}, ${formatTime(date, locale)}`;
}
