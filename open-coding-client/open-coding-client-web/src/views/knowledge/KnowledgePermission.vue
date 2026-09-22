<script setup lang="ts">
/**
 * W-07 权限与多租户：权限标签 + 前置过滤校验 + 共享知识域 + 检索审计（含越权探测演示）。
 * 关键：后置过滤存在存在性侧信道，必须前置过滤；越权结果不得返回（页面只演示「已过滤 N 条」，不泄露内容）。
 * 溯源：卷 11 D-KB-7 / §4.5 / BUILD-MANIFEST W-07
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';

const ui = useUiStore();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const visibilityFilter = ref('all');
const sharedDomain = ref(false);
const probeResult = ref<string | null>(null);
const probing = ref(false);

const rows = computed(() => data.searchResults.filter((r) => visibilityFilter.value === 'all' || r.permissionTags.visibility === visibilityFilter.value));
const crossTenant = computed(() => data.searchResults.filter((r) => r.permissionTags.tenant !== '云枢科技').length);

const CHECKS = [
  { name: '召回条件带权限约束（前置）', ok: true, note: '三路召回均在检索条件内联租户/项目/ACL 约束' },
  { name: '计数侧信道测试（越权探测不可区分）', ok: true, note: '越权探测与「无结果」返回体一致，仅回报已过滤数量' },
  { name: '引用打开二次鉴权', ok: true, note: '打开引用时重新校验，权限回收后立即失效' },
  { name: '跨租户零共享（默认）', ok: true, note: '共享知识域默认关闭，开启需显式授权与审计留痕' },
  { name: '凭据隔离（各源独立）', ok: true, note: '连接器凭证经 SecretPort，界面与日志不回显明文' },
];

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '权限受限', value: 'PERMISSION_DENIED' },
];

/** 越权探测演示：只回报「已过滤 N 条」，绝不返回任何越权内容或标题 */
function runProbe() {
  probing.value = true;
  window.setTimeout(() => {
    probing.value = false;
    probeResult.value = `探测完成：命中 ${data.queryTrace.permissionFiltered} 条无权结果，已前置过滤；返回体与「无结果」完全一致（无计数侧信道可区分）。`;
    MessagePlugin.warning('越权探测：未返回任何内容，仅回报过滤数量');
  }, 420);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="知识权限与多租户"
      desc="权限标签在索引时写入，检索时前置过滤；越权结果不返回（仅回报已过滤数量），跨租户默认零共享。"
      volume="卷 11"
      manifest="W-07"
      cli="oc kb permission check --probe cross_tenant"
      :status="[{ label: '前置过滤', theme: 'success' }, { label: '零共享默认', theme: 'primary' }]"
    >
      <template #actions>
        <Select v-model="visibilityFilter" size="small" style="width: 140px" :options="[{ label: '全部可见范围', value: 'all' }, { label: '公开', value: '公开' }, { label: '项目', value: '项目' }, { label: '内部', value: '内部' }, { label: '受限', value: '受限' }]" />
        <Button size="small" theme="primary" variant="outline" :loading="probing" @click="runProbe">越权探测演示</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="已过滤（本次检索）" :value="data.queryTrace.permissionFiltered" unit="条" icon="lock" hint="只回报数量，不返回标题与内容（杜绝侧信道）" />
      <StatCard label="权限标签覆盖" :value="100" unit="%" format="raw" icon="secured" hint="索引时写入租户/项目/可见范围/ACL 摘要" />
      <StatCard label="跨租户结果" :value="crossTenant" unit="条" icon="user" :lower-is-better="true" hint="默认 0；共享知识域开启后才可能出现" />
      <StatCard label="审计记录" :value="data.sources.length * 2" unit="条" icon="history" hint="检索与引用打开均记录（谁/何时/查了什么/返回哪些来源）" />
    </div>

    <StateShell
      :state="state"
      stage="校验权限标签与过滤结果…"
      empty-title="没有可展示的结果（或全部被过滤）"
      empty-desc="当前范围没有有权限的结果；越权内容不会以「部分可见」形式返回。"
      empty-action="降低过滤条件重试"
      example-task="用越权探测验证不可检索到无权文档"
      what="权限校验失败"
      why="策略服务不可达（KnowledgePolicySPI 超时），无法保证前置过滤正确性。"
      how="出于安全考虑已停止返回结果（宁可不答，不越权返回）；请稍后重试。"
      trace-id="trace-kperm-7d3c58"
      missing-permission="kb.search"
      risk-level="R2"
      apply-path="在「权限与审批 → 申请授权」申请知识检索权限（按项目粒度）"
      @retry="state = 'NORMAL'"
      @empty-action="MessagePlugin.info('已放宽过滤条件：仅调整排序权重，不放开权限约束')"
    >
      <div v-if="probeResult" class="oc-card" style="border-color: var(--oc-sev-warn)">
        <h3 class="oc-card__title">
          越权探测结果
          <Tag size="small" theme="warning">已过滤 N 条</Tag>
        </h3>
        <p style="margin: 0 0 6px; font-size: 13px">{{ probeResult }}</p>
        <div class="oc-muted" style="font-size: 12px">
          演示说明：本页面刻意不提供「查看被过滤内容」入口——存在性信息本身也是泄露。
        </div>
      </div>

      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            前置过滤校验
            <span class="oc-muted" style="font-size: 12px">5 项全部通过才允许返回结果</span>
          </h3>
          <div class="oc-stack">
            <div v-for="c in CHECKS" :key="c.name" class="oc-flex" style="gap: 8px; align-items: flex-start">
              <OcIcon :name="c.ok ? 'check' : 'error'" size="14px" :color="c.ok ? 'var(--oc-sev-ok)' : 'var(--oc-sev-error)'" />
              <div>
                <div style="font-size: 13px">{{ c.name }}</div>
                <div class="oc-muted" style="font-size: 12px">{{ c.note }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            共享知识域
            <span class="oc-muted" style="font-size: 12px">企业可选：跨租户共享需显式授权与审计</span>
          </h3>
          <div class="oc-flex" style="gap: 10px; margin-bottom: 10px">
            <Switch v-model="sharedDomain" />
            <span style="font-size: 13px">{{ sharedDomain ? '已开启（仅组织级公开知识，仍受 ACL 约束）' : '已关闭（默认零共享）' }}</span>
            <Popconfirm
              theme="warning"
              content="开启共享知识域会扩大可见范围；确认已获数据负责人授权并接受跨租户审计。"
              @confirm="MessagePlugin.success('已记录授权：共享知识域生效，审计已开启')"
            >
              <Button size="small" variant="outline">授权确认</Button>
            </Popconfirm>
          </div>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'scope', label: '共享范围', value: sharedDomain ? '组织级公开知识页 + 术语表（不含项目内部文档）' : '无共享（每租户独立可见）' },
              { key: 'audit', label: '审计要求', value: '开启后每次跨租户检索记录调用方、目标租户与返回来源' },
              { key: 'revoke', label: '撤销', value: '关闭开关立即生效；历史审计记录保留' },
            ]"
          />
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          结果权限标签
          <span class="oc-muted" style="font-size: 12px">租户 / 项目 / 可见范围 / ACL 摘要（索引时写入）</span>
        </h3>
        <Table
          :data="rows"
          :columns="[
            { colKey: 'title', title: '结果', cell: 'cell' },
            { colKey: 'tenant', title: '租户', width: 120, cell: 'cell' },
            { colKey: 'project', title: '项目', width: 150, cell: 'cell' },
            { colKey: 'visibility', title: '可见范围', width: 110, cell: 'cell' },
            { colKey: 'acl', title: 'ACL', width: 140, cell: 'cell' },
          ]"
          row-key="resultId"
          size="small"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'title'">
              <span class="oc-truncate" style="display: block; max-width: 340px">{{ row.title }}</span>
              <span class="oc-mono oc-muted" style="font-size: 11px">{{ row.citationKind }}:// 引用</span>
            </template>
            <template v-else-if="col.colKey === 'tenant'">{{ row.permissionTags.tenant }}</template>
            <template v-else-if="col.colKey === 'project'"><span class="oc-mono">{{ row.permissionTags.project }}</span></template>
            <template v-else-if="col.colKey === 'visibility'">
              <Tag size="small" :theme="row.permissionTags.visibility === '公开' ? 'success' : row.permissionTags.visibility === '受限' ? 'danger' : 'warning'" variant="light-outline">
                {{ row.permissionTags.visibility }}
              </Tag>
            </template>
            <template v-else-if="col.colKey === 'acl'"><span class="oc-mono" style="font-size: 12px">{{ row.permissionTags.acl }}</span></template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
      </div>
    </StateShell>
  </div>
</template>
