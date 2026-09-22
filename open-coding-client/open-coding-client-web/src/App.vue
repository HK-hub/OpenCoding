<script setup lang="ts">
/**
 * 应用根：仅承载路由出口。
 * 工作台外壳（导航/标签/状态栏/覆盖层）在 WorkbenchLayout 中实现，
 * 引导向导与分享视图使用独立整页布局。
 */
</script>

<template>
  <router-view />
</template>
