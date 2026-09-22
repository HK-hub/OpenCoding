<script setup lang="ts">
/**
 * 无障碍设置（G-10）：字号缩放 / 减少动效 / 对比度说明 / 读屏专用布局 / 键盘可达自检清单。
 * 缩放与动效即时生效并本地记忆；自检为逐项结果展示（失败项给出修复动作）。溯源：卷 33 §4.4。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Checkbox, MessagePlugin, Slider, Switch, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';

interface KeyboardCheck { key: string; label: string; how: string; checked: boolean; result?: 'pass' | 'warn' | 'fail' }

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const running = ref(false);
const ranAt = ref('');
const fontScale = ref(Number(localStorage.getItem('oc.fontScale') ?? 1) * 100);
const reducedMotion = ref(localStorage.getItem('oc.motion') === 'reduced');
const screenReaderLayout = ref(localStorage.getItem('oc.screenReaderLayout') === '1');

const checks = ref<KeyboardCheck[]>([
  { key: 'focus', label: '焦点可见：Tab 到达的控件必须有 ≥2px 焦点环', how: 'Tab 走查首屏，确认焦点不被裁切', checked: true },
  { key: 'tab', label: 'Tab 顺序与视觉顺序一致（含抽屉/Dialog 焦点陷阱）', how: '打开弹窗确认焦点被限制在弹窗内', checked: true },
  { key: 'esc', label: 'Esc 可关闭弹层且焦点归还触发元素', how: '关闭后焦点必须回到原按钮', checked: true },
  { key: 'shortcut', label: '六层快捷键不与应用外快捷键冲突', how: '查看「键盘与键位」冲突检测', checked: false },
  { key: 'table', label: '表格可用方向键遍历且行可聚焦', how: '聚焦表头后用方向键移动', checked: true },
  { key: 'form', label: '表单错误与字段绑定（aria-describedby）', how: '提交空表单，读屏需播报错误', checked: false },
  { key: 'live', label: '状态变更经 aria-live 播报（节流合并）', how: '触发审批状态变更，确认播报一次', checked: true },
  { key: 'skip', label: '跳转到主内容链接可用', how: '页面首键应为「跳到主内容」', checked: true },
]);

const checkedCount = computed(() => checks.value.filter((c) => c.checked).length);
const failed = computed(() => checks.value.filter((c) => c.result === 'fail'));
const RESULT_META = { pass: { text: '通过', theme: 'success' }, warn: { text: '建议优化', theme: 'warning' }, fail: { text: '需修复', theme: 'danger' } } as const;

/** 字号缩放：v/100 写入 CSS 变量，main.ts 启动时按同一键恢复 */
function applyFontScale(v: number) {
  document.documentElement.style.setProperty('--oc-font-scale', String(v / 100));
  localStorage.setItem('oc.fontScale', String(v / 100));
  ui.announce(`界面字号已缩放至 ${v}%`);
}

/** 减少动效：同时写 localStorage 与 dataset，供样式层降级过渡动画 */
function applyMotion(v: boolean) {
  localStorage.setItem('oc.motion', v ? 'reduced' : 'normal');
  if (v) document.documentElement.dataset.motion = 'reduced';
  else document.documentElement.removeAttribute('data-motion');
  ui.announce(v ? '已减少动效：过渡动画折叠为即时切换' : '已恢复常规动效');
}

function applyScreenReaderLayout(v: boolean) {
  localStorage.setItem('oc.screenReaderLayout', v ? '1' : '0');
  MessagePlugin.success(v ? '读屏专用布局已开启：折叠装饰性图表，改为语义列表' : '已恢复常规布局');
}

/** TDesign 事件值为联合类型（SliderValue / SwitchValue），在此归一化 */
function onFontScale(v: number | number[]) {
  const n = Array.isArray(v) ? v[0] : v;
  fontScale.value = n;
  applyFontScale(n);
}
function onMotion(v: unknown) { reducedMotion.value = v === true; applyMotion(reducedMotion.value); }
function onScreenReader(v: unknown) { screenReaderLayout.value = v === true; applyScreenReaderLayout(screenReaderLayout.value); }

function runCheck() {
  running.value = true;
  window.setTimeout(() => {
    // 逐项判定：未勾选项按严重度给出 warn / fail（确定性，便于演示修复路径）
    checks.value = checks.value.map((c, i) => ({ ...c, result: c.checked ? 'pass' : i % 2 === 0 ? 'fail' : 'warn' }));
    running.value = false;
    ranAt.value = new Date().toLocaleTimeString('zh-CN');
    ui.track('a11y.keyboard.check', { passed: checkedCount.value });
    MessagePlugin.info('自检完成：通过 ' + checkedCount.value + ' 项，需修复 ' + failed.value.length + ' 项');
  }, 900);
}

onMounted(() => {
  window.setTimeout(() => { state.value = 'NORMAL'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="无障碍" volume="卷 33" manifest="G-10"
      desc="字号缩放、减少动效、对比度约束、读屏专用布局与键盘可达自检。所有偏好本地即时生效，刷新后按同一键恢复。"
      cli="oc a11y set --font-scale 120 --reduced-motion on --keyboard-audit"
      :status="[{ label: `字号 ${fontScale}%`, theme: 'primary' }, { label: '对比度 ≥4.5:1', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="onFontScale(100)">恢复默认缩放</Button>
        <Button size="small" theme="primary" :loading="running" @click="runCheck">运行自检</Button>
      </template>
    </PageHeader>

    <StateShell :state="state" trace-id="trace-a11y-90d1" :page-size="8"
      empty-title="无障碍偏好未初始化" empty-desc="组织基线未下发无障碍默认值，可按系统 prefers-reduced-motion 自动继承。"
      empty-action="继承系统偏好" example-task="把字号调到 130% 并开启减少动效，再运行一次键盘可达自检"
      what="无障碍设置加载失败" why="样式令牌读取失败（字体缩放变量未注入根节点）"
      how="可重试；失败时保持当前视觉，不强制改写 layout"
      collapsed-summary="自检项超过单页阈值，已折叠低频项（表单错误绑定 / 快捷键冲突）。"
      @retry="state = 'LOADING'" @empty-action="applyMotion(true)"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">字号缩放（80%–150%）</div>
          <div class="oc-flex" style="gap: 10px; align-items: center">
            <Slider :model-value="fontScale" :min="80" :max="150" :step="5" style="flex: 1" @change="onFontScale" />
            <span class="oc-mono" style="font-size: 12px">{{ fontScale }}%</span>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            影响：写根节点 --oc-font-scale（{{ fontScale / 100 }}）与 localStorage['oc.fontScale']；根字号变化同步触发表格行高，不截断内容。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">动效与读屏布局</div>
          <div class="oc-flex" style="gap: 8px; align-items: center">
            <Switch :model-value="reducedMotion" size="small" @change="onMotion" />
            <span style="font-size: 13px">减少动效</span><Tag size="small" variant="outline">写 oc.motion + dataset.motion</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px">影响：过渡动画折叠为即时切换；进度/加载类动效保留最低限度并停用视差。</div>
          <div class="oc-flex" style="gap: 8px; align-items: center; margin-top: 10px">
            <Switch :model-value="screenReaderLayout" size="small" @change="onScreenReader" />
            <span style="font-size: 13px">读屏专用布局</span>
          </div>
          <div class="oc-muted" style="font-size: 12px">影响：图表降级为语义列表 + 摘要数据；装饰性图标标记 aria-hidden，不改变信息量。</div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">对比度约束（说明）</div>
          <InfoGrid :columns="1" :items="[
            { key: 'body', label: '正文文本', value: '对比度 ≥4.5:1（WCAG AA），深浅主题分别实测' },
            { key: 'large', label: '大字与图标', value: '对比度 ≥3:1（≥18pt 或 ≥14pt 粗体）' },
            { key: 'state', label: '状态色', value: '成功/警告/错误同时提供图标 + 文本，不单独依赖颜色' },
            { key: 'now', label: '当前实测', value: '浅色 4.83:1 · 深色 5.12:1' },
          ]" />
          <div class="oc-flex" style="gap: 6px; margin-top: 8px; align-items: center">
            <OcIcon name="check" size="13px" color="var(--td-success-color)" />
            <span class="oc-muted" style="font-size: 12px">对比度不足会被主题校验阻断发布（不是建议项）。</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">键盘可达自检清单</div>
          <div class="oc-stack" style="gap: 6px">
            <Checkbox v-for="c in checks" :key="c.key" :checked="c.checked" :label="c.label" @change="(v: boolean) => { c.checked = v; }" />
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 6px">
            <span class="oc-muted" style="font-size: 12px">自检时间：{{ ranAt || '尚未运行' }}</span>
            <Tag v-if="failed.length" size="small" theme="danger" variant="light-outline">需修复 {{ failed.length }} 项</Tag>
          </div>
        </div>
      </div>

      <div v-if="ranAt" class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">自检结果（逐项）</div>
        <div class="oc-stack" style="gap: 6px">
          <div v-for="c in checks" :key="`r-${c.key}`" class="oc-flex oc-flex--wrap" style="gap: 8px; align-items: center">
            <Tag size="small" :theme="RESULT_META[c.result ?? 'warn'].theme" variant="light-outline">{{ RESULT_META[c.result ?? 'warn'].text }}</Tag>
            <span style="font-size: 12px">{{ c.label }}</span><span class="oc-muted" style="font-size: 12px">{{ c.how }}</span>
          </div>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc a11y audit --keyboard --contrast --out a11y-report.json" />
          <CopyableId id="trace-a11y-90d1" label="复制 traceId" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
