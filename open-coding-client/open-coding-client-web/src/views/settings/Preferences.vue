<script setup lang="ts">
/**
 * 偏好设置（G-10）：外观 / 密度 / 语言 / 默认模式 / 默认模型 / 默认工作区 / 撤销窗口。
 * 每项附「影响说明」；保存失败回滚到上一次生效值（不做静默写入）。溯源：卷 22 §4.3 / 卷 33。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { Button, MessagePlugin, RadioButton, RadioGroup, Select, Slider, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { useUiStore } from '@/stores/ui';
import { modelData } from '@/mock/data/model';
import { platformData } from '@/mock/data/platform';
import { request } from '@/mock/runtime';

type ModeKey = 'readonly' | 'plan' | 'default' | 'acceptEdits' | 'autonomous' | 'yolo';
type ThemeKey = 'light' | 'dark';
type DensityKey = 'loose' | 'normal' | 'compact';
type LocaleKey = 'zh-CN' | 'en-US';
type PrefDraft = { theme: ThemeKey; density: DensityKey; locale: LocaleKey; mode: ModeKey; model: string; workspace: string; undoWindow: number };

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const saving = ref(false);
const lastError = ref('');

/** 六档默认模式：新会话的起点（策略仍可收窄，不可放宽） */
const MODES: { value: ModeKey; label: string; effect: string }[] = [
  { value: 'readonly', label: 'readonly 只读', effect: '新会话仅允许 R0 读类工具' },
  { value: 'plan', label: 'plan 计划', effect: '只产出计划、禁止副作用' },
  { value: 'default', label: 'default 默认', effect: '写与执行按风险 ASK' },
  { value: 'acceptEdits', label: 'acceptEdits 自动接受编辑', effect: '文件编辑 R1 自动放行，执行仍确认' },
  { value: 'autonomous', label: 'autonomous 自治', effect: '预授权边界内自动执行，越界转 ASK' },
  { value: 'yolo', label: 'yolo 全部放行', effect: '仅限一次性沙箱；企业租户禁用' },
];
const DENSITIES: { key: DensityKey; hint: string }[] = [
  { key: 'loose', hint: '宽松：行高 44px，适合触屏与低视力' }, { key: 'normal', hint: '标准：行高 36px（默认）' }, { key: 'compact', hint: '紧凑：行高 28px，密度最高' },
];

const draft = ref<PrefDraft>({
  theme: (localStorage.getItem('oc.theme') as ThemeKey) ?? 'light',
  density: (localStorage.getItem('oc.density') as DensityKey) ?? 'normal',
  locale: (localStorage.getItem('oc.locale') as LocaleKey) ?? 'zh-CN',
  mode: ui.currentMode,
  model: ui.currentModel,
  workspace: platformData.workspaces[0]?.workspaceId ?? 'ws-0001',
  undoWindow: ui.undoWindowSeconds,
});
/** 上一次生效值：任何失败都回滚到该快照（失败保留旧值） */
const saved = ref<PrefDraft>({ ...draft.value });

const modelOptions = computed(() => modelData.models.slice(0, 8).map((m) => ({ label: `${m.displayName}（${m.modelId}）`, value: m.modelId })));
const workspaceOptions = computed(() => platformData.workspaces.map((w) => ({ label: `${w.name} · ${w.type} · ${w.status}`, value: w.workspaceId })));
const modeEffect = computed(() => MODES.find((m) => m.value === draft.value.mode)?.effect ?? '');
const densityHint = computed(() => DENSITIES.find((d) => d.key === draft.value.density)?.hint ?? '');

/** 主题即时生效：localStorage + theme-mode 属性（深浅切换不阻塞保存） */
function applyTheme(t: ThemeKey) {
  localStorage.setItem('oc.theme', t);
  if (t === 'dark') document.documentElement.setAttribute('theme-mode', 'dark');
  else document.documentElement.removeAttribute('theme-mode');
  ui.announce(`已切换到${t === 'dark' ? '深色' : '浅色'}主题`);
}
watch(() => draft.value.theme, applyTheme);

function resetDraft() {
  draft.value = { ...saved.value };
  applyTheme(saved.value.theme);
  MessagePlugin.info('已放弃未保存的修改，回到上一次生效值');
}

/** 保存：先写内核（可被故障注入阻断），成功后落盘并记录快照 */
async function save() {
  saving.value = true;
  lastError.value = '';
  const rollback = { ...saved.value };
  try {
    await request('/api/v1/write', () => true, { write: true });
    // 落盘顺序：先本地可逆项，再写 store 全局态
    localStorage.setItem('oc.theme', draft.value.theme);
    localStorage.setItem('oc.density', draft.value.density);
    localStorage.setItem('oc.locale', draft.value.locale);
    ui.currentMode = draft.value.mode;
    ui.currentModel = draft.value.model;
    ui.undoWindowSeconds = draft.value.undoWindow;
    saved.value = { ...draft.value };
    ui.track('settings.preferences.saved', { mode: draft.value.mode, density: draft.value.density });
    MessagePlugin.success('偏好已保存并即时生效');
  } catch (e) {
    // 失败保留旧值：草稿与主题一起回滚，避免「界面已变但内核未存」的错觉
    draft.value = rollback;
    applyTheme(rollback.theme);
    lastError.value = (e as { traceId?: string }).traceId ?? 'trace-prefs-31a7';
    MessagePlugin.error('保存失败，已回滚到上一次生效值（未静默写入）');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  window.setTimeout(() => { state.value = 'NORMAL'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="偏好设置" volume="卷 22" manifest="G-10"
      desc="外观、密度、语言、默认模式/模型/工作区与撤销窗口。每项标注影响范围；保存失败回滚到上一次生效值。"
      cli="oc settings set --theme dark --density compact --locale zh-CN --mode default --undo-window 10"
      :status="[{ label: `当前模式 ${ui.currentMode}`, theme: 'primary' }, { label: '失败即回滚', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="resetDraft">放弃修改</Button>
        <Button size="small" theme="primary" :loading="saving" @click="save">保存偏好</Button>
      </template>
    </PageHeader>

    <StateShell :state="state" trace-id="trace-prefs-31a7" :page-size="12"
      empty-title="没有可编辑的偏好" empty-desc="偏好清单未下发（组织基线可能锁定全部项），请联系管理员确认。"
      empty-action="恢复默认偏好" example-task="把主题切到深色并把撤销窗口调到 20 秒，逐项阅读影响说明"
      what="偏好加载失败" why="偏好存储读取超时（浏览器本地存储被策略限制）"
      how="可重试；读取失败时仅展示最近一次已知生效值，不注入任何默认值"
      collapsed-summary="偏好项超出单页渲染阈值，低频项（自定义密度 / 语言变体）已折叠。"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已恢复默认偏好（尚未保存）')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">外观与密度</div>
          <RadioGroup v-model="draft.theme"><RadioButton value="light">浅色</RadioButton><RadioButton value="dark">深色</RadioButton></RadioGroup>
          <div class="oc-muted" style="font-size: 12px">影响：写 localStorage['oc.theme'] 并切换 theme-mode；深色沿用 ≥4.5:1 对比度令牌。</div>
          <div style="height: 10px" />
          <RadioGroup v-model="draft.density"><RadioButton v-for="d in DENSITIES" :key="d.key" :value="d.key">{{ d.key }}</RadioButton></RadioGroup>
          <div class="oc-muted" style="font-size: 12px">影响：{{ densityHint }}</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">语言与区域</div>
          <Select v-model="draft.locale" size="small" :options="[{ label: '简体中文（zh-CN）', value: 'zh-CN' }, { label: 'English（en-US）', value: 'en-US' }]" />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            影响：文案由术语表驱动 —— zh-CN 绑定术语表 v4.2（沙箱五档 / 记忆≠知识等硬约束），en-US 为等义英文表，不改业务语义。回退语言 zh-CN。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">默认模式与默认模型</div>
          <Select v-model="draft.mode" size="small" :options="MODES.map((m) => ({ label: m.label, value: m.value }))" />
          <div class="oc-muted" style="font-size: 12px">影响：{{ modeEffect }}。写 ui.currentMode，仅对新建会话生效（在途会话不受影响）。</div>
          <div style="height: 10px" />
          <Select v-model="draft.model" size="small" :options="modelOptions" />
          <div class="oc-muted" style="font-size: 12px">影响：新会话默认模型，写 ui.currentModel；路由规则与预算约束仍可覆盖。</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">默认工作区与撤销窗口</div>
          <Select v-model="draft.workspace" size="small" :options="workspaceOptions" />
          <div class="oc-muted" style="font-size: 12px">影响：新会话绑定的主工作区；关联工作区只读，写范围以绑定声明为准。</div>
          <div class="oc-flex" style="gap: 8px; align-items: center; margin-top: 8px">
            <span style="font-size: 12px">撤销窗口</span>
            <Slider v-model="draft.undoWindow" :min="5" :max="30" :step="1" style="width: 190px" />
            <span class="oc-mono" style="font-size: 12px">{{ draft.undoWindow }}s</span>
          </div>
          <div class="oc-muted" style="font-size: 12px">影响：低风险危险操作撤销窗口（默认 10s，5–30s），写 ui.undoWindowSeconds。</div>
        </div>
      </div>

      <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px; align-items: center">
        <CliHint command="oc settings set --undo-window 20 --dry-run" label="等价命令（试运行）" />
        <span class="oc-muted" style="font-size: 12px">生效范围：本机 + 本用户（oc.theme / oc.density / oc.locale）。</span>
        <Tag v-if="lastError" size="small" theme="danger" variant="light-outline">上次保存失败</Tag>
        <CopyableId v-if="lastError" :id="lastError" label="复制 traceId" />
      </div>
    </StateShell>
  </div>
</template>
