<script setup lang="ts">
/** 别名映射表（T-10）：旧名 → 新名 + 兼容期 + 变更事件。溯源：卷 05 §10（兼容期 ≥ 2 版本） */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';

const ui = useUiStore();
const { aliasMappings } = toolData;

const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const err = ref(makeError('NOT_FOUND', '别名表版本与工具注册表不一致'));

const expiring = computed(() => aliasMappings.filter((a) => a.status === '即将到期'));
const deprecated = computed(() => aliasMappings.filter((a) => a.status === '已废弃'));
const callTotal = computed(() => aliasMappings.reduce((a, m) => a + m.callCount, 0));

const columns = [
  { colKey: 'oldName', title: '旧名（兼容中）', width: 150 },
  { colKey: 'newName', title: '新名（当前）', width: 170 },
  { colKey: 'reason', title: '变更原因', ellipsis: true },
  { colKey: 'compatUntil', title: '兼容期', width: 210 },
  { colKey: 'callCount', title: '近 30 天调用', width: 120 },
  { colKey: 'changedEvent', title: '变更事件', width: 190 },
  { colKey: 'status', title: '状态', width: 100 },
];

function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => {
    state.value = aliasMappings.length ? 'NORMAL' : 'EMPTY';
  }, 200);
}

onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <div>
      <PageHeader
        title="别名映射"
        desc="工具改名的兼容契约：旧名 → 新名映射保留 ≥ 2 个版本，映射变更生成事件；解析失败回喂「相似名建议」而非直接报错。"
        volume="卷 05"
        manifest="T-10"
        cli="oc tools alias list --expiring --explain"
        :status="[{ label: `即将到期 ${expiring.length}`, theme: expiring.length ? 'warning' : 'success' }, { label: `已废弃 ${deprecated.length}`, theme: 'default' }]"
      >
        <template #actions>
          <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
          <Popconfirm theme="warning" content="延长兼容期会保留旧名映射更久（可再次缩短）；延长期间每次命中都会写入审计提醒。确认延长 2 个版本？" @confirm="MessagePlugin.success('兼容期已延长（审计已记录操作者与理由）')">
            <Button size="small" theme="primary">延长全部即将到期项</Button>
          </Popconfirm>
        </template>
      </PageHeader>
    </div>

    <div class="oc-grid oc-grid--4">
      <StatCard label="映射条目" :value="aliasMappings.length" format="raw" icon="link" />
      <StatCard label="生效中" :value="aliasMappings.filter((a) => a.status === '生效中').length" format="raw" icon="check" />
      <StatCard label="即将到期（≤ 24h）" :value="expiring.length" format="raw" icon="time" hint="到期后旧名解析失败，回喂候选新名" />
      <StatCard label="旧名调用量（30 天）" :value="callTotal" icon="task" hint="调用量越高，兼容期越应延长" />
    </div>

    <StateShell
      :state="state"
      empty-title="没有别名映射"
      empty-desc="当前工具注册表没有保留旧名（或首次运行尚未产生改名事件）。"
      empty-action="重新加载"
      example-task="查看 edit_file 的历史别名（patch → apply_patch）"
      :what="'别名表加载失败'"
      :why="err.message"
      how="别名表版本与注册表不一致（可能刚热更新工具包）；重试即可重新拉取。"
      :trace-id="err.traceId"
      @retry="refresh"
      @empty-action="refresh"
    >
      <div class="oc-card">
        <h3 class="oc-card__title">
          映射表
          <CliHint command="oc tools alias list --json" label="导出映射表" />
        </h3>
        <Table row-key="aliasId" size="small" :data="aliasMappings" :columns="columns">
          <template #oldName="{ row }"><span class="oc-mono" style="text-decoration: line-through; opacity: 0.7">{{ row.oldName }}</span></template>
          <template #newName="{ row }"><span class="oc-mono" style="font-weight: 600">{{ row.newName }}</span></template>
          <template #compatUntil="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Tooltip :content="`兼容截止：${new Date(row.compatUntil).toLocaleString('zh-CN')}`">
                <Tag size="small" variant="light-outline" :theme="row.remainingDays < 1 ? 'danger' : row.remainingDays < 2 ? 'warning' : 'default'">
                  剩余 {{ row.remainingDays }} 天
                </Tag>
              </Tooltip>
              <span class="oc-muted" style="font-size: 11px">{{ new Date(row.compatUntil).toLocaleDateString('zh-CN') }}</span>
            </div>
          </template>
          <template #callCount="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.callCount > 100 ? 'primary' : 'default'">{{ row.callCount }}</Tag>
          </template>
          <template #changedEvent="{ row }"><CopyableId :id="row.changedEvent" label="复制事件" :short="22" /></template>
          <template #status="{ row }">
            <Tag size="small" variant="light-outline" :theme="row.status === '生效中' ? 'success' : row.status === '即将到期' ? 'warning' : 'danger'">{{ row.status }}</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">解析语义（模型幻觉名同样受益）</h3>
          <InfoGrid :columns="1" :items="[
            { key: 's1', label: '① 精确匹配', value: '新名 / 别名表命中 → 直接解析（记录命中来源）' },
            { key: 's2', label: '② 相似名建议', value: '未命中时基于编辑距离 + 工具族给出候选（回喂结构化错误，含候选清单）' },
            { key: 's3', label: '③ 兼容期告警', value: '命中旧名时回喂「已改名」提示 + 变更事件引用（不阻断执行）' },
            { key: 's4', label: '④ 到期行为', value: '兼容期结束：旧名解析失败，仅返回候选新名（不静默降级到近似工具）' },
          ]" />
        </div>
        <div class="oc-card">
          <h3 class="oc-card__title">即将到期与已废弃</h3>
          <div v-if="expiring.length || deprecated.length" class="oc-stack">
            <div v-for="a in [...expiring, ...deprecated]" :key="a.aliasId" class="oc-flex oc-flex--between">
              <span class="oc-mono" style="font-size: 12px">{{ a.oldName }} → {{ a.newName }}</span>
              <Tag size="small" variant="light-outline" :theme="a.status === '已废弃' ? 'danger' : 'warning'">{{ a.status }}（剩余 {{ a.remainingDays }} 天）</Tag>
            </div>
          </div>
          <div v-else class="oc-muted" style="font-size: 12px">无即将到期或已废弃映射，兼容期充足。</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
