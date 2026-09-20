const SHANGHAI = "Asia/Shanghai";

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: SHANGHAI,
  }).format(date);
}

export function formatDayHeading(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    timeZone: SHANGHAI,
  }).format(date);
}

export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SHANGHAI,
  }).format(date);
}

export function dayKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SHANGHAI,
  }).format(date);
}

export type DayGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

export function groupByDay<T extends { createdAt: string }>(items: T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(item.createdAt) || "other";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, group]) => ({
      key,
      label: formatDayHeading(group[0]?.createdAt) || "其他",
      items: [...group].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }));
}
