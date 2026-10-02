export interface FormatPreferences {
  timezone: string;
  locale: string;
}

interface ResolvedPreferences extends FormatPreferences {
  timezoneValid: boolean;
}

// 历史列表、详情与统计共用同一套时区/语言口径，
// 由全局偏好（用户设置）在登录后注入，避免各页面各自读取浏览器时区。
let preferences: ResolvedPreferences = {
  timezone: "Asia/Shanghai",
  locale: "zh-CN",
  timezoneValid: true,
};

export function setFormatPreferences(next: FormatPreferences): void {
  let timezoneValid = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: next.timezone }).format();
  } catch {
    timezoneValid = false;
  }
  preferences = {
    timezone: timezoneValid ? next.timezone : "Asia/Shanghai",
    locale: next.locale,
    timezoneValid,
  };
}

export function getFormatPreferences(): FormatPreferences {
  return { timezone: preferences.timezone, locale: preferences.locale };
}

export function isConfiguredTimezoneValid(): boolean {
  return preferences.timezoneValid;
}

export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
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

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(preferences.locale, {
    dateStyle: "medium",
    timeZone: preferences.timezone,
  }).format(new Date(value));
}

// 返回某一时刻在用户时区下的 <input type="datetime-local"> 值，
// 使新建练习的开始时间输入与历史/统计显示使用相同的时区口径。
export function toDateTimeLocal(value: Date = new Date(), timeZone: string = preferences.timezone): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

// 把“用户时区下的日期字符串 + 钟面时间”换算为 UTC 时刻。
// 统计页自定义区间使用它生成 from/to，保证选择的自然日边界与
// 服务端 date_trunc(..., AT TIME ZONE <timezone>) 的分桶一致。
export function zonedWallTimeToUtc(dateText: string, timeText: string, timeZone: string = preferences.timezone): Date {
  const [year = 1970, month = 1, day = 1] = dateText.split("-").map(Number);
  const [hour = 0, minute = 0, second = 0] = timeText.split(":").map(Number);
  const targetWall = Date.UTC(year, month - 1, day, hour, minute, second);
  // 先按零偏移猜测，再用 Intl 读出的实际钟面时间迭代修正，
  // 最多两轮即可覆盖 DST 切换等偏移变化。
  let guess = targetWall;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(guess));
    const value = Object.fromEntries(
      parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
    );
    const wallOfGuess = Date.UTC(
      Number(value.year),
      Number(value.month) - 1,
      Number(value.day),
      Number(value.hour) % 24,
      Number(value.minute),
      Number(value.second),
    );
    if (wallOfGuess === targetWall) break;
    guess += targetWall - wallOfGuess;
  }
  return new Date(guess);
}

// 用户时区下的今天对应的 <input type="date"> 值。
export function todayInZone(timeZone: string = preferences.timezone, ref: Date = new Date()): string {
  return toDateTimeLocal(ref, timeZone).slice(0, 10);
}

export function startOfYearInZone(year: number, timeZone: string = preferences.timezone): Date {
  return zonedWallTimeToUtc(`${year}-01-01`, "00:00:00", timeZone);
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

export const themeLabels = {
  LIGHT: "浅色",
  DARK: "深色",
  SYSTEM: "跟随系统",
} as const;
