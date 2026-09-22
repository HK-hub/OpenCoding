<script setup lang="ts">
/**
 * 技能创作器（K-08）：三入口（从会话提炼 / 模板脚手架 / 手写）→ 定义 → 用例 → 人工评审后发布。
 * 溯源：卷 08 D-SKILL-9；硬约束：禁止自动发布，必须先跑用例 + 人工评审。
 */
import { computed, ref } from 'vue';
import { Alert, Button, Checkbox, CheckboxGroup, Input, MessagePlugin, RadioButton, RadioGroup, StepItem, Steps, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const step = ref(0);
const entry = ref<'session' | 'template' | 'manual'>('session');
const draft = ref({
  name: 'acme.platform.retry-idempotency',
  version: '0.1.0',
  desc: '从会话提炼：幂等重试改造的检查清单与验收标准',
  trigger: '**/*Retry*.java',
});
const caps = ref<string[]>(['commandExecution']);
const caseState = ref<'idle' | 'running' | 'done'>('idle');
const caseResult = ref({ passed: 0, total: 3, cost: 0.0412, durationMs: 86_000 });
const reviewed = ref(false);

const entries = [
  { value: 'session', label: '从会话提炼', desc: '把最近一次成功流程导出为技能草稿（含工具序列与验收证据），自动脱敏会话密钥与路径' },
  { value: 'template', label: '模板脚手架', desc: '按场景模板生成 skill.md + manifest.yaml + tests/ 骨架（推荐给首次创作者）' },
  { value: 'manual', label: '手写导入', desc: '导入已有技能目录（离线校验清单与必需文件，缺失 Fail-Fast）' },
];
const capOptions = [
  { id: 'network', label: '网络出网（需声明域名白名单）' },
  { id: 'commandExecution', label: '命令执行（沙箱 L1）' },
  { id: 'fileWrite', label: '文件写入（需声明写范围）' },
  { id: 'secret', label: '密钥引用（引用式，明文不回显）' },
  { id: 'subagent', label: '子 Agent 派生（深度 ≤2）' },
];

const yaml = computed(() => `name: ${draft.value.name}
version: ${draft.value.version}
description: ${draft.value.desc}
scope: project
compatibility:
  kernel: ">=1.2 <2.0"
  modelCapabilities: [tools]
triggers:
  - type: file-pattern
    value: "${draft.value.trigger}"
capabilities:
  commandExecution: ${caps.value.includes('commandExecution')}
  networkDomains: ${caps.value.includes('network') ? '[api.internal.acme.com]' : '[]'}
  fileWriteScopes: ${caps.value.includes('fileWrite') ? '[src/**]' : '[]'}
  secretRefs: ${caps.value.includes('secret') ? '[acme.draft.token]' : '[]'}
permissions:
  recommended-mode: default     # 只可收窄当前模式
eval:
  entry: tests/case-01.yaml
signature: <发布时由 oc skill sign 生成>`);


/** 本地草稿键前缀（与演示控制台「重置演示数据」约定一致：oc.* 键随之清理） */
const DRAFT_KEY_PREFIX = 'oc.skill.draft.';

/** 本地草稿条目：key / 名称 / 版本 / 最近保存时间 */
type LocalDraft = { key: string; name: string; version: string; savedAt: string };
const drafts = ref<LocalDraft[]>([]);
const lastSavedAt = ref('');

/** 保存草稿：真实写入 localStorage（key 前缀 oc.skill.draft.），清单与最近保存时间即时更新 */
function saveDraft() {
  const key = `${DRAFT_KEY_PREFIX}${draft.value.name}`;
  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(key, JSON.stringify({ ...draft.value, caps: caps.value, savedAt }));
  } catch {
    MessagePlugin.warning('浏览器本地存储不可用（隐私模式）：草稿未落盘');
    return;
  }
  lastSavedAt.value = savedAt;
  loadDrafts();
  MessagePlugin.success(`草稿已保存：${key}（写入浏览器本地存储，本页草稿清单已更新）`);
}

/** 扫描本地草稿（前缀 oc.skill.draft.），按保存时间倒序展示 */
function loadDrafts() {
  const list: LocalDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) ?? '';
      if (!key.startsWith(DRAFT_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { name?: string; version?: string; savedAt?: string };
      list.push({ key, name: parsed.name ?? key.slice(DRAFT_KEY_PREFIX.length), version: parsed.version ?? '0.0.0', savedAt: parsed.savedAt ?? '' });
    }
  } catch {
    /* 隐私模式下不可用：保留会话内已保存结果 */
  }
  drafts.value = list.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

/** 载入本地草稿到编辑器（名称 / 版本 / 触发 / 描述 / 能力声明） */
function loadDraft(d: LocalDraft) {
  try {
    const parsed = JSON.parse(localStorage.getItem(d.key) ?? '{}') as { name?: string; version?: string; desc?: string; trigger?: string; caps?: string[] };
    draft.value = {
      name: parsed.name ?? draft.value.name,
      version: parsed.version ?? draft.value.version,
      desc: parsed.desc ?? draft.value.desc,
      trigger: parsed.trigger ?? draft.value.trigger,
    };
    if (parsed.caps) caps.value = parsed.caps;
    MessagePlugin.info(`已载入草稿「${d.name}」：继续编辑后保存会覆盖同一 key`);
  } catch {
    MessagePlugin.warning(`草稿「${d.name}」读取失败：内容不是合法 JSON，可删除后重存`);
  }
}

loadDrafts();


function runCases() {
  caseState.value = 'running';
  window.setTimeout(() => {
    caseState.value = 'done';
    caseResult.value = { passed: 2, total: 3, cost: 0.0412, durationMs: 86_000 };
    MessagePlugin.warning('2/3 通过：第 3 例（越权路径写入）期望「显式拒绝」但实际为「静默跳过」——需修复后再发布');
  }, 900);
}

function publish() {
  MessagePlugin.success(`草稿已提交私仓审核：${draft.value.name}@${draft.value.version}（人工评审通过后进入发布流程）`);
  router.push('/extension/skills/distribution');
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/skills/creator', () => true);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="技能创作器"
      desc="把成功流程沉淀为可复用技能：三入口创作 → 定义能力与触发 → 跑用例 → 人工评审后发布（禁止自动发布）。"
      volume="卷 08" manifest="K-08" cli="oc skill init --from-session <sessionId>"
      :status="[{ label: '草稿', theme: 'default' }, { label: '需人工评审', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/skills')">返回技能库</Button>
        <Button size="small" variant="outline" @click="saveDraft">保存草稿</Button>
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


    <Steps :current="step" size="small">
      <StepItem title="选择入口" content="会话提炼 / 模板 / 手写" />
      <StepItem title="定义与能力" content="清单字段 + 能力声明" />
      <StepItem title="跑用例" content="离线可运行" />
      <StepItem title="评审与发布" content="人工评审后入库" />
    </Steps>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">① 入口</h3>
        <RadioGroup v-model="entry" style="margin-bottom: 8px">
          <RadioButton v-for="e in entries" :key="e.value" :value="e.value">{{ e.label }}</RadioButton>
        </RadioGroup>
        <div class="oc-secondary" style="font-size: 12px">
          {{ entries.find((e) => e.value === entry)?.desc }}
        </div>
        <Alert
          v-if="entry === 'session'"
          style="margin-top: 10px"
          theme="info"
          message="提炼即脱敏"
          description="从会话导出时自动剥离密钥明文、绝对路径与内部地址；产出为草稿，需人工核对后再发布。"
        />

        <h3 class="oc-card__title" style="margin-top: 14px">② 定义</h3>
        <div class="oc-stack" style="gap: 8px">
          <Input v-model="draft.name" size="small" label="命名空间式名称" placeholder="org.team.skill-name" />
          <Input v-model="draft.version" size="small" label="版本（语义化）" placeholder="0.1.0" />
          <Input v-model="draft.trigger" size="small" label="触发（文件模式）" placeholder="**/*.java" />
          <Textarea v-model="draft.desc" label="描述" :autosize="{ minRows: 2 }" />
        </div>

        <h3 class="oc-card__title" style="margin-top: 14px">能力声明（最小权限）</h3>
        <CheckboxGroup v-model="caps">
          <div v-for="c in capOptions" :key="c.id">
            <Checkbox :value="c.id">{{ c.label }}</Checkbox>
          </div>
        </CheckboxGroup>
      </div>

      <div class="oc-stack" style="gap: 12px">

        <div class="oc-card">
          <h3 class="oc-card__title">
            本地草稿（{{ drafts.length }}）
            <span class="oc-muted" style="font-size: 12px">key 前缀 oc.skill.draft.*，随「重置演示数据」一并清理</span>
          </h3>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 6px">
            最近保存：{{ lastSavedAt ? new Date(lastSavedAt).toLocaleString('zh-CN') : '—' }}（写入浏览器本地存储，刷新后仍在）
          </div>
          <div v-if="!drafts.length" class="oc-muted" style="font-size: 12px">暂无本地草稿：点右上「保存草稿」落盘。</div>
          <div v-for="d in drafts" :key="d.key" class="oc-flex--between oc-flex--wrap" style="gap: 8px; font-size: 12px; margin-bottom: 4px">
            <span class="oc-mono oc-truncate" style="max-width: 220px">{{ d.name }}@{{ d.version }}</span>
            <span class="oc-muted">{{ d.savedAt ? new Date(d.savedAt).toLocaleString('zh-CN') : '—' }}</span>
            <Button size="small" variant="text" @click="loadDraft(d)">载入</Button>
          </div>
        </div>


        <div class="oc-card">
          <h3 class="oc-card__title">
            ③ 用例（一键跑）
            <Tag size="small" :theme="caseState === 'done' ? 'warning' : 'default'" variant="light-outline">
              {{ caseState === 'idle' ? '未运行' : caseState === 'running' ? '运行中' : `${caseResult.passed}/${caseResult.total} 通过` }}
            </Tag>
          </h3>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Button size="small" variant="outline" :loading="caseState === 'running'" @click="runCases">
              <OcIcon name="task-checked" size="12px" /> 一键跑用例
            </Button>
            <span v-if="caseState === 'done'" class="oc-muted" style="font-size: 12px">
              成本 ${{ caseResult.cost.toFixed(4) }} · 时长 {{ (caseResult.durationMs / 1000).toFixed(1) }}s
            </span>
            <CliHint command="oc skill eval ./draft --offline" />
          </div>
          <Alert
            v-if="caseState === 'done'"
            style="margin-top: 10px"
            theme="warning"
            message="存在未通过用例：发布被门禁拦截"
            description="第 3 例失败（越权路径应显式拒绝而非静默跳过）——修复指令后重跑；门禁不达标不允许入库。"
          />
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">④ 人工评审与发布</h3>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 8px">
            自动生成并自动发布被策略禁止（D-SKILL-9 B3 淘汰）；评审人需确认：指令可读、能力最小、用例充分、无越权路径。
          </div>
          <Checkbox v-model="reviewed">已完成人工评审（评审人将在审核记录中留痕）</Checkbox>
          <div class="oc-flex" style="gap: 8px; margin-top: 10px">
            <Button size="small" theme="primary" :disabled="!reviewed || caseState !== 'done'" @click="publish">提交私仓审核</Button>
            <Button size="small" variant="text" @click="router.push('/extension/skills/eval')">查看门禁规则</Button>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">生成的 manifest.yaml（可 diff 评审）</h3>
          <JsonBlock :value="yaml" label="draft/manifest.yaml（发布时自动签名）" :collapse-over="200" />
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
