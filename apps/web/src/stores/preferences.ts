import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { InterfaceTheme, User } from "./auth.js";
import { setFormatPreferences } from "../utils/format.js";

export type ResolvedTheme = "light" | "dark";

// 界面偏好联动中心：时区/语言注入格式化口径（历史显示与统计共用），
// 主题写入 <html data-theme>，默认乐器由各业务页直接从 auth.user 读取。
export const usePreferencesStore = defineStore("preferences", () => {
  const user = ref<User | null>(null);
  const systemDark = ref(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );
  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

  const timezone = computed(() => user.value?.timezone ?? "Asia/Shanghai");
  const locale = computed(() => user.value?.locale ?? "zh-CN");
  const defaultInstrument = computed(() => user.value?.defaultInstrument ?? "");
  const theme = computed<InterfaceTheme>(() => user.value?.theme ?? "SYSTEM");
  const resolvedTheme = computed<ResolvedTheme>(() =>
    theme.value === "SYSTEM" ? (systemDark.value ? "dark" : "light") : theme.value.toLowerCase() === "dark" ? "dark" : "light",
  );

  function syncFormat(): void {
    setFormatPreferences({ timezone: timezone.value, locale: locale.value });
  }

  function syncDocument(): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = resolvedTheme.value;
    document.documentElement.style.colorScheme = resolvedTheme.value;
    document.documentElement.lang = locale.value;
  }

  function bindAuthUser(getUser: () => User | null): void {
    user.value = getUser();
    watch(getUser, (next) => {
      user.value = next;
    });
  }

  watch([timezone, locale], syncFormat, { immediate: true });
  watch([resolvedTheme, locale], syncDocument, { immediate: true });

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaListener = (event: MediaQueryListEvent) => {
      systemDark.value = event.matches;
    };
    mediaQuery.addEventListener("change", mediaListener);
  }

  return { timezone, locale, defaultInstrument, theme, resolvedTheme, bindAuthUser, syncFormat, syncDocument };
});
