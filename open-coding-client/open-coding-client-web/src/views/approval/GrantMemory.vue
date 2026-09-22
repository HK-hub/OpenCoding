<script setup lang="ts">
/**
 * 授权记忆（P-05 / 卷 06 D-PERM-6）：
 * 六级范围（once/session/project/workspace/pattern/dir）列表、到期时间、来源审批、撤销立即生效；
 * 「按模式 / 按目录」在授权前必须可展开预览（禁止盲授）。once 不落记忆，只在本页作为词汇对照出现。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Popconfirm, RadioGroup, RadioButton, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { db } from '@/mock/db';
import { SCOPE_CATALOG } from '@/mock/data/approval';
import type { GrantScope } from '@/mock/data/approval';
import { makeError, type MockError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const memories = db.grantMemories;
const scopeMeta = (s: string) => SCOPE_CATALOG.find((c) => c.scope === s);

const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const filter = ref<'ALL' | GrantScope>('ALL');
const revoked = ref<Record<string, string>>({});
const expanded = ref<string[]>([]);
const pageSize = ref(5);

const active = computed(() => memories.filter((m) => !revoked.value[m.id]));
const list = computed(() => active.value.filter((m) => filter.value === 'ALL' || m.scope === filter.value));
const edge = computed(() => list.value.length > pageSize.value);
const shown = computed(() => list.value.slice(0, pageSize.value));
const revokedList = computed(() => memories.filter((m) => revoked.value[m.id]));

const permanent = (expiresAt: string | null) => expiresAt === null;
const daysLeft = (expiresAt: string | null) => (expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)) : null);

/** 范围预览（禁止盲授）：确认前可见该模式/目录命中什么，以及不命中什么 */
function preview(m: (typeof memories)[number]): string[] {
  if (m.scope === 'pattern') {
    return [
      `模式命中示例：${m.tool} 参数匹配 ${m.pattern}`,
      '不命中示例：参数改写（新增 -D/-P 覆盖）或换成相邻命令（verify ≠ test）→ 会重新询问',
    ];
  }
  if (m.scope === 'dir') {
    return [
      `目录命中：${m.pattern}（含子目录）`,
      '不命中：目录外路径、符号链接指向区外的路径 → 会重新询问',
    ];
  }
  return [`生效范围：${scopeMeta(m.scope)?.chip ?? m.scope}`, `同类动作（工具 ${m.tool}）免询问，其余工具不受影响`];
}

function revoke(m: (typeof memories)[number]) {
  revoked.value = { ...revoked.value, [m.id]: new Date().toISOString() };
  ui.pushNotification({
    kind: 'security',
    level: 'P1',
    title: '授权记忆已撤销（立即生效）',
    body: `${scopeMeta(m.scope)?.chip ?? m.scope} · ${m.tool} ${m.pattern}；后续同类动作将重新询问`,
    actions: [{ label: '查看审批历史', path: '/approval/history' }],
    aggregateKey: `revoke-${m.id}`,
    penetrateQuiet: false,
    channel: 'inapp',
  });
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="授权记忆"
      desc="审批记忆的六级范围（once/session/project/workspace/pattern/dir）：可查、可撤销、撤销立即生效；模式与目录授权必须可展开预览，禁止盲授。"
      volume="卷 06"
      manifest="P-05"
      cli="oc approval memory list --active | oc approval memory revoke GM-01"
      :status="[{ label: '撤销立即生效', theme: 'success' }, { label: 'R4/R5 不落记忆', theme: 'danger' }]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次记忆读取失败">
          <Button size="small" variant="text" @click="failure = makeError('PERMISSION_DENIED', 'memory store 拒绝')">模拟异常</Button>
        </Tooltip>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="生效中的授权记忆" :value="active.length" unit="条" format="raw" icon="bookmark" />
      <StatCard label="含预览约束（pattern/dir）" :value="active.filter((m) => m.scope === 'pattern' || m.scope === 'dir').length" unit="条" format="raw" icon="filter" />
      <StatCard label="永久有效（随工作区/项目）" :value="active.filter((m) => permanent(m.expiresAt)).length" unit="条" format="raw" icon="time" />
      <StatCard label="撤销生效时延" value="0" unit="s" format="raw" icon="refresh" hint="撤销写入事件 permission.memory.revoked 后立即生效" />
    </div>

    <RadioGroup v-model="filter" variant="default-filled">
      <RadioButton value="ALL">全部（{{ active.length }}）</RadioButton>
      <RadioButton v-for="c in SCOPE_CATALOG" :key="c.scope" :value="c.scope">
        {{ c.chip }}（{{ active.filter((m) => m.scope === c.scope).length }}）
      </RadioButton>
    </RadioGroup>

    <StateShell
      :state="ui.connection !== 'CONNECTED' ? 'OFFLINE' : failure ? 'ERROR' : phase === 'LOADING' ? 'LOADING' : list.length ? (edge ? 'EDGE_DATA' : 'NORMAL') : 'EMPTY'"
      stage="正在读取授权记忆（工具 × 资源模式索引）…"
      cancellable
      empty-title="该范围下没有授权记忆"
      empty-desc="审批时未选择任何留存范围，或对应记忆已被撤销（撤销立即生效）。"
      empty-action="回到审批中心"
      what="授权记忆读取失败"
      :why="failure?.message ?? ''"
      how="可重试；企业策略锁定时只读展示来源，请在「权限与审批 → 策略」确认锁定项。"
      :trace-id="failure?.traceId ?? ''"
      :collapsed-summary="`授权记忆 ${list.length} 条，已折叠展示前 ${pageSize} 条（避免一次渲染过多）`"
      :page-size="pageSize"
      :disabled-capabilities="['撤销授权', '范围预览展开']"
      @retry="failure = null; ui.simulateReconnect()"
      @load-more="pageSize += 5"
      @empty-action="filter = 'ALL'"
    >
      <div class="oc-stack">
        <div v-for="m in shown" :key="m.id" class="oc-card">
          <div class="oc-flex--between oc-flex--wrap">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag theme="primary" size="small" variant="light-outline">{{ scopeMeta(m.scope)?.chip ?? m.scope }}</Tag>
              <b class="oc-mono" style="font-size: 12px">{{ m.tool }}</b>
              <span class="oc-mono oc-secondary" style="font-size: 12px">{{ m.pattern }}</span>
              <Tooltip :content="scopeMeta(m.scope)?.semantic ?? ''">
                <Tag size="small" variant="outline">为什么生效</Tag>
              </Tooltip>
            </div>
            <div class="oc-flex" style="gap: 6px">
              <Tag :theme="permanent(m.expiresAt) ? 'default' : 'warning'" size="small" variant="light-outline">
                {{ permanent(m.expiresAt) ? '长期有效' : `剩余 ${daysLeft(m.expiresAt)} 天` }}
              </Tag>
              <Button size="small" variant="text" @click="expanded.includes(m.id) ? (expanded = expanded.filter((x) => x !== m.id)) : expanded.push(m.id)">
                {{ expanded.includes(m.id) ? '收起预览' : '展开预览' }}
              </Button>
              <Popconfirm
                theme="warning"
                content="撤销立即生效：正在进行的动作不受影响，后续同类动作将重新询问并写入审计（permission.memory.revoked）。"
                @confirm="revoke(m)"
              >
                <Button size="small" theme="danger" variant="outline">撤销</Button>
              </Popconfirm>
            </div>
          </div>
          <InfoGrid
            :columns="3"
            style="margin-top: 8px"
            :items="[
              { key: 'source', label: '来源审批', value: m.source, mono: true, copyable: true },
              { key: 'created', label: '授予时间', value: new Date(m.createdAt).toLocaleString('zh-CN') },
              { key: 'expire', label: '到期时间', value: m.expiresAt ? new Date(m.expiresAt).toLocaleString('zh-CN') : '不自动到期（随范围生命周期）' },
            ]"
          />
          <div v-if="expanded.includes(m.id)" class="oc-card__scopepreview">
            <div class="oc-muted" style="font-size: 11px">范围预览（禁止盲授：确认前必须可看到命中与不命中的边界）</div>
            <div v-for="p in preview(m)" :key="p" class="oc-secondary" style="font-size: 12px">· {{ p }}</div>
          </div>
        </div>
      </div>
    </StateShell>

    <div v-if="revokedList.length" class="oc-card">
      <h3 class="oc-card__title">
        最近撤销（审计留痕，不可删除）
        <Tag size="small" variant="outline">事件 permission.memory.revoked</Tag>
      </h3>
      <div class="oc-stack" style="gap: 4px">
        <div v-for="m in revokedList" :key="m.id" class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" theme="default" variant="light-outline">已撤销（立即生效）</Tag>
          <span class="oc-mono" style="font-size: 12px">{{ m.id }}</span>
          <span style="font-size: 12px">{{ scopeMeta(m.scope)?.chip }} · {{ m.tool }} {{ m.pattern }}</span>
          <span class="oc-muted" style="font-size: 11px">撤销于 {{ new Date(revoked[m.id]).toLocaleString('zh-CN') }} · 来源 {{ m.source }}</span>
          <CopyableId :id="m.source" label="复制来源审批号" />
        </div>
      </div>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">六级范围词汇表（唯一权威，禁止自造第七种）</h3>
      <div class="oc-stack" style="gap: 6px">
        <div v-for="c in SCOPE_CATALOG" :key="c.scope" class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Tag size="small" :theme="c.scope === 'once' ? 'default' : 'primary'" variant="light-outline">{{ c.chip }}</Tag>
          <OcIcon v-if="c.scope === 'once'" name="help" size="12px" />
          <span style="font-size: 12px">{{ c.semantic }}</span>
          <span class="oc-muted" style="font-size: 11px">可用条件：{{ c.availability }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oc-card__scopepreview {
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--td-bg-color-secondarycontainer, #f6f6f6);
  border-radius: 4px;
}
</style>
