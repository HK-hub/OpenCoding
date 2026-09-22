<script setup lang="ts">
/**
 * 审计与授权快照（N2-13）：五项审计 × 三级（强制 / 条件 / 可关闭）+ 实例授权快照明细。
 * 溯源：卷 34 §7 审计记录；BUILD-MANIFEST N2-13。
 * 铁律：授权快照、模板来源与签名、运行动作三项为「强制」不可关闭。
 */
import { computed, onMounted, ref } from 'vue';
import { Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import { automationData } from '@/mock/data/automation';
import type { AuditItem } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const snapshots = automationData.auditSnapshot;
const selectedIdx = ref(0);
const selected = computed(() => snapshots[selectedIdx.value]);
const selectedInstance = computed(() => automationData.instances[selectedIdx.value]);
const auditItems: AuditItem[] = snapshots[0].items;

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}
function onSnapshot(v: unknown) {
  selectedIdx.value = Number(v);
}

const columns = [
  { colKey: 'label', title: '审计项', width: 170 },
  { colKey: 'content', title: '内容', ellipsis: true },
  { colKey: 'level', title: '级别', width: 130, cell: 'level' },
  { colKey: 'note', title: '说明', ellipsis: true },
];
const LEVEL_THEME: Record<AuditItem['level'], 'danger' | 'warning' | 'default'> = { 强制: 'danger', 条件: 'warning', 可关闭: 'default' };

onMounted(() => {
  window.setTimeout(() => (demo.value = 'NORMAL'), 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="审计与授权快照"
      desc="五项审计 × 三级：授权快照 / 模板来源与签名 / 运行动作（强制），内容外发（条件），度量上报（可关闭）。"
      volume="卷 34" manifest="N2-13" cli="oc automation audit snapshot --instance inst-01 --with-baseline"
      :status="[{ label: '三级审计（保留期对齐卷 24）', theme: 'default' }, { label: '强制项不可关闭', theme: 'danger' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Select :value="String(selectedIdx)" size="small" style="width: 240px" aria-label="选择实例快照" :options="automationData.instances.map((i, idx) => ({ value: String(idx), label: `${i.id} · ${i.templateName}` }))" @change="onSnapshot" />
      </template>
    </PageHeader>

    <StateShell
      :state="demo" stage="正在读取审计项与授权快照…"
      empty-title="暂无授权快照" empty-desc="授权快照在实例启用时生成；未启用实例不产生快照（也不会运行）。"
      empty-action="去安装模板" example-task="核对 inst-01 的授权动作清单与企业基线版本"
      what="审计快照加载失败" why="审计存储查询被 DLP 策略拦截（需数据治理权限）"
      how="联系管理员开通审计读取权限；审计链本身不受影响" trace-id="trace-77d1e09a"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <div class="oc-card">
        <div class="oc-card__title">五项审计 × 三级</div>
        <Table :data="auditItems" :columns="columns" row-key="key" size="small" :pagination="undefined">
          <template #level="{ row }"><Tag size="small" :theme="LEVEL_THEME[row.level as AuditItem['level']]" variant="light-outline">{{ row.level }}</Tag></template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
          「可关闭」项在关闭后仍本地保留缺口标记；强制项任何配置都无法关闭（无 bypass 路径）。
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">实例授权快照（授予人 / 动作清单 / 上限 / 基线版本）<CliHint :command="`oc automation audit snapshot ${selectedInstance.id}`" /></div>
          <InfoGrid :columns="1" :items="[
            { key: 'inst', label: '实例', value: `${selectedInstance.id} · ${selectedInstance.templateName} v${selectedInstance.definitionVersion}` },
            { key: 'by', label: '授予人', value: selectedInstance.authorizationSnapshot.grantedBy },
            { key: 'at', label: '授予时间', value: new Date(selectedInstance.authorizationSnapshot.at).toLocaleString('zh-CN') },
            { key: 'ceil', label: '上限', value: selectedInstance.authorizationSnapshot.ceiling, tag: { text: '不可提升', theme: 'warning' } },
            { key: 'base', label: '企业基线版本', value: selectedInstance.authorizationSnapshot.baselineVersion },
            { key: 'acts', label: '动作清单', value: selectedInstance.authorizationSnapshot.actions.join('、'), block: true },
          ]" />
          <div class="oc-flex" style="gap: 8px; margin-top: 6px">
            <CopyableId :id="selected.snapshotRef" label="复制快照引用" />
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">快照变更与运行留痕</div>
          <div class="oc-stack" style="gap: 6px; font-size: 13px">
            <div class="oc-flex" style="gap: 6px"><Tag size="small" variant="outline">变更 1</Tag><span>实例升级 v{{ selectedInstance.definitionVersion }} → 兼容检查通过后刷新快照（旧快照留档，不覆盖）</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" variant="outline">变更 2</Tag><span>授予动作变更需重新走审批；模板自身无法修改权限（selfmodify.denied 事件）</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" variant="outline">运行留痕</Tag><span>每次运行产生完整事件链：触发源 → 步骤 → 决策（含 DENY）→ 产物 → 成本，可回放</span></div>
            <div class="oc-flex" style="gap: 6px"><Tag size="small" theme="warning" variant="light-outline">审计</Tag><span>「谁在何时授予了什么权限快照、运行对哪些目标做了哪些动作」</span></div>
          </div>
          <div class="oc-divider" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px">
            <Tag size="small" variant="outline">来源与签名：{{ automationData.templates[0].signature.slice(0, 18) }}…</Tag>
            <Tag size="small" variant="outline">安装人记录</Tag>
            <Tag size="small" variant="outline">哈希校验</Tag>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
