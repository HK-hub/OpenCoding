<script setup lang="ts">
/**
 * 特性开关与灰度（N-12）：多维作用域 + 灰度比例 + 差异 + 变更审计 + 熔断开关。
 * 溯源：卷 24 D-ENT-9
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, InputNumber, MessagePlugin, Popconfirm, Progress, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import { downloadJson } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { FeatureFlag } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 开关清单用 ref 渲染：新建/熔断/回滚后表格与统计卡即时刷新（同时写回领域数据） */
const flags = ref(d.featureFlags);
const enabled = ref<Record<string, boolean>>(Object.fromEntries(d.featureFlags.map((f) => [f.id, f.enabled])));
const selectedId = ref(flags.value[0].id);
const selected = computed(() => flags.value.find((f) => f.id === selectedId.value) ?? flags.value[0]);
const fullRollout = computed(() => flags.value.filter((f) => f.enabled && f.rolloutPercent === 100).length);
const createOpen = ref(false);
const createForm = ref({ name: '', scope: '组织', scopeValue: 'org-01', rollout: 0 });
const scopeOptions = ['组织', '团队', '项目', '用户'].map((s) => ({ label: s, value: s }));

/** 导出开关快照：当前全部开关 + 生效状态（含分桶键与审计摘要） */
function exportSnapshot() {
  const snapshot = flags.value.map((f) => ({ ...f, effectiveEnabled: enabled.value[f.id] }));
  const file = downloadJson({ count: snapshot.length, flags: snapshot }, `feature-flags-snapshot-${Date.now()}.json`);
  MessagePlugin.success('已生成 ' + file);
}

/** 新建开关：校验必填与重名后落库（默认启用前提是灰度 > 0）并写审计 */
function submitFlag() {
  const f = createForm.value;
  if (!f.name.trim()) { MessagePlugin.error('请填写开关名（如 a2a.federation）'); return; }
  if (!f.scopeValue.trim()) { MessagePlugin.error('请填写作用域值（如 org-01 / team-01 / proj-01）'); return; }
  if (!Number.isFinite(f.rollout) || f.rollout < 0 || f.rollout > 100) { MessagePlugin.error('灰度比例需为 0–100 的数字'); return; }
  if (flags.value.some((x) => x.name === f.name.trim())) { MessagePlugin.error(`开关名「${f.name.trim()}」已存在，请换一个名称`); return; }
  const flag: FeatureFlag = {
    id: `ff-${101 + flags.value.length}`,
    name: f.name.trim(),
    scope: f.scope,
    scopeValue: f.scopeValue.trim(),
    enabled: f.rollout > 0,
    rolloutPercent: f.rollout,
    bucketKey: `flag.${f.name.trim()}.bucket`,
    diff: [{ field: 'enabled', from: 'false', to: f.rollout > 0 ? 'true' : 'false' }, { field: 'rolloutPercent', from: '0', to: String(f.rollout) }],
    audit: [{ at: new Date().toISOString(), actor: '当前操作者（演示）', action: '新建开关', reason: `初始灰度 ${f.rollout}%（稳定分桶，可随时熔断）` }],
    killSwitch: true,
  };
  flags.value.unshift(flag);
  enabled.value[flag.id] = flag.enabled;
  selectedId.value = flag.id;
  MessagePlugin.success(`已创建开关「${flag.name}」（作用域 ${flag.scope} · ${flag.scopeValue}，灰度 ${flag.rolloutPercent}%）：变更写审计，可随时熔断`);
  createForm.value = { name: '', scope: '组织', scopeValue: 'org-01', rollout: 0 };
  createOpen.value = false;
}

/** 熔断（立即全关）：不可撤销，覆盖该开关的全部作用域，操作与理由写审计 */
function killFlag() {
  const f = selected.value;
  f.enabled = false;
  f.rolloutPercent = 0;
  enabled.value[f.id] = false;
  f.audit.unshift({ at: new Date().toISOString(), actor: '当前操作者（演示）', action: '熔断（立即全关）', reason: '灰度指标越线，人工熔断；影响该开关覆盖的全部团队/项目，恢复需重新开启' });
  MessagePlugin.success(`已熔断「${f.name}」：立即全关（作用域 ${f.scope} · ${f.scopeValue}），不可撤销；如需恢复请重新开启并重新灰度`);
}

/** 回滚到上一版本：按最近一次差异把开关恢复到变更前取值，回滚可再次变更 */
function rollbackFlag() {
  const f = selected.value;
  const restored: string[] = [];
  f.diff.forEach((x) => {
    if (x.field === 'enabled') { const v = x.from === 'true'; f.enabled = v; enabled.value[f.id] = v; restored.push(`enabled=${x.from}`); }
    if (x.field === 'rolloutPercent') { f.rolloutPercent = Number(x.from); restored.push(`rolloutPercent=${x.from}%`); }
  });
  f.audit.unshift({ at: new Date().toISOString(), actor: '当前操作者（演示）', action: '回滚到上一版本', reason: `恢复变更前取值（${restored.join('，') || '无差异项'}）；回滚可再次变更` });
  MessagePlugin.success(`已将「${f.name}」回滚到上一版本（${restored.join('，') || '无差异项'}）：立即生效并写审计，可再次变更`);
}

onMounted(() => {
  setTimeout(() => { state.value = d.featureFlags.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="特性开关与灰度"
      desc="能力门控 + 多维灰度（组织/团队/项目/用户）+ 稳定分桶 + 变更审计；每个开关具备熔断（kill switch）能力。"
      volume="卷 24"
      manifest="N-12"
      cli="oc flag list --with-rollout --with-audit"
      :status="[{ label: '变更必审计', theme: 'warning' }, { label: '可熔断', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportSnapshot">导出开关快照</Button>
        <Button size="small" theme="primary" @click="createOpen = true">新建开关</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="没有特性开关"
      empty-desc="新增能力默认走开关灰度；无开关意味着变更只能全量发布（风险集中）。"
      empty-action="创建默认开关集"
      example-task="为 a2a.federation 创建开关并灰度到预发团队 10%"
      what="开关列表加载失败"
      why="开关中心配置读取失败（缓存未分区或配置版本回滚中）"
      how="可重试；开关读取失败时按「关闭」处理（失败安全，不误开实验能力）"
      trace-id="trace-flag-7712bc"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="开关总数" :value="flags.length" unit="个" :target="8" target-kind="min" icon="flag" />
        <StatCard label="已启用" :value="Object.values(enabled).filter(Boolean).length" unit="个" />
        <StatCard label="全量灰度" :value="fullRollout" unit="个" :target="5" target-kind="max" hint="全量前需通过变更门禁" />
        <StatCard label="熔断可用" :value="flags.filter((f) => f.killSwitch).length" unit="个" icon="secured" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">开关清单（切换即写审计）</div>
        <Table :data="flags" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
          <template #name="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.name }}</span></template>
          <template #scopeValue="{ row }"><span>{{ row.scope }} · {{ row.scopeValue }}</span></template>
          <template #enabled="{ row }">
            <Switch v-model="enabled[row.id as string]" size="small" @click.stop />
          </template>
          <template #rolloutPercent="{ row }">
            <div style="min-width: 130px">
              <Progress :percentage="row.rolloutPercent" :status="row.rolloutPercent === 100 ? 'warning' : 'active'" :label="false" size="small" />
              <span class="oc-muted" style="font-size: 11px">{{ row.rolloutPercent }}%（分桶：{{ row.bucketKey }}）</span>
            </div>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">选中：{{ selected.name }}</div>
          <InfoGrid
            :items="[
              { key: 'scope', label: '作用域', value: `${selected.scope} · ${selected.scopeValue}` },
              { key: 'bucket', label: '分桶键', value: selected.bucketKey, mono: true },
              { key: 'kill', label: '熔断开关', value: selected.killSwitch ? '可用' : '不可用' },
              { key: 'diff', label: '最近差异', value: selected.diff.map((x) => `${x.field}: ${x.from} → ${x.to}`).join('；'), span: 2 },
            ]"
          />
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Popconfirm theme="danger" :content="`熔断「${selected.name}」：立即全关（作用域 ${selected.scope} · ${selected.scopeValue}），影响面为该开关覆盖的全部团队/项目；不可撤销，恢复需重新开启灰度。是否继续？`" @confirm="killFlag">
              <Button size="small" theme="danger" variant="outline">熔断（立即全关）</Button>
            </Popconfirm>
            <Popconfirm theme="warning" :content="`回滚「${selected.name}」到上一版本：按最近差异恢复变更前取值（enabled / 灰度比例），立即生效并可再次变更。是否继续？`" @confirm="rollbackFlag">
              <Button size="small" variant="outline">回滚到上一版本</Button>
            </Popconfirm>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            危险操作：熔断为不可撤销（需重新开启）；影响面为该开关覆盖的全部团队 / 项目，操作者与理由写审计。
          </div>
          <CopyableId id="trace-flag-7719" label="复制 traceId" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">变更审计（差异留痕）</div>
          <div v-for="a in selected.audit" :key="a.at" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 4px">
            <span class="oc-muted" style="font-size: 12px">{{ new Date(a.at).toLocaleString('zh-CN') }}</span>
            <b style="font-size: 12px">{{ a.actor }}</b>
            <Tag size="small" variant="outline">{{ a.action }}</Tag>
            <span class="oc-muted" style="font-size: 12px">理由：{{ a.reason }}</span>
          </div>
          <div class="oc-state__hint" style="margin-top: 6px">
            不静默失败：开关被熔断或灰度回退时，界面显示「降级 / 关闭原因」与恢复路径。
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="createOpen" header="新建特性开关" width="560px" :confirm-btn="{ content: '创建开关', theme: 'primary' }" cancel-btn="取消" @confirm="submitFlag">
      <div class="oc-stack">
        <Input v-model="createForm.name" size="small" placeholder="开关名（必填），如 a2a.federation" />
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Select v-model="createForm.scope" size="small" style="width: 130px" aria-label="作用域" :options="scopeOptions" />
          <Input v-model="createForm.scopeValue" size="small" style="width: 190px" placeholder="作用域值（必填），如 org-01" />
          <InputNumber v-model="createForm.rollout" :min="0" :max="100" size="small" theme="normal" style="width: 150px" aria-label="初始灰度（%）" />
        </div>
        <div class="oc-muted" style="font-size: 12px">
          灰度 &gt; 0 即启用并按稳定分桶放量；新建即写审计，可随时熔断（立即全关、不可撤销）。
        </div>
      </div>
    </Dialog>
  </div>
</template>
