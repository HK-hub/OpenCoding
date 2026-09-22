<script setup lang="ts">
/**
 * 归档与回收站（S-01 / 卷 19 §保留与合规删除）：
 * SESSION / ARCHIVED / TRASH 三态切换、恢复、彻底删除（合规删除：穿透备份 + 生成删除证明）、清空回收站二次确认。
 * 语义：归档只改可见性不动数据；回收站保留 30 天；合规删除不可经备份恢复，且一旦开始不可中断（无安全点）。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, Checkbox, Dialog, Input, MessagePlugin, Popconfirm, Progress, RadioGroup, RadioButton, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useSessionStore } from '@/stores/session';
import { useUiStore } from '@/stores/ui';
import type { Session } from '@/mock/data/session';
import { makeError, type MockError } from '@/mock/runtime';

const store = useSessionStore();
const ui = useUiStore();

type Tab = 'SESSION' | 'ARCHIVED' | 'TRASH';
const tab = ref<Tab>('SESSION');
const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const pageSize = ref(6);

const purgeTarget = ref<Session | null>(null);
const purgeConfirm = ref('');
const purging = ref(false);
const progress = ref(0);
const certificate = ref<{ id: string; hash: string; at: string; scope: string[] } | null>(null);
const emptyAllOpen = ref(false);
const emptyAllChecked = ref(false);
/** 弹窗可见性用可写计算属性承载（关闭时清理目标，避免残留已删除对象） */
const purgeVisible = computed({
  get: () => purgeTarget.value !== null,
  set: (v: boolean) => {
    if (!v) purgeTarget.value = null;
  },
});
const certVisible = computed({
  get: () => certificate.value !== null,
  set: (v: boolean) => {
    if (!v) certificate.value = null;
  },
});

const list = computed(() => store.sessions.filter((s) => s.retention === tab.value));
const edge = computed(() => list.value.length > pageSize.value);
const shown = computed(() => list.value.slice(0, pageSize.value));
const trashed = computed(() => store.sessions.filter((s) => s.retention === 'TRASH'));

const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  if (!list.value.length) return 'EMPTY' as const;
  return edge.value ? ('EDGE_DATA' as const) : ('NORMAL' as const);
});

const TAB_HINT: Record<Tab, string> = {
  SESSION: '活跃会话：正常参与调度与上下文装载。',
  ARCHIVED: '已归档：只读保留，可恢复；不参与默认检索与调度。',
  TRASH: '回收站：保留 30 天，可恢复；到期后按留存策略自动清理。',
};

function moveToTrash(s: Session) {
  store.remove(s.id);
  MessagePlugin.success(`「${s.title}」已移入回收站（保留 30 天，可恢复）`);
}

/** 合规删除进度定时器句柄（完成与卸载都要清理） */
let purgeTimer: number | null = null;
/** 合规删除：生成删除证明，说明不可经备份恢复（穿透备份/副本/派生索引） */
function startPurge() {
  const s = purgeTarget.value;
  if (!s || purgeConfirm.value.trim() !== s.shortId) return;
  purging.value = true;
  progress.value = 0;
  purgeTimer = window.setInterval(() => {
    progress.value = Math.min(100, progress.value + 20);
    if (progress.value >= 100) {
      if (purgeTimer !== null) window.clearInterval(purgeTimer);
      purgeTimer = null;
      store.purge(s.id);
      purging.value = false;
      certificate.value = {
        id: `DP-${s.shortId.replace('S-', '')}`,
        hash: `sha256:${s.shortId.slice(2).toLowerCase()}9f21c0d4e7`,
        at: new Date().toISOString(),
        scope: ['会话条目与事件', '上下文快照', '工件引用索引', '派生摘要', '检索索引条目', '备份与副本'],
      };
      purgeTarget.value = null;
      purgeConfirm.value = '';
      ui.pushNotification({
        kind: 'security',
        level: 'P1',
        title: '合规删除已完成',
        body: `删除证明 ${certificate.value.id}；穿透备份与派生副本，不可经备份恢复。`,
        actions: [{ label: '查看证明', path: '/enterprise/compliance' }],
        aggregateKey: `purge-${s.id}`,
        penetrateQuiet: true,
        channel: 'inapp',
      });
    }
  }, 180);
}

function emptyAll() {
  const ids = trashed.value.map((s) => s.id);
  ids.forEach((id) => store.purge(id));
  emptyAllOpen.value = false;
  emptyAllChecked.value = false;
  MessagePlugin.success(`回收站已清空（${ids.length} 个会话彻底删除，删除证明已归档）`);
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
onUnmounted(() => {
  // 离开页面时清理进度定时器：避免残留无归属定时器继续推进已卸载组件的状态
  if (purgeTimer !== null) window.clearInterval(purgeTimer);
  purgeTimer = null;
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="归档与回收站"
      desc="三态（活跃 / 已归档 / 回收站）切换与恢复；彻底删除走合规删除：穿透备份与派生副本，并生成删除证明。"
      volume="卷 19"
      manifest="S-01"
      cli="oc session archive <id> | oc session restore <id> | oc session purge <id> --compliance"
      :status="[{ label: '回收站保留 30 天', theme: 'default' }, { label: '合规删除不可撤销', theme: 'danger' }]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次列表读取失败">
          <Button size="small" variant="text" @click="failure = makeError('CONFLICT', 'session index 正在重建')">模拟异常</Button>
        </Tooltip>
        <Popconfirm
          theme="danger"
          content="清空回收站：其中所有会话将被彻底删除（合规删除，不可经备份恢复）。"
          @confirm="emptyAllOpen = true"
        >
          <Button size="small" theme="danger" variant="outline" :disabled="!trashed.length">清空回收站</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="活跃会话" :value="store.sessions.filter((s) => s.retention === 'SESSION').length" unit="个" format="raw" icon="chat" />
      <StatCard label="已归档" :value="store.sessions.filter((s) => s.retention === 'ARCHIVED').length" unit="个" format="raw" icon="history" />
      <StatCard label="回收站" :value="trashed.length" unit="个" format="raw" icon="delete" />
      <StatCard label="回收站保留期" :value="30" unit="天" format="raw" icon="time" hint="到期后按留存策略自动清理（可在企业治理调整）" />
    </div>

    <RadioGroup v-model="tab" variant="default-filled">
      <RadioButton value="SESSION">活跃（{{ store.sessions.filter((s) => s.retention === 'SESSION').length }}）</RadioButton>
      <RadioButton value="ARCHIVED">已归档（{{ store.sessions.filter((s) => s.retention === 'ARCHIVED').length }}）</RadioButton>
      <RadioButton value="TRASH">回收站（{{ trashed.length }}）</RadioButton>
    </RadioGroup>

    <div class="oc-muted" style="font-size: 12px">{{ TAB_HINT[tab] }}</div>

    <StateShell
      :state="shellState"
      stage="正在读取会话索引…"
      cancellable
      empty-title="这里还没有会话"
      empty-desc="回收站为空，或该状态下没有任何会话；归档与删除都可在本页恢复（合规删除除外）。"
      empty-action="回到会话工作台"
      what="会话列表读取失败"
      :why="failure?.message ?? ''"
      how="可重试；冲突多由其他端先行改动导致，刷新后以最新状态为准。"
      :trace-id="failure?.traceId ?? ''"
      :collapsed-summary="`共 ${list.length} 个会话，已折叠展示前 ${pageSize} 个（避免一次性渲染过多）`"
      :page-size="pageSize"
      :disabled-capabilities="['归档', '恢复', '彻底删除']"
      @retry="failure = null; ui.simulateReconnect()"
      @load-more="pageSize += 6"
      @empty-action="tab = 'SESSION'"
    >
      <div class="oc-stack">
        <div v-for="s in shown" :key="s.id" class="oc-card">
          <div class="oc-flex--between oc-flex--wrap">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; min-width: 0">
              <OcIcon :name="s.retention === 'TRASH' ? 'delete' : s.retention === 'ARCHIVED' ? 'history' : 'chat'" size="14px" />
              <b class="oc-truncate" style="font-size: 13px">{{ s.title }}</b>
              <CopyableId :id="s.shortId" label="复制会话短号" />
              <Tag size="small" variant="outline" class="oc-mono">{{ s.repo }} · {{ s.branch }}</Tag>
              <Tag v-if="s.forkedFrom" size="small" theme="primary" variant="light-outline">fork 自 {{ s.forkedFrom }}</Tag>
            </div>
            <div class="oc-flex" style="gap: 6px">
              <template v-if="s.retention === 'SESSION'">
                <Button size="small" variant="outline" @click="store.archive(s.id)">归档</Button>
              </template>
              <template v-else>
                <Button size="small" variant="outline" @click="store.restore(s.id)">恢复</Button>
              </template>
              <Popconfirm v-if="s.retention !== 'TRASH'" theme="warning" content="移入回收站：保留 30 天，期间可恢复。" @confirm="moveToTrash(s)">
                <Button size="small" variant="text">移入回收站</Button>
              </Popconfirm>
              <Button v-else size="small" theme="danger" variant="outline" @click="purgeTarget = s; purgeConfirm = ''">彻底删除</Button>
            </div>
          </div>
          <InfoGrid
            :columns="2"
            style="margin-top: 8px"
            :items="[
              { key: 'state', label: '运行状态', value: s.state, tag: { text: s.state, theme: s.state === 'FAILED' ? 'danger' : s.state === 'COMPLETED' ? 'success' : 'primary' } },
              { key: 'updated', label: '最近更新', value: new Date(s.updatedAt).toLocaleString('zh-CN') },
              { key: 'cost', label: '已花费', value: `$${s.cost.toFixed(4)}`, mono: true },
              { key: 'messages', label: '消息数', value: `${s.messages} 条` },
            ]"
          />
        </div>
      </div>
    </StateShell>

    <!-- 合规删除：二次确认 + 不可中断说明 -->
    <Dialog v-model:visible="purgeVisible" header="彻底删除（合规删除）" theme="danger" width="560px" :footer="false">
      <div v-if="purgeTarget" class="oc-stack">
        <div style="font-size: 13px">
          将彻底删除「{{ purgeTarget.title }}」（{{ purgeTarget.shortId }}）及其事件、上下文快照、工件引用与派生索引。
        </div>
        <div class="oc-card" style="border-left: 3px solid var(--oc-sev-error)">
          <div style="font-weight: 600; font-size: 13px">不可经备份恢复</div>
          <div class="oc-secondary" style="font-size: 12px">
            合规删除会穿透备份、副本与派生索引（即备份中残留的副本也会在滚动清理中失效）；这是与「移入回收站」的本质区别。
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
            删除一旦开始即不可中断（无安全点）：避免出现「半删除」状态导致审计链与索引不一致。
          </div>
        </div>
        <div class="oc-flex" style="gap: 8px">
          <span style="font-size: 13px">输入会话短号确认：</span>
          <Input v-model="purgeConfirm" size="small" :placeholder="purgeTarget.shortId" style="width: 200px" />
        </div>
        <Progress v-if="purging" :percentage="progress" :stroke-width="4" :label="`正在穿透删除… ${progress}%`" />
        <div class="oc-flex" style="gap: 8px">
          <Button theme="danger" :disabled="purgeConfirm.trim() !== purgeTarget.shortId || purging" :loading="purging" @click="startPurge">
            {{ purging ? '删除中（不可中断）' : '确认彻底删除' }}
          </Button>
          <Button variant="text" :disabled="purging" @click="purgeTarget = null">取消（未开始可取消）</Button>
        </div>
      </div>
    </Dialog>

    <!-- 删除证明 -->
    <Dialog v-model:visible="certVisible" header="删除证明（可导出）" width="600px" :footer="false">
      <div v-if="certificate" class="oc-stack">
        <div class="oc-flex" style="gap: 8px">
          <OcIcon name="check" size="16px" color="var(--oc-sev-ok)" />
          <b>合规删除已完成</b>
          <CopyableId :id="certificate.id" label="复制证明编号" />
        </div>
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'scope', label: '删除范围', value: certificate.scope.join(' / '), block: true },
            { key: 'hash', label: '完整性锚点', value: certificate.hash, mono: true, copyable: true },
            { key: 'at', label: '执行时间', value: new Date(certificate.at).toLocaleString('zh-CN') },
            { key: 'irreversible', label: '可恢复性', value: '不可经备份恢复（已穿透备份与派生副本）' },
          ]"
        />
        <div class="oc-muted" style="font-size: 12px">证明写入审计链「企业治理 → 审计与合规报告」，可作为对外合规材料导出。</div>
        <Button theme="primary" variant="outline" @click="certificate = null">我已记录</Button>
      </div>
    </Dialog>

    <!-- 清空回收站：二次确认 -->
    <Dialog v-model:visible="emptyAllOpen" header="清空回收站（二次确认）" theme="danger" width="520px" :footer="false">
      <div class="oc-stack">
        <div style="font-size: 13px">将彻底删除回收站内 {{ trashed.length }} 个会话（合规删除，不可经备份恢复）。</div>
        <Checkbox v-model="emptyAllChecked" size="small">我确认这些会话不再需要，且已知悉不可经备份恢复</Checkbox>
        <div class="oc-flex" style="gap: 8px">
          <Button theme="danger" :disabled="!emptyAllChecked" @click="emptyAll">确认清空（{{ trashed.length }}）</Button>
          <Button variant="text" @click="emptyAllOpen = false">取消</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>
