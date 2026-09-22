<script setup lang="ts">
/**
 * 统一搜索（八源）：会话 / 任务目标 / 知识 / 记忆 / 技能插件 / 工作区文件 / 审计 / 事件。
 * 前置权限过滤（越权结果不返回，杜绝侧信道）；结果可「作为上下文引用」或复制深链。
 */
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Dialog, Input, MessagePlugin, Tag } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';
import { searchAll, type SearchHit } from '@/mock/db';
import OcIcon from '@/components/common/OcIcon.vue';

const ui = useUiStore();
const router = useRouter();
const keyword = ref('');
const scope = ref<string>('all');
const hits = ref<SearchHit[]>([]);
const busy = ref(false);
const latency = ref(0);

const SCOPES = [
  { value: 'all', label: '全部来源' },
  { value: 'session', label: '会话' },
  { value: 'task', label: '任务 / 目标' },
  { value: 'knowledge', label: '知识' },
  { value: 'memory', label: '记忆' },
  { value: 'registry', label: '技能 / 插件' },
  { value: 'file', label: '工作区文件' },
  { value: 'audit', label: '审计' },
  { value: 'event', label: '事件' },
];

const grouped = computed(() => {
  const map = new Map<string, SearchHit[]>();
  hits.value.forEach((h) => {
    if (!map.has(h.source)) map.set(h.source, []);
    map.get(h.source)!.push(h);
  });
  return [...map.entries()];
});

async function run() {
  if (!keyword.value.trim()) {
    hits.value = [];
    return;
  }
  busy.value = true;
  const t0 = performance.now();
  const res = await searchAll(keyword.value, scope.value === 'all' ? undefined : scope.value);
  latency.value = Math.round(performance.now() - t0);
  hits.value = res;
  busy.value = false;
  ui.track('eco.search.executed', { scopes: scope.value, hits: res.length });
}

watch(keyword, () => run());
watch(scope, () => run());

function open(hit: SearchHit) {
  router.push(hit.path);
  ui.globalSearchOpen = false;
}

async function copyLink(hit: SearchHit) {
  await navigator.clipboard.writeText(`oc://${hit.deepLink}`);
  MessagePlugin.success('已复制深链（oc://，5 分钟一次性签名）');
}
</script>

<template>
  <Dialog v-model:visible="ui.globalSearchOpen" header="统一搜索" width="820px" :footer="false" top="8vh">
    <div class="oc-stack">
      <Input v-model="keyword" placeholder="搜索全部来源（P95 ≤300ms，前置权限过滤）" autofocus clearable>
        <template #prefix-icon><OcIcon name="search" size="16px" /></template>
      </Input>
      <div class="oc-flex oc-flex--wrap" style="gap: 6px">
        <Tag
          v-for="s in SCOPES"
          :key="s.value"
          :theme="scope === s.value ? 'primary' : 'default'"
          :variant="scope === s.value ? 'light' : 'outline'"
          size="small"
          style="cursor: pointer"
          @click="scope = s.value"
        >
          {{ s.label }}
        </Tag>
        <span class="oc-muted" style="font-size: 12px; margin-left: auto">
          {{ hits.length }} 条结果 · {{ latency }}ms
        </span>
      </div>

      <div class="oc-search__body">
        <div v-if="busy" class="oc-muted" style="text-align: center; padding: 24px">检索中…</div>
        <div v-else-if="!keyword" class="oc-muted" style="text-align: center; padding: 24px">
          输入关键词开始检索，或使用深链直接跳转（oc://open/session/&lt;id&gt;）
        </div>
        <div v-else-if="!hits.length" class="oc-muted" style="text-align: center; padding: 24px">
          没有匹配结果。试试更短的关键词，或扩大范围到「全部来源」。
        </div>
        <template v-else>
          <div v-for="[source, items] in grouped" :key="source" class="oc-stack" style="gap: 4px">
            <div class="oc-muted" style="font-size: 11px">{{ source }} · {{ items.length }}</div>
            <button v-for="h in items" :key="h.id" type="button" class="oc-hit" @click="open(h)">
              <div class="oc-grow">
                <div class="oc-flex" style="gap: 6px">
                  <b>{{ h.title }}</b>
                  <Tag size="small" variant="outline">{{ h.source }}</Tag>
                  <Tag v-if="h.restricted" size="small" theme="warning" variant="light-outline">已按权限过滤</Tag>
                </div>
                <div class="oc-secondary" style="font-size: 12px">{{ h.snippet }}</div>
              </div>
              <div class="oc-flex" style="gap: 4px">
                <Button size="small" variant="text" @click.stop="copyLink(h)">深链</Button>
                <Button size="small" variant="text" @click.stop="open(h)">@ 引用</Button>
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.oc-search__body {
  max-height: 56vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oc-hit {
  display: flex;
  gap: 8px;
  align-items: center;
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  background: var(--oc-bg-container);
  padding: 6px 10px;
  cursor: pointer;
  text-align: left;
}

.oc-hit:hover {
  border-color: var(--td-brand-color, #0052d9);
  background: var(--td-brand-color-light, #f2f7ff);
}
</style>
