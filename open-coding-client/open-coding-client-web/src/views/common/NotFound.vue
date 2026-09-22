<script setup lang="ts">
/** 404：错误态三段式（事实/原因/动作）+ 返回主流程。 */
import { Button } from 'tdesign-vue-next';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/common/PageHeader.vue';

const router = useRouter();
</script>

<template>
  <div class="oc-page">
    <PageHeader title="页面不存在" desc="你访问的路径没有匹配到任何界面。" />
    <div class="oc-card" style="max-width: 620px">
      <div class="oc-stack">
        <div><b>发生了什么：</b>路由未命中，页面可能已被合并或改名。</div>
        <div><b>为什么：</b>当前版本的路由表由各域路由模块自注册，旧路径可能已调整。</div>
        <div><b>怎么办：</b>用 Ctrl/Cmd+K 打开命令面板搜索功能名，或返回会话工作台。</div>
        <div class="oc-flex" style="gap: 8px; margin-top: 8px">
          <Button theme="primary" @click="router.push('/session')">返回会话工作台</Button>
          <Button variant="outline" @click="router.push('/settings/diagnostics')">运行诊断</Button>
        </div>
      </div>
    </div>
  </div>
</template>
