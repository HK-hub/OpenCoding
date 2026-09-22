<script setup lang="ts">
/**
 * 内容治理 / DLP（N-11）：五类规则 + 命中记录 + 阻断建议（不静默拦截）。
 * 溯源：卷 24 §4.8
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Select, Table, Tag, Tooltip } from 'tdesign-vue-next';
import { downloadCsv } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import type { DlpRule } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 规则清单用 ref 渲染：新建规则后表格与统计卡即时刷新（同时写回领域数据） */
const ruleRows = ref(d.dlpRules);
const selectedId = ref(ruleRows.value[1].id);
const selected = computed(() => ruleRows.value.find((r) => r.id === selectedId.value) ?? ruleRows.value[0]);
const totalHits = computed(() => ruleRows.value.reduce((a, r) => a + r.hitCount, 0));
const blocking = computed(() => ruleRows.value.filter((r) => r.action === '阻断' || r.action === '拒绝'));
const actionTheme: Record<string, 'danger' | 'warning' | 'default'> = { 拒绝: 'danger', 阻断: 'danger', 脱敏后放行: 'warning', 标记: 'default' };
const createOpen = ref(false);
const createForm = ref({ kind: '数据外发', name: '', pattern: '', action: '阻断', scope: '组织' });
const kindOptions = ['模型白名单', '数据外发', '目录限制', '工具限制', '内容审查'].map((k) => ({ label: k, value: k }));
const actionOptions = ['拒绝', '阻断', '脱敏后放行', '标记'].map((a) => ({ label: a, value: a }));
const scopeOptions = ['组织', '团队', '项目'].map((s) => ({ label: s, value: s }));

/** 导出命中记录：全部规则的命中样本（页面已脱敏）导出为 CSV */
function exportHits() {
  const rows: (string | number)[][] = [
    ['规则', '规则类型', '动作', '作用域', '命中对象', '目标', '命中时间', '样本（脱敏）', '建议动作'],
    ...ruleRows.value.flatMap((r) => r.blocked.map((b) => [r.name, r.kind, r.action, r.scope, b.actor, b.target, new Date(b.at).toLocaleString('zh-CN'), b.sample, b.suggestion] as (string | number)[])),
  ];
  const file = downloadCsv(rows, `dlp-hits-${Date.now()}.csv`);
  MessagePlugin.success('已生成 ' + file);
}

/** 新建规则：校验必填项后落库并启用（命中即按动作处置并写审计） */
function submitRule() {
  const f = createForm.value;
  if (!f.name.trim()) { MessagePlugin.error('请填写规则名称'); return; }
  if (!f.pattern.trim()) { MessagePlugin.error('请填写匹配表达式（如 provider ∉ 白名单、path ^secrets/）'); return; }
  if (ruleRows.value.some((r) => r.name === f.name.trim())) { MessagePlugin.error(`规则名称「${f.name.trim()}」已存在，请换一个名称`); return; }
  const rule: DlpRule = {
    id: `dlp-${String(ruleRows.value.length + 1).padStart(2, '0')}`,
    kind: f.kind, name: f.name.trim(), pattern: f.pattern.trim(), action: f.action, scope: f.scope,
    hitCount: 0, enabled: true, lastHitAt: new Date().toISOString(), blocked: [],
  };
  ruleRows.value.unshift(rule);
  selectedId.value = rule.id;
  MessagePlugin.success(`已创建规则「${rule.name}」（${rule.kind} · 动作 ${rule.action} · 作用域 ${rule.scope}）：已启用，命中即处置并写审计`);
  createForm.value = { kind: '数据外发', name: '', pattern: '', action: '阻断', scope: '组织' };
  createOpen.value = false;
}

onMounted(() => {
  setTimeout(() => { state.value = d.dlpRules.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="内容治理（DLP）"
      desc="五类规则：模型白名单 / 数据外发 / 目录限制 / 工具限制 / 内容审查；命中即按动作处置并给出脱敏重试建议（不静默拦截）。"
      volume="卷 24"
      manifest="N-11"
      cli="oc dlp rules --with-hits --explain"
      :status="[{ label: '阻断优先', theme: 'danger' }, { label: '命中必留审计', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportHits">导出命中记录</Button>
        <Button size="small" theme="primary" @click="createOpen = true">新建规则</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未配置 DLP 规则"
      empty-desc="无规则意味着数据外发不受控（合规风险）；建议至少启用「模型白名单」与「数据外发」两类。"
      empty-action="应用推荐基线"
      example-task="启用「目录限制」规则，禁止 secrets/ 内容进入上下文"
      what="DLP 规则加载失败"
      why="规则引擎配置同步失败（策略版本不匹配）或目录扫描不可用"
      how="可重试；规则失效期间默认按「拒绝高危动作」处理（失败安全，不放行）"
      trace-id="trace-dlp-4c81a0"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="规则数" :value="ruleRows.length" unit="条" :target="5" target-kind="min" icon="secured" />
        <StatCard label="30 天命中" :value="totalHits" unit="次" icon="notification" />
        <StatCard label="阻断型规则" :value="blocking.length" unit="条" icon="lock" hint="拒绝 / 阻断动作" />
        <StatCard label="内容审查动作" :value="'标记（可配为阻断）'" format="raw" hint="可配置策略 + 明确提示：不静默拦截" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">规则清单（点击查看命中记录）</div>
        <Table :data="ruleRows" row-key="id" size="small" @row-click="(ctx: { row: unknown }) => (selectedId = (ctx.row as { id: string }).id)">
          <template #name="{ row }">
            <div class="oc-flex" style="gap: 6px">
              <Tag size="small" variant="outline">{{ row.kind }}</Tag>
              <b style="font-size: 12px">{{ row.name }}</b>
              <Tag v-if="!row.enabled" size="small" theme="warning" variant="light-outline">已停用</Tag>
            </div>
          </template>
          <template #pattern="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.pattern }}</span></template>
          <template #action="{ row }"><Tag size="small" :theme="actionTheme[row.action] ?? 'default'" variant="light-outline">{{ row.action }}</Tag></template>
          <template #hitCount="{ row }"><span class="oc-mono">{{ row.hitCount }}</span></template>
          <template #lastHitAt="{ row }">{{ new Date(row.lastHitAt).toLocaleString('zh-CN') }}</template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">选中规则：{{ selected.name }}</div>
          <InfoGrid
            :items="[
              { key: 'kind', label: '规则类型', value: selected.kind },
              { key: 'action', label: '动作', value: selected.action },
              { key: 'scope', label: '作用域', value: selected.scope },
              { key: 'pattern', label: '匹配表达式', value: selected.pattern, mono: true, block: true, span: 2 },
            ]"
          />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            强制项不可放宽：模型白名单与数据外发规则由组织策略锁定，资源级覆盖仅可收窄（不可删除）。
          </div>
          <CopyableId id="trace-dlp-7712" label="复制 traceId" />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">命中记录与阻断建议</div>
          <div v-for="b in selected.blocked" :key="b.at" class="oc-card" style="box-shadow: none; margin-bottom: 6px">
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag size="small" theme="danger" variant="light-outline">命中</Tag>
              <span>{{ b.actor }}</span>
              <span class="oc-mono" style="font-size: 11px">{{ b.target }}</span>
              <span class="oc-muted">{{ new Date(b.at).toLocaleString('zh-CN') }}</span>
            </div>
            <div class="oc-muted" style="font-size: 12px">样本（脱敏）：{{ b.sample }}</div>
            <div class="oc-muted" style="font-size: 12px">建议动作：{{ b.suggestion }}</div>
          </div>
          <Tooltip content="命中记录同时写入审计（数据类别）；导出命中记录需脱敏预览确认">
            <Tag size="small" variant="outline">命中即审计</Tag>
          </Tooltip>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="createOpen" header="新建 DLP 规则" width="560px" :confirm-btn="{ content: '创建并启用', theme: 'primary' }" cancel-btn="取消" @confirm="submitRule">
      <div class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 10px">
          <Select v-model="createForm.kind" size="small" style="width: 160px" aria-label="规则类型" :options="kindOptions" />
          <Select v-model="createForm.action" size="small" style="width: 150px" aria-label="命中动作" :options="actionOptions" />
          <Select v-model="createForm.scope" size="small" style="width: 120px" aria-label="作用域" :options="scopeOptions" />
        </div>
        <Input v-model="createForm.name" size="small" placeholder="规则名称（必填），如：禁止外网命令与文件上传" />
        <Input v-model="createForm.pattern" size="small" placeholder="匹配表达式（必填），如：tool ∈ {upload_file, http_post} ∧ 外部域名" />
        <div class="oc-muted" style="font-size: 12px">
          新规则默认启用并按所选动作处置（不静默拦截）；模型白名单与数据外发属组织强制项，命中记录写审计。
        </div>
      </div>
    </Dialog>
  </div>
</template>
