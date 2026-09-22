<script setup lang="ts">
/**
 * UI 扩展宿主（L-08）：面板 / 命令 / 设置页 / 状态栏项 / 内联卡片 / 通知模板 + 沙箱化渲染说明。
 * 溯源：卷 18 D-PLG-12（声明式描述 + 沙箱化渲染，不直接访问 DOM 全权）。
 */
import { computed, ref } from 'vue';
import StateShell from '@/components/common/StateShell.vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Dialog, Input, MessagePlugin, Select, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData, type PluginUiSurface } from '@/mock/data/extension';
import { PLUGIN_SURFACE_LABEL, useExtList } from '@/components/extension/useExtList';
import { downloadJson } from '@/utils/download';

const router = useRouter();

/** 展平：UI 扩展 × 插件 */
const rows = computed(() =>
  extensionData.plugins.flatMap((p) =>
    p.uiExtensions.map((u) => ({ ...u, pluginId: p.id, pluginName: p.name, health: p.health, hostMode: p.kernel.hostMode })),
  ),
);

const { keyword, filter, visible, matched, state, edgeSummary, reload, loadMore } = useExtList(rows.value, {
  persistKey: 'plugin-ui-host',
  pageSize: 12,
  match: (u, kw, f) => (f === 'all' || u.surface === f) && (!kw || `${u.name}${u.desc}${u.pluginName}`.toLowerCase().includes(kw)),
});

const surfaceOptions = [
  { label: '全部扩展面', value: 'all' },
  ...Object.entries(PLUGIN_SURFACE_LABEL).map(([value, label]) => ({ label, value })),
];

const surfaceCounts = computed(() => {
  const map: Record<string, number> = {};
  rows.value.forEach((r) => {
    map[r.surface] = (map[r.surface] ?? 0) + 1;
  });
  return map;
});

const previewOpen = ref(false);
const preview = ref<(typeof rows.value)[number] | null>(null);
const enabled = ref<string[]>(rows.value.map((r) => `${r.pluginId}/${r.name}`));

function toggle(key: string, name: string, v: boolean) {
  if (v && !enabled.value.includes(key)) enabled.value.push(key);
  if (!v) enabled.value = enabled.value.filter((k) => k !== key);
  MessagePlugin.info(`${name} 已${v ? '启用' : '停用'}（扩展点级停用，不影响插件其它能力）`);
}

function openPreview(row: (typeof rows.value)[number]) {
  preview.value = row;
  previewOpen.value = true;
}

/** 导出 UI 扩展清单：扩展条目（rows）与启停状态（enabled）取自本页，含扩展面与宿主契约口径 */
function exportList() {
  const filename = `oc-plugin-ui-extensions-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson(
    {
      surfaces: PLUGIN_SURFACE_LABEL,
      extensions: rows.value.map((r) => ({
        ...r,
        enabled: enabled.value.includes(`${r.pluginId}/${r.name}`),
      })),
    },
    filename,
  );
  MessagePlugin.success(`已导出 UI 扩展清单（${filename}，${rows.value.length} 条）`);
}

const columns = [
  { colKey: 'name', title: 'UI 扩展', width: 260 },
  { colKey: 'surface', title: '扩展面', width: 130 },
  { colKey: 'plugin', title: '提供方插件', width: 250 },
  { colKey: 'desc', title: '说明' },
  { colKey: 'enabled', title: '启用', width: 90 },
  { colKey: 'ops', title: '预览', width: 100 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="UI 扩展宿主"
      desc="插件以声明式描述扩展界面：面板 / 命令 / 设置页 / 状态栏项 / 内联卡片 / 通知模板；渲染沙箱化（不直接访问 DOM 全权）。"
      volume="卷 18" manifest="L-08" cli="oc plugin ui list --sandbox-info"
      :status="[{ label: '沙箱化渲染', theme: 'primary' }, { label: `已启用 ${enabled.length}/${rows.length}`, theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/plugins')">返回市场</Button>
        <Button size="small" variant="text" @click="exportList">导出清单</Button>
      </template>
    </PageHeader>

    <Alert
      theme="info"
      message="渲染沙箱化（硬约束）"
      description="UI 扩展在受控容器中渲染：仅可访问宿主暴露的只读数据接口，不可直连存储、不可跨租户；越权访问被拒绝并审计。"
    />

    <div class="oc-grid oc-grid--3">
      <div v-for="(label, key) in PLUGIN_SURFACE_LABEL" :key="key" class="oc-card">
        <div class="oc-flex--between">
          <b style="font-size: 13px">{{ label }}</b>
          <Tag size="small" variant="outline">{{ surfaceCounts[key] ?? 0 }} 个</Tag>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 4px">
          {{ key === 'panel' ? '新视图：占据主区，可组合宿主提供的只读数据块'
            : key === 'command' ? '命令面板项：可绑定动作与快捷键，等价 CLI 需一并提供'
            : key === 'settings_page' ? '设置页：配置项由 Schema 生成，密钥走引用'
            : key === 'status_bar_item' ? '状态栏项：仅文本/图标与点击动作，不占用主区'
            : key === 'inline_card' ? '会话内联卡片：声明式结构，不注入脚本'
            : '通知模板：六类模板 + P0 穿透遵循全局静默设置' }}
        </div>
      </div>
    </div>

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Input v-model="keyword" size="small" placeholder="搜索扩展名 / 提供方插件" clearable style="width: 280px">
          <template #prefix-icon><OcIcon name="search" size="14px" /></template>
        </Input>
        <Select v-model="filter" size="small" :options="surfaceOptions" style="width: 180px" />
        <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 过滤记忆已开启</span>
      </div>
    </div>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="12"
      empty-title="没有 UI 扩展"
      empty-desc="已安装插件均未声明 UI 扩展（纯后端能力插件）；安装带 ui.panel / ui.command 扩展点的插件后可见。"
      empty-action="打开插件市场"
      example-task="安装「会话时间线面板」插件以获得时间线视图与状态栏项"
      what="UI 扩展清单加载失败"
      why="宿主契约版本不匹配（插件声明 renderer v2，宿主提供 v1）。"
      how="可重试；或升级宿主后重新枚举（不兼容扩展点会被显式关闭并留痕）。"
      trace-id="trace-plugin-ui-6be3"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="router.push('/extension/plugins')"
    >
      <Table row-key="name" size="small" :data="visible" :columns="columns" table-layout="fixed">
        <template #name="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span style="font-size: 13px">{{ row.name }}</span>
            <span class="oc-muted" style="font-size: 11px">渲染契约：声明式结构 + 宿主只读接口</span>
          </div>
        </template>
        <template #surface="{ row }"><Tag size="small" theme="primary" variant="light-outline">{{ PLUGIN_SURFACE_LABEL[row.surface as PluginUiSurface] }}</Tag></template>
        <template #plugin="{ row }">
          <div class="oc-stack" style="gap: 2px">
            <span class="oc-mono" style="font-size: 12px">{{ row.pluginId }}</span>
            <div class="oc-flex" style="gap: 4px">
              <Tag size="small" :theme="row.health === '就绪' ? 'success' : 'danger'" variant="light-outline">{{ row.health }}</Tag>
              <Tag size="small" variant="outline">{{ row.hostMode }}</Tag>
            </div>
          </div>
        </template>
        <template #enabled="{ row }">
          <Tooltip content="扩展点级停用：仅关闭该 UI 面，插件后端能力不受影响">
            <Switch
              size="small"
              :value="enabled.includes(`${row.pluginId}/${row.name}`)"
              @change="(v) => toggle(`${row.pluginId}/${row.name}`, row.name, Boolean(v))"
            />
          </Tooltip>
        </template>
        <template #ops="{ row }">
          <Button size="small" variant="text" @click="openPreview(row)">预览</Button>
        </template>
      </Table>
    </StateShell>

    <Dialog v-model:visible="previewOpen" header="UI 扩展预览（沙箱容器内渲染）" width="620px" :footer="false">
      <template v-if="preview">
        <InfoGrid
          :columns="1"
          :items="[
            { key: 'name', label: '扩展名', value: preview.name },
            { key: 'surface', label: '扩展面', value: PLUGIN_SURFACE_LABEL[preview.surface as PluginUiSurface] },
            { key: 'plugin', label: '提供方', value: `${preview.pluginName}（${preview.pluginId}）` },
            { key: 'desc', label: '说明', value: preview.desc },
          ]"
        />
        <div class="oc-card" style="margin-top: 10px; background: var(--td-bg-color-secondarycontainer)">
          <div class="oc-flex" style="gap: 8px">
            <OcIcon name="layers" size="14px" />
            <span style="font-size: 13px">
              {{ preview.surface === 'panel' ? '【面板预览】时间线 · Turn #7 / 6 步 / 成本 $0.184'
                : preview.surface === 'command' ? '【命令预览】oc k8s巡检 → 等价 CLI 已提供'
                : preview.surface === 'status_bar_item' ? '【状态栏预览】集群 prod-cn-north · 连接正常'
                : preview.surface === 'settings_page' ? '【设置页预览】规则包版本 v2.4 · 阻断策略开启'
                : preview.surface === 'inline_card' ? '【内联卡片预览】外部工单 PAY-2231 已同步（双向）'
                : '【通知模板预览】任务完成 · 证据 3 项 · 成本 $0.21' }}
            </span>
          </div>
        </div>
        <Alert
          style="margin-top: 10px"
          theme="warning"
          message="沙箱化渲染边界"
          description="扩展不可注入脚本、不可直接访问 DOM 全权、不可读取未授权数据；预览与实际渲染一致（同一沙箱容器）。"
        />
      </template>
    </Dialog>
  </div>
</template>
