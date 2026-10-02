<script setup lang="ts">
import { RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth.js";
import { usePreferencesStore } from "./stores/preferences.js";

// 偏好联动在根组件建立：登录态用户一到账，时区/语言/主题立即全局生效。
const auth = useAuthStore();
const preferences = usePreferencesStore();
preferences.bindAuthUser(() => auth.user);
</script>

<template>
  <RouterView />
</template>
