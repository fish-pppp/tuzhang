import type { TimeWindow } from "./types.js";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calendarDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function addCalendarDays(dateStr: string, days: number): string {
  const match = DATE_ONLY.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return new Date(utc).toISOString().slice(0, 10);
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instant.getTime();
}

export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = tzOffsetMs(new Date(asUtcMs), timeZone);
  let utc = asUtcMs - offset;
  offset = tzOffsetMs(new Date(utc), timeZone);
  utc = asUtcMs - offset;
  return new Date(utc);
}

export function zonedDayStart(dateStr: string, timeZone: string): Date {
  const match = DATE_ONLY.exec(dateStr);
  if (!match) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }
  return zonedLocalToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    0,
    0,
    0,
    timeZone,
  );
}

export function resolveWindow({
  since,
  from,
  to,
  timeZone = "Asia/Shanghai",
  now = new Date(),
}: {
  since?: string;
  from?: string;
  to?: string;
  timeZone?: string;
  now?: Date;
} = {}): TimeWindow {
  if (from || to) {
    if (!from || !to) {
      throw new Error("Both --from and --to are required when overriding the window");
    }
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Invalid --from or --to timestamp");
    }
    if (end <= start) {
      throw new Error("--to must be after --from");
    }
    return {
      start,
      end,
      date: calendarDateInZone(start, timeZone),
      timeZone,
      label: `${start.toISOString()} → ${end.toISOString()}`,
    };
  }

  const today = calendarDateInZone(now, timeZone);
  let date = today;
  let start: Date;
  let end: Date;

  if (!since || since === "today") {
    start = zonedDayStart(today, timeZone);
    end = now;
    date = today;
  } else if (since === "yesterday") {
    date = addCalendarDays(today, -1);
    start = zonedDayStart(date, timeZone);
    end = zonedDayStart(today, timeZone);
  } else if (DATE_ONLY.test(since)) {
    date = since;
    start = zonedDayStart(date, timeZone);
    end = zonedDayStart(addCalendarDays(date, 1), timeZone);
  } else {
    throw new Error(`Unsupported --since value: ${since}`);
  }

  return {
    start,
    end,
    date,
    timeZone,
    label: `${start.toISOString()} → ${end.toISOString()}`,
  };
}

export function isMergedInWindow(
  mr: { merged_at?: string | null; mergedAt?: string | null },
  start: Date,
  end: Date,
): boolean {
  const mergedAt = mr.merged_at ?? mr.mergedAt;
  if (!mergedAt) {
    return false;
  }
  const stamp = new Date(mergedAt).getTime();
  if (Number.isNaN(stamp)) {
    return false;
  }
  return stamp >= start.getTime() && stamp < end.getTime();
}
