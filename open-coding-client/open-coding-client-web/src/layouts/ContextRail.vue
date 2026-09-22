<script setup lang="ts">
/**
 * 右侧上下文栏（4 区）：上下文占用分解 / 成本与用量 / 权限与授权记忆 / 证据与验收。
 * 只读派生：数据来自服务端投影，端上不做本地估算（impl/30 D-UXIMPL-6）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Progress, Tabs, Tag, Tooltip } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';
import { db } from '@/mock/db';
import OcIcon from '@/components/common/OcIcon.vue';
import OcChart from '@/components/common/OcChart.vue';

const ui = useUiStore();
const router = useRouter();
const tab = ref('context');

const session = computed(() => db.sessions[0]);
const sections = computed(() => db.contextSections);
const totalTokens = computed(() => sections.value.reduce((a, s) => a + s.tokens, 0));
const waterline = computed(() => (totalTokens.value / 200_000) * 100);

const cost = computed(() => db.sessionCost);
const memories = computed(() => db.grantMemories.slice(0, 5));

const EVIDENCE = [
  { level: 'L1 静态', items: ['tsc --noEmit 通过', 'eslint 0 error'], ok: true },
  { level: 'L2 可执行', items: ['单测 128 passed', '构建成功'], ok: true },
  { level: 'L3 语义', items: ['验收清单 6/8 条核对', '未验证：移动端布局'], ok: false },
];
</script>

<template>
  <aside class="oc-rail">
    <div class="oc-rail__head">
      <span>{{ session?.shortId }} · {{ session?.title }}</span>
      <button type="button" class="oc-shell__icon-btn" title="收起上下文栏" @click="ui.railVisible = false">
        <OcIcon name="close" size="14px" />
      </button>
    </div>

    <Tabs v-model="tab" :options="[
      { value: 'context', label: '上下文' },
      { value: 'cost', label: '成本' },
      { value: 'perm', label: '授权' },
      { value: 'evidence', label: '证据' },
    ]" />

    <div class="oc-rail__body">
      <!-- 上下文占用：九区段 -->
      <div v-if="tab === 'context'" class="oc-stack">
        <div class="oc-flex--between">
          <span class="oc-secondary" style="font-size: 12px">总占用</span>
          <span :style="{ color: waterline > 95 ? 'var(--oc-sev-error)' : waterline > 80 ? 'var(--oc-sev-warn)' : 'inherit' }">
            {{ (totalTokens / 1000).toFixed(1) }}k / 200k（{{ waterline.toFixed(0) }}%）
          </span>
        </div>
        <Progress :percentage="Math.min(100, waterline)" :theme="waterline > 95 ? 'line' : waterline > 80 ? 'line' : 'line'" :status="waterline > 95 ? 'error' : waterline > 80 ? 'warning' : 'active'" size="small" />
        <div class="oc-rail__hint">水位 80% 预警 / 95% 触发压缩；压缩前会展示摘要供人工校正。</div>

        <div class="oc-stack" style="gap: 6px">
          <Tooltip v-for="s in sections" :key="s.code" :content="`${s.desc} · 驱逐等级 ${s.eviction} · 压缩方式 ${s.compression} · 缓存属性 ${s.cache}`">
            <div class="oc-sec">
              <span class="oc-sec__code">{{ s.code }}</span>
              <span class="oc-grow oc-truncate">{{ s.name }}</span>
              <span class="oc-mono">{{ (s.tokens / 1000).toFixed(1) }}k</span>
              <span class="oc-sec__bar">
                <i :style="{ width: `${Math.min(100, (s.tokens / s.budget) * 100)}%`, background: s.tokens / s.budget > 0.9 ? 'var(--oc-sev-warn)' : 'var(--td-brand-color)' }" />
              </span>
            </div>
          </Tooltip>
        </div>

        <div class="oc-divider" />
        <div class="oc-flex--between">
          <span class="oc-secondary" style="font-size: 12px">压缩历史（L1→L4）</span>
          <Button size="small" variant="text" @click="router.push('/context/compaction')">压缩地图</Button>
        </div>
        <div class="oc-stack" style="gap: 4px">
          <div v-for="c in db.compactionHistory" :key="c.at" class="oc-flex" style="gap: 6px; font-size: 12px">
            <Tag size="small" variant="outline">{{ c.level }}</Tag>
            <span class="oc-muted">{{ (c.before / 1000).toFixed(1) }}k → {{ (c.after / 1000).toFixed(1) }}k</span>
            <span class="oc-grow oc-truncate oc-secondary">{{ c.reason }}</span>
          </div>
        </div>

        <Button size="small" variant="outline" block @click="router.push('/context/snapshot')">打开上下文快照</Button>
      </div>

      <!-- 成本与用量 -->
      <div v-else-if="tab === 'cost'" class="oc-stack">
        <div class="oc-flex--between">
          <span class="oc-secondary" style="font-size: 12px">本会话成本</span>
          <b>${{ cost.total.toFixed(4) }}</b>
        </div>
        <OcChart type="stacked-bar" :height="130" format="cost" :series="cost.byModelSeries" />
        <div class="oc-kv" style="font-size: 12px">
          <span class="oc-kv__k">输入 token</span><span>{{ (cost.inputTokens / 1000).toFixed(1) }}k</span>
          <span class="oc-kv__k">输出 token</span><span>{{ (cost.outputTokens / 1000).toFixed(1) }}k</span>
          <span class="oc-kv__k">缓存读取</span><span>{{ (cost.cacheReadTokens / 1000).toFixed(1) }}k（折扣单列）</span>
          <span class="oc-kv__k">推理 token</span><span>{{ (cost.reasoningTokens / 1000).toFixed(1) }}k</span>
          <span class="oc-kv__k">首字节 / 总耗时</span><span>{{ cost.ttfbMs }}ms / {{ (cost.totalMs / 1000).toFixed(1) }}s</span>
        </div>
        <div class="oc-flex" style="gap: 6px">
          <Button size="small" variant="outline" @click="router.push('/cost/overview')">成本看板</Button>
          <Button size="small" variant="text" @click="router.push('/cost/why-expensive')">为什么这么贵</Button>
        </div>
        <div class="oc-rail__hint">预算：$5.00/任务，已用 {{ ((cost.total / 5) * 100).toFixed(1) }}%；成本前置可见，事后可下钻到单次调用。</div>
      </div>

      <!-- 权限与授权记忆 -->
      <div v-else-if="tab === 'perm'" class="oc-stack">
        <div class="oc-flex--between">
          <span class="oc-secondary" style="font-size: 12px">当前模式</span>
          <Tag size="small" theme="primary" variant="light-outline">default（写与执行按风险 ASK）</Tag>
        </div>
        <div class="oc-flex--between">
          <span class="oc-secondary" style="font-size: 12px">自主度</span>
          <Tag size="small" variant="light-outline">协作（风险动作确认）</Tag>
        </div>
        <div class="oc-divider" />
        <span class="oc-secondary" style="font-size: 12px">授权记忆（六级范围）</span>
        <div v-for="m in memories" :key="m.id" class="oc-rail__row">
          <Tag size="small" variant="outline">{{ m.scopeText }}</Tag>
          <span class="oc-grow oc-truncate oc-mono" style="font-size: 11px">{{ m.tool }} {{ m.pattern }}</span>
          <Button size="small" variant="text" @click="router.push('/approval/memory')">撤销</Button>
        </div>
        <Button size="small" variant="outline" block @click="router.push('/permission/memory')">管理全部授权记忆</Button>
        <div class="oc-rail__hint">撤销立即生效；企业基线不可被下级放宽（锁定项只读显示来源）。</div>
      </div>

      <!-- 证据与验收 -->
      <div v-else class="oc-stack">
        <span class="oc-secondary" style="font-size: 12px">三级验证（完成声明必须附证据）</span>
        <div v-for="e in EVIDENCE" :key="e.level" class="oc-rail__row" style="align-items: flex-start">
          <OcIcon :name="e.ok ? 'check' : 'error'" size="14px" :color="e.ok ? 'var(--oc-sev-ok)' : 'var(--oc-sev-warn)'" />
          <div>
            <div style="font-size: 12px; font-weight: 500">{{ e.level }}</div>
            <div v-for="i in e.items" :key="i" class="oc-muted" style="font-size: 11px">{{ i }}</div>
          </div>
        </div>
        <div class="oc-divider" />
        <div class="oc-flex--between">
          <span class="oc-secondary" style="font-size: 12px">验收进度</span>
          <span>6 / 8</span>
        </div>
        <Progress :percentage="75" size="small" />
        <Button size="small" variant="outline" block @click="router.push('/task/acceptance')">查看验收清单与证据链</Button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.oc-rail {
  width: var(--oc-shell-rail-w);
  flex: none;
  background: var(--oc-bg-container);
  border-left: 1px solid var(--oc-border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.oc-rail__head {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 12px;
  border-bottom: 1px solid var(--oc-border);
  font-size: 12px;
  font-weight: 500;
}

.oc-rail__head span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-rail__body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px 16px;
}

.oc-rail__hint {
  font-size: 11px;
  color: var(--td-text-color-placeholder, #8f8f8f);
  line-height: 16px;
}

.oc-rail__row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.oc-sec {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.oc-sec__code {
  font-family: var(--oc-mono);
  font-size: 11px;
  color: var(--td-text-color-placeholder, #8f8f8f);
  width: 18px;
}

.oc-sec__bar {
  width: 48px;
  height: 4px;
  background: var(--td-bg-color-secondarycontainer, #eee);
  border-radius: 2px;
  overflow: hidden;
  flex: none;
}

.oc-sec__bar i {
  display: block;
  height: 100%;
}
</style>
