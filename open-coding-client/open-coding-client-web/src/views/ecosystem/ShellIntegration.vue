<script setup lang="ts">
/**
 * Shell 集成（G2-01）：四种 Shell（bash/zsh/fish/pwsh）补全脚本安装命令（可复制）、别名建议表、
 * 提示符片段（当前会话 / 待审批计数）、cd 联动说明与历史回填入口。
 * 溯源：卷 29 / BUILD-MANIFEST G2-01。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Input, MessagePlugin, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { downloadText } from '@/utils/download';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const rows = enterpriseData.shellIntegration;

/** 四种 Shell（pwsh 受企业策略限制，显式标注原因而非隐藏） */
const SHELLS = [
  { key: 'bash', label: 'bash', note: 'Linux / macOS 默认；补全数据来源本地缓存，离线可用' },
  { key: 'zsh', label: 'zsh', note: '含描述与分组的高亮补全' },
  { key: 'fish', label: 'fish', note: '历史候选按权限过滤，不含敏感参数' },
  { key: 'powershell', label: 'PowerShell (pwsh)', note: '企业策略限制：仅允许 bash/zsh，其余禁用' },
];

/** 别名建议（写进 .bashrc / .zshrc / config.fish 即可） */
const ALIASES = [
  { id: 'al-1', alias: 'ocs', command: 'oc status --short', desc: '内核与连接状态（含待审批数）' },
  { id: 'al-2', alias: 'ocr', command: 'oc review --diff HEAD~1..HEAD --json', desc: '审查最近一次提交的变更' },
  { id: 'al-3', alias: 'oct', command: 'oc task list --mine', desc: '我的任务列表（含预算水位）' },
  { id: 'al-4', alias: 'occ', command: 'oc cost today', desc: '今日成本（含缓存节省）' },
  { id: 'al-5', alias: 'ocd', command: 'oc doctor --summary', desc: '诊断摘要（排障第一步）' },
  { id: 'al-6', alias: 'oci', command: 'oc import --dry-run', desc: '导入预演（不写任何数据）' },
  { id: 'al-7', alias: 'ocx', command: 'oc export --target archive', desc: '导出通用存档（含检查清单）' },
  { id: 'al-8', alias: 'ocq', command: 'oc queue --json', desc: '队列与并发度快照' },
];

const rowsFor = (shell: string) => rows.filter((r) => r.shell === shell);

/** 直接可复制的片段常量（避免在模板属性里拼接含引号的命令） */
const CMD_BASH_COMPLETION = 'eval "$(oc completion bash)"';
const CMD_PROMPT = 'export PS1="$(oc prompt --short) \\w $ "';

/** 历史回填入口：把最近会话/任务写成 shell 历史建议（按权限过滤，不含敏感参数） */
const HISTORY = [
  'oc status --short',
  'oc task list --mine',
  'oc cost today',
  'oc doctor --summary',
  'oc review --diff HEAD~1..HEAD --json',
  'oc search --keyword 深链 --source all',
];

const aliasColumns = [
  { colKey: 'alias', title: '别名', width: 90, cell: 'alias' },
  { colKey: 'command', title: '展开命令', width: 300, cell: 'cmd' },
  { colKey: 'desc', title: '说明', ellipsis: true },
  { colKey: 'ops', title: '操作', width: 90, cell: 'ops' },
];

type ShellState = 'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA';

const PAGE_SIZE = 5;
const keyword = ref('');
const limit = ref(PAGE_SIZE);
const loading = ref(true);
const errorMsg = ref('');
const errorTrace = ref('trace-shell-84fd20');

const matched = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return ALIASES.filter((a) => !kw || `${a.alias}${a.command}${a.desc}`.toLowerCase().includes(kw));
});
const visible = computed(() => matched.value.slice(0, limit.value));
const edgeSummary = computed(() => `匹配 ${matched.value.length} 条，超过单次渲染阈值（${PAGE_SIZE} 条）已折叠。`);
const state = computed<ShellState>(() => {
  if (loading.value) return 'LOADING';
  if (errorMsg.value) return 'ERROR';
  if (!matched.value.length) return 'EMPTY';
  return matched.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

function reload() {
  loading.value = true;
  errorMsg.value = '';
  window.setTimeout(() => (loading.value = false), 200);
}

function loadMore() {
  limit.value += PAGE_SIZE;
}

/** 复制片段：企业策略禁用的 Shell 直接阻断并给出原因（不静默跳过） */
function copySnippet(command: string, label: string, enabled: boolean) {
  if (!enabled) {
    errorMsg.value = `企业策略禁止该片段（${label}）：当前策略仅允许 bash / zsh 的补全与钩子。`;
    errorTrace.value = `trace-shell-${Math.abs(label.length * 104729).toString(16)}`;
    return;
  }
  errorMsg.value = '';
  copy(command, label);
}

/** 复制任一命令（剪贴板不可用时显式提示） */
async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    MessagePlugin.success(`${label} 已复制`);
  } catch {
    MessagePlugin.warning('浏览器未授权剪贴板，请手动选择复制');
  }
}

/** 历史回填：真实生成可下载的历史片段文件（source 后即生效） */
function backfillHistory() {
  const body = HISTORY.map((h) => `${h}\n`).join('');
  const name = downloadText(`# OpenCoding Shell 历史回填（最近会话 / 任务 / 成本查询）\n# 用法：source 本文件，或把内容追加到 ~/.bash_history\n${body}`, 'oc-history-backfill.sh');
  MessagePlugin.success(`已生成 ${name}：source 后即可用 ↑ 快速重放（历史候选已按权限过滤，不含敏感参数）`);
}

const enabledCount = computed(() => rows.filter((r) => r.enabled).length);

onMounted(() => {
  // 首次加载：读本地缓存的片段索引（离线可用；缓存 miss 时降级为不带计数的短提示符）
  window.setTimeout(() => (loading.value = false), 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="Shell 集成"
      desc="四种 Shell 的补全脚本、别名建议、提示符片段（当前会话 / 待审批计数）与 cd 联动；历史回填把常用查询写成历史候选（已脱敏、按权限过滤）。"
      volume="卷 29"
      manifest="G2-01"
      cli="oc completion install --shell bash"
      :status="[{ label: '离线可用（本地缓存）', theme: 'success' }, { label: 'pwsh 受企业策略限制', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="backfillHistory">历史回填</Button>
        <Button size="small" theme="primary" @click="copy(CMD_BASH_COMPLETION, 'bash 补全安装命令')">一键复制安装命令</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="支持 Shell" :value="SHELLS.length" unit="种" icon="terminal" hint="bash / zsh / fish / pwsh" />
      <StatCard label="已启用片段" :value="enabledCount" unit="个" icon="check" />
      <StatCard label="待审批计数" :value="ui.pendingApprovals" unit="个" icon="notification" hint="提示符中常驻显示（黄/红阈值）" />
      <StatCard label="别名建议" :value="ALIASES.length" unit="条" icon="code" />
    </div>

    <StateShell
      :state="state"
      :collapsed-summary="edgeSummary"
      :page-size="5"
      stage="正在读取 Shell 片段与别名建议…"
      empty-title="没有匹配的别名建议"
      empty-desc="换个关键词，或重置筛选条件；别名是可选的效率项，不影响 CLI 能力完整性。"
      empty-action="重置筛选"
      example-task="在 zsh 中启用 cd 联动并在进入仓库时收到可用指令提示"
      what="Shell 片段读取失败"
      why="补全脚本生成失败（本地缓存索引不可读）或企业策略禁止该 Shell。"
      how="可重试；补全不可用时 CLI 仍可正常使用（补全只是效率增强）。"
      :trace-id="errorTrace"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="keyword = ''"
    >
      <Alert
        v-if="errorMsg"
        theme="error"
        :message="`事实：${errorMsg}`"
        description="原因：企业策略将 Shell 集成限制为 bash / zsh（策略变更需管理员在「权限与审批 → 策略」中调整）。动作：改用 bash / zsh 的等价片段，或申请策略豁免。"
        style="margin-bottom: 10px"
      />
      <div class="oc-grid oc-grid--2">
        <div v-for="sh in SHELLS" :key="sh.key" class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">{{ sh.label }}</div>
            <Tag size="small" :theme="rowsFor(sh.key).some((r) => r.enabled) ? 'success' : 'warning'" variant="light-outline">
              {{ rowsFor(sh.key).some((r) => r.enabled) ? '已启用' : '未启用' }}
            </Tag>
          </div>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="r in rowsFor(sh.key)" :key="r.id">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" variant="outline">{{ r.feature }}</Tag>
                <span class="oc-muted" style="font-size: 12px">{{ r.desc }}</span>
              </div>
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 4px">
                <CliHint :command="r.installCommand" label="安装命令" />
                <Button size="small" variant="outline" @click="copySnippet(r.installCommand, `${sh.label} ${r.feature}`, r.enabled)">复制</Button>
                <Tooltip v-if="r.note" :content="r.note"><Tag size="small" theme="default" variant="outline">说明</Tag></Tooltip>
              </div>
              <div v-if="r.note" class="oc-muted" style="font-size: 11px; margin-top: 2px">{{ r.note }}</div>
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">{{ sh.note }}</div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">提示符片段（当前会话 / 待审批计数）<CopyableId id="trace-shell-84fd20" label="复制 traceId" /></div>
          <pre class="oc-pre">export PS1="$(oc prompt --short) \w $ "
# 输出示例：[S-4001|2待批|$12.4/20] ~/project/payment-core $</pre>
          <InfoGrid :columns="1" :items="[
            { key: 'session', label: '当前会话', value: 'S-4001（从本地缓存读取，不发起网络请求）' },
            { key: 'approval', label: '待审批计数', value: `${ui.pendingApprovals} 个（P0 审批会以红色常驻）` },
            { key: 'waterline', label: '预算水位', value: '> 80% 变黄，> 90% 变红并提示「高成本任务已阻断」' },
            { key: 'perf', label: '性能', value: '渲染路径零阻塞（缓存 miss 时降级为不带计数的短提示符）' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <CliHint command="oc prompt --install --shell zsh" label="等价 CLI" />
            <Button size="small" variant="outline" @click="copy(CMD_PROMPT, '提示符片段')">复制提示符片段</Button>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">cd 联动说明</div>
          <Alert
            theme="info"
            message="进入含 .oc/ 的目录时，提示可用的项目指令与工作区绑定——只提示，不自动执行任何命令。"
            description="首次进入会打印一行摘要（可用指令数 / 绑定的工作区 / 是否越界目录）；越界目录（工作区外）会提示需要授权，而不是静默允许。"
          />
          <div class="oc-stack" style="gap: 6px; margin-top: 8px; font-size: 13px">
            <div class="oc-flex" style="gap: 6px"><OcIcon name="folder-open" size="14px" /><span>zsh：<span class="oc-mono">add-zsh-hook chpwd _oc_on_cd</span>；bash/fish 提供等价钩子。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="lock" size="14px" /><span>提示内容按权限裁剪：不可见的项目不会出现在提示里（不泄漏存在性）。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="history" size="14px" /><span>历史回填：把最近查询写成历史候选（含权限过滤），↑ 即可重放。</span></div>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Button size="small" theme="primary" @click="backfillHistory">生成历史片段文件</Button>
            <CliHint command="oc completion history --backfill --redact" label="等价 CLI" />
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">别名建议表（{{ matched.length }} 条）</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px">
          <Input v-model="keyword" size="small" placeholder="搜索别名 / 命令 / 说明" clearable style="width: 260px">
            <template #prefix-icon><OcIcon name="search" size="14px" /></template>
          </Input>
          <span class="oc-muted" style="font-size: 12px">建议写入 shell 配置文件；别名只做转发，不改变 CLI 语义与权限。</span>
        </div>
        <Table :data="visible" row-key="id" size="small" :columns="aliasColumns" table-layout="fixed">
          <template #alias="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.alias }}</span></template>
          <template #cmd="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.command }}</span></template>
          <template #ops="{ row }">
            <Button size="small" variant="text" @click="copy(`alias ${row.alias}='${row.command}'`, `别名 ${row.alias}`)">复制</Button>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 6px">展示 {{ visible.length }} / {{ matched.length }} 条；EDGE_DATA 折叠可加载更多。</div>
      </div>
    </StateShell>
  </div>
</template>
