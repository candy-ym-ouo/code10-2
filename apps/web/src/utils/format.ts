export interface FormatPreferences {
  locale: string;
  timezone: string;
}

const fallbackPreferences: FormatPreferences = {
  locale: "zh-CN",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
};

let preferences: FormatPreferences = { ...fallbackPreferences };

/**
 * 设置联动入口：用户保存设置（时区 / 界面语言）后由 auth store 调用，
 * 历史、详情、仪表盘等所有时间显示立即切换到同一口径。
 */
export function setFormatPreferences(next: { locale?: string | null; timezone?: string | null }): void {
  preferences = {
    locale: next.locale?.trim() || fallbackPreferences.locale,
    timezone: next.timezone?.trim() || fallbackPreferences.timezone,
  };
}

export function getFormatPreferences(): FormatPreferences {
  return { ...preferences };
}

export function formatDuration(ms: number | bigint | null | undefined): string {
  const value = Number(ms ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 分钟";
  const totalMinutes = Math.round(value / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} 分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(preferences.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: preferences.timezone,
  }).format(new Date(value));
}

/** 指定时区在某时刻相对 UTC 的偏移（毫秒），通过 Intl 本地化反推。 */
function timezoneOffsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour) % 24,
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - instant.getTime();
}

/**
 * 将 `YYYY-MM-DD` 解析为指定时区当天的 UTC 区间 [from, to]，
 * 使统计区间与服务端 `AT TIME ZONE` 分桶、历史显示保持同一口径。
 */
export function dayRangeInTimezone(day: string, timezone: string): { from: Date; to: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`日期格式必须为 YYYY-MM-DD：${day}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, date);
  const from = new Date(utcMidnight - timezoneOffsetMs(new Date(utcMidnight), timezone));
  const nextUtcMidnight = Date.UTC(year, month - 1, date + 1);
  const to = new Date(nextUtcMidnight - timezoneOffsetMs(new Date(nextUtcMidnight), timezone) - 1);
  return { from, to };
}

export function toDateTimeLocal(value = new Date()): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function formatTimeMs(value: number): string {
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = Math.floor(safe % 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function parseTimeInput(value: string): number | null {
  const clean = value.trim().replace(",", ".");
  const match = /^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$/.exec(clean);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (seconds >= 60) return null;
  const millis = Number((match[3] ?? "").padEnd(3, "0"));
  return minutes * 60_000 + seconds * 1000 + millis;
}

export function formatBytes(value: number | bigint): string {
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export const annotationLabels = {
  RHYTHM: "节奏不稳",
  FINGERING: "指法困难",
  EMOTION: "情绪变化",
} as const;

export const sessionStatusLabels = {
  DRAFT: "草稿",
  IN_REVIEW: "复盘中",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
  DELETING: "删除中",
  DELETE_FAILED: "删除失败",
} as const;

export const goalStatusLabels = {
  OPEN: "待开始",
  IN_PROGRESS: "进行中",
  ACHIEVED: "已达成",
  MISSED: "已逾期",
  CANCELLED: "已取消",
} as const;
