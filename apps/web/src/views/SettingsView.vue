<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { apiFetch, ApiError } from "../api/client.js";
import { useAuthStore, type User } from "../stores/auth.js";

const auth = useAuthStore();
const form = reactive({ displayName: "", defaultInstrument: "", timezone: "Asia/Shanghai", locale: "zh-CN", version: 0 });
const passwords = reactive({ currentPassword: "", newPassword: "", confirmPassword: "" });
const message = ref("");
const error = ref("");
const loading = ref(true);
const saving = ref(false);
const commonTimezones = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

function applyUser(user: User): void {
  Object.assign(form, {
    displayName: user.displayName,
    defaultInstrument: user.defaultInstrument ?? "",
    timezone: user.timezone,
    locale: user.locale,
    version: user.version,
  });
  auth.updateUser(user);
}

async function load(): Promise<void> {
  try {
    const result = await apiFetch<{ user: User }>("/api/v1/users/me");
    applyUser(result.user);
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : "设置加载失败";
  } finally {
    loading.value = false;
  }
}
async function saveProfile(): Promise<void> {
  message.value = "";
  error.value = "";
  saving.value = true;
  try {
    const result = await apiFetch<{ user: User }>("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify({ ...form, defaultInstrument: form.defaultInstrument || null }),
    });
    applyUser(result.user);
    message.value = "个人设置已保存，时区与界面偏好已同步到历史显示和统计口径";
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 409) {
      // 并发修改按版本合并：重新加载最新设置，保留用户可再次确认后提交
      await load();
      error.value = "设置已在其他窗口修改，已为你合并最新值，请确认后重新保存";
    } else {
      error.value = reason instanceof ApiError ? reason.message : "保存失败";
    }
  } finally {
    saving.value = false;
  }
}
function useBrowserTimezone(): void {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (browser) form.timezone = browser;
}
async function changePassword(): Promise<void> {
  message.value = "";
  error.value = "";
  if (passwords.newPassword !== passwords.confirmPassword) {
    error.value = "两次输入的新密码不一致";
    return;
  }
  try {
    await apiFetch("/api/v1/users/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
    });
    message.value = "密码已修改，请重新登录";
    await auth.logout();
    window.location.href = "/login";
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : "修改密码失败";
  }
}
async function exportData(): Promise<void> {
  const result = await apiFetch<{ export: { id: string } }>("/api/v1/exports", { method: "POST", body: JSON.stringify({ format: "json" }) });
  message.value = `导出任务 ${result.export.id} 已创建，请稍后刷新状态。`;
}
onMounted(load);
</script>

<template>
  <section class="page">
    <header class="page-header"><div><h1>设置</h1><p>管理默认练习偏好、时区和账户安全。</p></div></header>
    <div v-if="message" class="alert success" style="margin-bottom: 16px">{{ message }}</div>
    <div v-if="error" class="alert" style="margin-bottom: 16px">{{ error }}</div>
    <div v-if="loading" class="loading">正在加载设置…</div>
    <div v-else class="grid grid-2">
      <form class="card stack" @submit.prevent="saveProfile">
        <h2>练习偏好</h2>
        <p class="muted">时区与界面语言保存后立即联动到历史时间显示与统计分桶口径；默认乐器用于新建练习预填。</p>
        <label class="field"><span>展示名</span><input v-model="form.displayName" required maxlength="80" /></label>
        <label class="field"><span>默认乐器</span><input v-model="form.defaultInstrument" maxlength="60" /></label>
        <label class="field">
          <span>IANA 时区</span>
          <input v-model="form.timezone" required list="common-timezones" placeholder="Asia/Shanghai" />
          <datalist id="common-timezones"><option v-for="zone in commonTimezones" :key="zone" :value="zone" /></datalist>
        </label>
        <button class="button small ghost align-start" type="button" @click="useBrowserTimezone">使用浏览器时区</button>
        <label class="field"><span>界面语言</span><select v-model="form.locale"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></label>
        <div class="row end"><button class="button" type="submit" :disabled="saving">{{ saving ? "保存中…" : "保存设置" }}</button></div>
      </form>

      <form class="card stack" @submit.prevent="changePassword">
        <h2>账户安全</h2>
        <p class="muted">修改密码会撤销其他设备上的刷新会话，并使其他窗口未保存的设置修改失效（需刷新后合并）。密码至少 10 位，包含字母和数字。</p>
        <label class="field"><span>当前密码</span><input v-model="passwords.currentPassword" required type="password" autocomplete="current-password" /></label>
        <label class="field"><span>新密码</span><input v-model="passwords.newPassword" required type="password" autocomplete="new-password" /></label>
        <label class="field"><span>确认新密码</span><input v-model="passwords.confirmPassword" required type="password" autocomplete="new-password" /></label>
        <div class="row end"><button class="button secondary" type="submit">修改密码</button></div>
      </form>

      <article class="card stack">
        <h2>数据导出</h2>
        <p class="muted">导出会包含练习、音频元数据、标记、目标和进度，不包含音频二进制。</p>
        <button class="button secondary" type="button" @click="exportData">创建 JSON 导出</button>
      </article>
      <article class="card stack">
        <h2>数据与隐私</h2>
        <p class="muted">音频存放在私有对象存储中，播放地址短期有效且只能由本人签发。</p>
        <p class="muted">删除练习会进入后台清理队列，对象和业务数据清理失败时会保留可重试状态。</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.align-start { align-self: flex-start; }
</style>
