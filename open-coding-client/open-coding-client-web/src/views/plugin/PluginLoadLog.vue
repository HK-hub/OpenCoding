<script setup lang="ts">
/**
 * 插件装载日志（L-03）：扫描 → 清单校验 → 签名 → 兼容性 → 依赖解析 → 装配 → 初始化。
 * 溯源：卷 18 §4.3 装载流水线；失败步骤显式呈现原因与可操作建议，不静默跳过。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { PLUGIN_HEALTH_THEME, PLUGIN_SOURCE_LABEL, fmtMs, type TagTheme } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const plugins = extensionData.plugins;
const picked = ref(String(route.query.id ?? 'com.community.fast-edit'));
const plugin = computed(() => plugins.find((p) => p.id === picked.value) ?? plugins[0]);
const options = plugins.map((p) => ({ label: `${p.name}（${p.health}）`, value: p.id }));
const rerunning = ref(false);

const failedStep = computed(() => plugin.value.loadLog.find((s) => !s.ok));

/** 失败建议：按失败步骤给出可操作动作（禁用/升级/降级/换来源） */
const advice = computed(() => {
  const f = failedStep.value;
  if (!f) return null;
  if (f.stage === '校验签名') {
    return '改用组织私仓的已签名版本；或联系发布者重新签发（提交公钥指纹）；或以本地来源在开发模式下加载（企业策略允许时，且不进入私仓）。';
  }
  if (f.stage === '兼容性检查') {
    return '升级插件到支持当前内核的版本；或临时降级内核（不推荐）；或改用兼容的替代插件。';
  }
  if (f.stage === '依赖解析') {
    return '按建议禁用冲突插件 / 升级或降级到满足约束的版本 / 更换来源；冲突未解决前拒绝装载。';
  }
  if (f.stage === '初始化') {
    return '调大初始化超时与心跳；插件将降级运行（扩展点回退内置实现）；持续失败则隔离并告警。';
  }
  return '查看该步骤明细并按提示修复（不静默放行）。';
});

function rerun() {
  rerunning.value = true;
  window.setTimeout(() => {
    rerunning.value = false;
    MessagePlugin.info(`已重跑装载流水线：${plugin.value.name} 仍停留于「${failedStep.value?.stage ?? '完成'}」`);
  }, 800);
}

const columns = [
  { colKey: 'stage', title: '阶段', width: 170 },
  { colKey: 'result', title: '结果', width: 110 },
  { colKey: 'detail', title: '明细' },
  { colKey: 'ms', title: '耗时', width: 110 },
];

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/plugins/load-log', () => !route.query.id || plugins.some((p) => p.id === route.query.id));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="插件装载日志"
      desc="逐步呈现扫描 → 清单 → 签名 → 兼容性 → 依赖 → 装配 → 初始化；任一步失败即中止并给出可操作建议。"
      volume="卷 18" manifest="L-03" :cli="`oc plugin load-log ${plugin.id} --verbose`"
      :status="[
        { label: plugin.health, theme: (PLUGIN_HEALTH_THEME as Record<string, TagTheme>)[plugin.health] ?? 'default' },
        { label: PLUGIN_SOURCE_LABEL[plugin.source], theme: 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/plugins')">返回市场</Button>
        <Button size="small" variant="outline" @click="router.push({ path: '/extension/plugins/detail', query: { id: plugin.id } })">插件详情</Button>
        <Button size="small" theme="primary" :loading="rerunning" @click="rerun">
          <OcIcon name="refresh" size="12px" /> 重跑装载
        </Button>
      </template>
    </PageHeader>

    <StateShell
      :state="pageState"
      :trace-id="pageTraceId"
      empty-title="对象不存在或已被清理"
      empty-desc="按链接标识未命中：可能已被卸载、清理或标识有误；请从列表重新进入。"
      what="页面数据加载失败"
      why="该页依赖的索引 / 配置读取失败（不影响其它模块与已加载数据）。"
      how="可重试；持续失败请导出诊断包并附 traceId 便于定位。"
      @retry="reloadPage"
    >


    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Select v-model="picked" size="small" :options="options" style="width: 320px" filterable />
        <Tag size="small" variant="outline" class="oc-mono">{{ plugin.version }}</Tag>
        <Tag v-if="plugin.reloadable" size="small" theme="primary" variant="light-outline">可热重载</Tag>
        <span class="oc-grow" />
        <CopyableId :id="`evt-plugin-loaded-${plugin.id.slice(-6)}`" label="plugin.loaded / failed" :short="24" />
      </div>
    </div>

    <Alert
      v-if="failedStep"
      theme="error"
      :message="`装载中止于「${failedStep.stage}」：${failedStep.detail}`"
      :description="`${advice} 该插件未注册任何扩展点，内核不受影响（功能回退内置实现并显式标注）。`"
    />
    <Alert
      v-else
      theme="success"
      :message="`装载完成：${plugin.health}`"
      :description="plugin.healthReason"
    />

    <div class="oc-card">
      <h3 class="oc-card__title">
        七步装载流水线
        <span class="oc-muted" style="font-size: 12px">总耗时 {{ fmtMs(plugin.loadLog.reduce((a, s) => a + s.ms, 0)) }}</span>
      </h3>
      <Table row-key="stage" size="small" :data="plugin.loadLog" :columns="columns">
        <template #stage="{ row }">
          <div class="oc-flex" style="gap: 6px">
            <Tag size="small" :theme="row.ok ? 'success' : 'danger'" variant="light-outline">{{ row.ok ? '通过' : '失败' }}</Tag>
            <span style="font-size: 13px">{{ row.stage }}</span>
          </div>
        </template>
        <template #detail="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.detail }}</span></template>
        <template #ms="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtMs(row.ms) }}</span></template>
      </Table>
      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
        <CliHint command="oc plugin verify --contract --kernel 1.3" />
        <span class="oc-muted" style="font-size: 12px">契约测试校验插件与目标内核版本的兼容性（发布前必跑）</span>
      </div>
    </div>

    <div class="oc-card">
      <h3 class="oc-card__title">失败步骤的可操作建议</h3>
      <div class="oc-kv">
        <span class="oc-kv__k">校验签名失败</span><span>换私仓已签名版本 / 发布者重新签发 / 本地开发模式（企业策略允许时）</span>
        <span class="oc-kv__k">兼容性失败</span><span>升级插件 / 降级内核（不推荐）/ 改用兼容替代插件</span>
        <span class="oc-kv__k">依赖冲突</span><span>禁用冲突项 / 升级降级到满足约束的版本 / 换来源</span>
        <span class="oc-kv__k">初始化失败</span><span>隔离该插件并降级（扩展点回退内置实现），修好后重新启用</span>
      </div>
    </div>
    </StateShell>
  </div>
</template>
