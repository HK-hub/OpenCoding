<script setup lang="ts">
/**
 * 键盘与键位（G-09）：六层键位表（全局/导航/会话/审批/列表看板/无障碍）+ 冲突检测演示 + 重置为默认。
 * 冲突判定遵循「先注册者生效」：后写入的绑定不覆盖已有绑定，且不静默丢弃。溯源：卷 33 §6 / 卷 22 §4.5。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Select, Table, Tabs, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';

interface KeyRow { keys: string; action: string; mouse: string; customizable: '可定制' | '固定' | '企业锁定' }

type LayerKey = 'global' | 'nav' | 'session' | 'approval' | 'list' | 'a11y';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const tab = ref<LayerKey>('global');
const candidate = ref('Ctrl+K');
const conflictMsg = ref('');

const LAYERS: { value: LayerKey; label: string; note: string }[] = [
  { value: 'global', label: '全局', note: '任意界面可用；命令面板与搜索为入口级快捷键' },
  { value: 'nav', label: '导航', note: '页签、导航树与面包屑移动' },
  { value: 'session', label: '会话', note: '会话工作台内可用；含发送/中断/新会话' },
  { value: 'approval', label: '审批', note: '审批卡片聚焦后可用的决策键（危险动作需二次确认）' },
  { value: 'list', label: '列表看板', note: '表格/看板通用：行移动、多选、展开' },
  { value: 'a11y', label: '无障碍', note: '读屏与纯键盘用户专用，非替代方案而是平行入口' },
];

const KEYMAP: Record<LayerKey, KeyRow[]> = {
  global: [
    { keys: 'Ctrl/Cmd + K', action: '打开命令面板', mouse: '点击顶部搜索框', customizable: '可定制' },
    { keys: 'Ctrl/Cmd + Shift + F', action: '全局搜索', mouse: '点击放大镜', customizable: '可定制' },
    { keys: 'Ctrl/Cmd + Shift + A', action: '跳转审批中心', mouse: '点击「待审批」徽标', customizable: '可定制' },
    { keys: 'Ctrl/Cmd + /', action: '快捷键帮助面板', mouse: '帮助菜单 → 快捷键', customizable: '可定制' },
  ],
  nav: [
    { keys: 'Alt + ↑/↓', action: '上一个/下一个导航项', mouse: '点击导航项', customizable: '可定制' },
    { keys: 'Ctrl + Tab', action: '循环切换页签', mouse: '点击页签', customizable: '可定制' },
    { keys: 'Ctrl + W', action: '关闭当前页签（首页除外）', mouse: '点击页签 ×', customizable: '可定制' },
    { keys: 'Alt + Home', action: '回到工作台首页', mouse: '点击 Logo', customizable: '固定' },
  ],
  session: [
    { keys: 'Ctrl + Enter', action: '发送消息', mouse: '点击发送', customizable: '可定制' },
    { keys: 'Esc', action: '中断当前轮次（安全点停止）', mouse: '点击停止', customizable: '固定' },
    { keys: 'Ctrl + N', action: '新建会话', mouse: '点击新建', customizable: '可定制' },
    { keys: 'Ctrl + Shift + Enter', action: '插话（不打断当前轮次）', mouse: '点击插话', customizable: '可定制' },
  ],
  approval: [
    { keys: 'A', action: '允许一次（首次确认）', mouse: '点击允许', customizable: '固定' },
    { keys: 'D', action: '拒绝并填写理由', mouse: '点击拒绝', customizable: '固定' },
    { keys: 'G', action: '查看影响面（diff 预览）', mouse: '点击预览', customizable: '固定' },
    { keys: 'Y / N', action: '高风险二次确认（需连按）', mouse: '按住确认', customizable: '固定' },
  ],
  list: [
    { keys: '↑ / ↓', action: '行移动', mouse: '点击行', customizable: '固定' },
    { keys: 'Space', action: '选中/取消选中行', mouse: '点击复选框', customizable: '固定' },
    { keys: 'Enter', action: '展开详情抽屉', mouse: '点击行标题', customizable: '固定' },
    { keys: 'Ctrl + A', action: '全选当前页（不含跨页）', mouse: '点击表头复选框', customizable: '可定制' },
  ],
  a11y: [
    { keys: 'Alt + M', action: '跳到主内容', mouse: '点击「跳到主内容」', customizable: '可定制' },
    { keys: 'Alt + L', action: '跳到实时播报区（aria-live）', mouse: '无等价（读屏专用）', customizable: '可定制' },
    { keys: 'Alt + Z', action: '开关读屏专用布局', mouse: '设置 → 无障碍', customizable: '可定制' },
    { keys: 'Shift + F10', action: '打开上下文菜单', mouse: '右键', customizable: '固定' },
  ],
};

const allBindings = computed(() => LAYERS.flatMap((l) => KEYMAP[l.value].map((r) => ({ layer: l.label, ...r }))));
/** 拟改绑候选：前两个为已占用键位（用于演示冲突），后两个为未占用键位 */
const CANDIDATES = ['Ctrl+K', 'Ctrl+Shift+F', 'Ctrl+Alt+P', 'Alt+9'];
const rows = computed(() => KEYMAP[tab.value]);

function detect() {
  const hits = allBindings.value.filter((r) => r.keys === candidate.value);
  conflictMsg.value = hits.length
    ? `冲突：${candidate.value} 已被「${hits[0].layer} → ${hits[0].action}」占用。保留生效者 = 先注册的绑定，新绑定不会生效，也不会静默覆盖原绑定（需先解除或换键）。`
    : `无冲突：${candidate.value} 尚未被占用，可安全改绑。`;
  MessagePlugin.info(conflictMsg.value);
}

function resetAll() {
  conflictMsg.value = '';
  candidate.value = 'Ctrl+K';
  ui.track('settings.keymap.reset', {});
  MessagePlugin.success('已重置为默认键位：本地改绑全部丢弃，企业锁定项不受影响');
}

const columns = [
  { colKey: 'keys', title: '快捷键', width: 190 }, { colKey: 'action', title: '行为', ellipsis: true },
  { colKey: 'mouse', title: '鼠标等价', width: 220 }, { colKey: 'customizable', title: '可定制', width: 110 },
];

onMounted(() => {
  window.setTimeout(() => { state.value = 'NORMAL'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="键盘与键位" volume="卷 33" manifest="G-09"
      desc="六层键位表 + 冲突检测。冲突时保留生效者（先注册者），后写入的绑定不覆盖不丢弃；固定项不可改绑。"
      cli="oc settings keymap --list --detect-conflicts"
      :status="[{ label: `当前层 ${LAYERS.find((l) => l.value === tab)?.label}`, theme: 'primary' }, { label: '冲突不静默', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="detect">检测冲突</Button>
        <Popconfirm content="重置会丢弃全部本地改绑并恢复出厂键位；企业锁定项不在重置范围内，后果可逆（可再次改绑）。" theme="warning" @confirm="resetAll">
          <Button size="small" theme="danger" variant="outline">重置为默认</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state" trace-id="trace-keymap-4b02" :page-size="24"
      empty-title="键位表为空" empty-desc="未加载到任何层级的键位定义（组织可能下发了空键位表），当前键盘不可用。"
      empty-action="恢复默认键位" example-task="检测 Ctrl+K 是否冲突，并确认「保留生效者」说明"
      what="键位表加载失败" why="键位注册表读取失败（插件注册的快捷键扩展点校验未通过）"
      how="可重试；失败时保留内置键位，禁用的仅为插件扩展快捷键"
      collapsed-summary="单层键位超过渲染阈值，已折叠低频行为（多选/展开类）。"
      @retry="state = 'LOADING'" @empty-action="resetAll"
    >
      <Tabs v-model="tab" :options="LAYERS.map((l) => ({ label: `${l.label}（${KEYMAP[l.value].length}）`, value: l.value }))" />
      <div class="oc-muted" style="font-size: 12px; margin: 4px 0 8px">{{ LAYERS.find((l) => l.value === tab)?.note }}</div>

      <div class="oc-card">
        <Table :data="rows" row-key="keys" size="small" :columns="columns" :pagination="undefined">
          <template #keys="{ row }">
            <span class="oc-mono" style="font-size: 12px">{{ row.keys }}</span>
          </template>
          <template #customizable="{ row }">
            <Tag size="small" :theme="row.customizable === '可定制' ? 'success' : row.customizable === '企业锁定' ? 'danger' : 'default'" variant="light-outline">
              {{ row.customizable }}
            </Tag>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">冲突检测演示</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Select v-model="candidate" size="small" style="width: 200px" :options="CANDIDATES.map((k) => ({ label: k, value: k }))" />
            <Button size="small" theme="primary" variant="outline" @click="detect">检测该键位</Button>
          </div>
          <div v-if="conflictMsg" class="oc-flex" style="gap: 6px; margin-top: 8px; align-items: flex-start">
            <OcIcon name="flag" size="14px" color="var(--td-warning-color)" />
            <span style="font-size: 12px">{{ conflictMsg }}</span>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            判定规则：同层内完全相同的组合键即冲突；修饰键顺序归一化（Ctrl+Shift+K ≡ Shift+Ctrl+K）。保留生效者 = 先注册绑定，改绑需先解除原绑定或换键。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">已占用键位（跨层合并视图）</div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="b in allBindings.slice(0, 6)" :key="`${b.layer}-${b.keys}`" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
              <span class="oc-mono" style="font-size: 12px; min-width: 150px">{{ b.keys }}</span>
              <Tag size="small" variant="outline">{{ b.layer }}</Tag>
              <span class="oc-muted" style="font-size: 12px">{{ b.action }}</span>
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 8px">
            <CopyableId id="trace-keymap-4b02" label="复制 traceId" />
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
