<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { apiFetch, ApiError } from "../api/client.js";
import { useAuthStore, type InterfaceTheme, type User } from "../stores/auth.js";
import { isIanaTimezone, themeLabels } from "../utils/format.js";

const auth = useAuthStore();
const form = reactive({
  displayName: "",
  defaultInstrument: "",
  timezone: "Asia/Shanghai",
  locale: "zh-CN",
  theme: "SYSTEM" as InterfaceTheme,
  version: 0,
});
const passwords = reactive({ currentPassword: "", newPassword: "", confirmPassword: "" });
const message = ref("");
const error = ref("");
const timezoneInvalid = ref(false);
const saving = ref(false);
const loading = ref(true);

function applyUser(user: User): void {
  Object.assign(form, {
    displayName: user.displayName,
    defaultInstrument: user.defaultInstrument ?? "",
    timezone: user.timezone,
    locale: user.locale,
    theme: user.theme,
    version: user.version,
  });
  timezoneInvalid.value = false;
}

async function load(): Promise<void> {
  try {
    const result = await apiFetch<{ user: User }>("/api/v1/users/me");
    applyUser(result.user);
    auth.updateUser(result.user);
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : "设置加载失败";
  } finally {
    loading.value = false;
  }
}

// 服务端按 version 做乐观并发控制、按字段合并：
// 冲突时拉取最新版本，保留本地未提交改动，绝不回写覆盖较新的安全设置。
async function saveProfile(): Promise<void> {
  message.value = "";
  error.value = "";
  if (!isIanaTimezone(form.timezone)) {
    timezoneInvalid.value = true;
    error.value = "时区不是有效的 IANA 时区，例如 Asia/Shanghai";
    return;
  }
  saving.value = true;
  try {
    const result = await apiFetch<{ user: User }>("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify({ ...form, defaultInstrument: form.defaultInstrument || null }),
    });
    applyUser(result.user);
    auth.updateUser(result.user);
    message.value = "个人设置已保存";
  } catch (reason) {
    if (reason instanceof ApiError && reason.code === "VERSION_CONFLICT") {
      // 合并而不是覆盖：取服务端较新版本号，字段保留用户当前编辑值。
      const latest = await apiFetch<{ user: User }>("/api/v1/users/me");
      form.version = latest.user.version;
      auth.updateUser(latest.user);
      error.value = "设置刚在其他设备被修改，已合并最新版本，请再次点击保存（其他设备的安全设置未被覆盖）。";
    } else {
      error.value = reason instanceof ApiError ? reason.message : "保存失败";
    }
  } finally {
    saving.value = false;
  }
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
    <header class="page-header"><div><h1>设置</h1><p>时区、默认乐器与界面偏好会同步联动到历史显示、统计口径和新建练习。</p></div></header>
    <div v-if="message" class="alert success" style="margin-bottom: 16px">{{ message }}</div>
    <div v-if="error" class="alert" style="margin-bottom: 16px">{{ error }}</div>
    <div v-if="loading" class="loading">正在加载设置…</div>
    <div v-else class="grid grid-2">
      <form class="card stack" @submit.prevent="saveProfile">
        <h2>练习偏好</h2>
        <label class="field"><span>展示名</span><input v-model="form.displayName" required maxlength="80" /></label>
        <label class="field">
          <span>默认乐器</span>
          <input v-model="form.defaultInstrument" maxlength="60" list="instruments" placeholder="例如：小提琴" />
          <small class="muted">新建练习时自动带入；统计页默认按它筛选。</small>
        </label>
        <datalist id="instruments">
          <option value="小提琴" /><option value="中提琴" /><option value="大提琴" /><option value="钢琴" />
          <option value="长笛" /><option value="单簧管" /><option value="声乐" /><option value="吉他" />
        </datalist>
        <label class="field">
          <span>IANA 时区</span>
          <input v-model="form.timezone" :class="{ invalid: timezoneInvalid }" required placeholder="Asia/Shanghai" @input="timezoneInvalid = false" />
          <small class="muted">历史时间与统计按自然日分桶均按此时区计算。</small>
        </label>
        <div class="row wrap">
          <label class="field" style="flex: 1; min-width: 160px"><span>界面语言</span><select v-model="form.locale"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></label>
          <label class="field" style="flex: 1; min-width: 160px">
            <span>界面主题</span>
            <select v-model="form.theme">
              <option value="LIGHT">{{ themeLabels.LIGHT }}</option>
              <option value="DARK">{{ themeLabels.DARK }}</option>
              <option value="SYSTEM">{{ themeLabels.SYSTEM }}</option>
            </select>
          </label>
        </div>
        <div class="row end"><button class="button" type="submit" :disabled="saving">{{ saving ? "保存中…" : "保存设置" }}</button></div>
      </form>

      <form class="card stack" @submit.prevent="changePassword">
        <h2>账户安全</h2>
        <p class="muted">修改密码会撤销其他设备上的刷新会话并推进设置版本。密码至少 10 位，包含字母和数字。</p>
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
