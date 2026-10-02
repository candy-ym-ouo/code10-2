<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch, ApiError } from "../api/client.js";
import { usePreferencesStore } from "../stores/preferences.js";
import { toDateTimeLocal, zonedWallTimeToUtc } from "../utils/format.js";

const router = useRouter();
const preferences = usePreferencesStore();
const title = ref("");
const instrument = ref("");
// 开始时间按设置中的时区生成钟面值，而不是浏览器本地时区。
const startedAt = ref(toDateTimeLocal(new Date(), preferences.timezone));
const focus = ref("");
const location = ref("");
const notes = ref("");
const durationMinutes = ref<number | null>(null);
const error = ref("");
const submitting = ref(false);

// 默认乐器来自设置；用户仍可在本次练习中临时修改。
onMounted(() => { instrument.value = preferences.defaultInstrument; });

async function submit(): Promise<void> {
  error.value = "";
  submitting.value = true;
  try {
    const result = await apiFetch<{ session: { id: string } }>("/api/v1/sessions", {
      method: "POST",
      body: JSON.stringify({
        title: title.value,
        instrument: instrument.value,
        startedAt: zonedWallTimeToUtc(startedAt.value.slice(0, 10), `${startedAt.value.slice(11)}:00`, preferences.timezone).toISOString(),
        focus: focus.value || null,
        location: location.value || null,
        notes: notes.value || null,
        ...(durationMinutes.value == null ? {} : { actualDurationMs: durationMinutes.value * 60_000 }),
      }),
    });
    await router.push(`/sessions/${result.session.id}/review`);
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : "创建练习失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div><h1>新建练习</h1><p>先记录本次练习的基本信息，创建后立即进入音频复盘器。</p></div>
    </header>
    <form class="card stack" style="max-width: 900px" @submit.prevent="submit">
      <div v-if="error" class="alert">{{ error }}</div>
      <div class="form-grid">
        <label class="field full"><span>练习标题 / 曲目片段</span><input v-model="title" required maxlength="120" placeholder="例如：协奏曲第二乐章 17-24 小节" /></label>
        <label class="field"><span>乐器</span><input v-model="instrument" required maxlength="60" list="instruments" placeholder="例如：小提琴" /></label>
        <label class="field"><span>开始时间</span><input v-model="startedAt" required type="datetime-local" /></label>
        <label class="field full"><span>本次重点</span><input v-model="focus" maxlength="500" placeholder="例如：保持换把后的音准与连贯性" /></label>
        <label class="field"><span>练习地点</span><input v-model="location" maxlength="120" /></label>
        <label class="field"><span>实际时长（可选）</span><input v-model.number="durationMinutes" type="number" min="1" max="1440" placeholder="分钟，未填写则按音频总时长计算" /></label>
        <label class="field full"><span>总体备注</span><textarea v-model="notes" maxlength="5000" placeholder="记录环境、身体状态或本次练习整体感受"></textarea></label>
      </div>
      <div class="row end"><button class="button ghost" type="button" @click="router.back()">取消</button><button class="button" type="submit" :disabled="submitting">{{ submitting ? "创建中…" : "创建并上传音频" }}</button></div>
    </form>
  </section>
</template>
