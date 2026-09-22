<script setup lang="ts">
/**
 * O-05 命令终端。
 * 三模式：一次性（捕获输出/退出码/资源）、PTY（stdin/resize/信号）、后台（句柄 + 输出分页 + 可终止）。
 * 危险命令（提权/删除）在提交前显式阻断或要求确认，不静默执行。
 * 溯源：卷 20 D-WS-5/§4.4；BUILD-MANIFEST O-05。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { Button, Dialog, Input, MessagePlugin, Option, Popconfirm, Select, Switch, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { WsCommand } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

/** 终止后台任务的退出码约定（SIGKILL 137），用于把会话状态标记为已终止 */
const SIGKILL_EXIT_CODE = 137;

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR' | 'OFFLINE'>('LOADING');
const wsId = ref('ws-0002');
const mode = ref<'oneshot' | 'pty' | 'background'>('oneshot');
const command = ref('pnpm test --run');
const stdin = ref('y\n');
const cols = ref(120);
const rows = ref(32);
const running = ref(false);
const output = ref<string[]>(['$ pnpm test --run', 'Tests 128 passed (128)', 'Done in 4.2s']);
/** PTY 尺寸标签：resize 后立即反映在界面（终端面板高度同步变化） */
const ptyGeometry = ref('120 × 32');
/** 输出查看弹窗：按 stdout / stderr 切换输出流视图（数据取自该命令已有 outputTail） */
const outputTarget = ref<WsCommand | null>(null);
const streamView = ref<'all' | 'stdout' | 'stderr'>('all');

const ws = computed(() => platformData.workspaces.find((w) => w.workspaceId === wsId.value) ?? platformData.workspaces[1]);
/** 最近命令以局部 ref 渲染：终止后退出码 / 会话状态标签与后台句柄卡片需立即更新（切换工作区时重新指向） */
const commands = ref<WsCommand[]>(ws.value.commands);
watch(wsId, () => { commands.value = ws.value.commands; });
const blocked = computed(() => /sudo|rm -rf|\bmkfs\b|> \/dev\/sd/.test(command.value));
const bgHandles = computed(() => commands.value.filter((c) => c.mode === 'background'));
/** 终端面板高度随 rows 变化（resize 后立即可见；上限 40 行避免撑爆布局） */
const ptyMinHeight = computed(() => `${Math.min(Math.max(Number(rows.value) || 32, 5), 40) * 16}px`);
/** stderr 按错误标记（error / 失败 / 拒绝 / 非零退出码）从既有输出尾部识别 */
const streamLines = computed(() => {
  const tail = outputTarget.value?.outputTail ?? [];
  if (streamView.value === 'all') return tail;
  const stderrRe = /error|失败|拒绝|exit code [1-9]/i;
  return streamView.value === 'stderr' ? tail.filter((l) => stderrRe.test(l)) : tail.filter((l) => !stderrRe.test(l));
});

const columns = [
  { colKey: 'mode', title: '模式', width: 110, cell: 'mode' },
  { colKey: 'command', title: '命令', ellipsis: true, cell: 'cmd' },
  { colKey: 'exitCode', title: '退出码', width: 90, cell: 'code' },
  { colKey: 'resourcePeak', title: '资源峰值', width: 190 },
  { colKey: 'handle', title: '句柄', width: 120, cell: 'handle' },
  { colKey: 'op', title: '操作', width: 140, cell: 'op' },
];

function run() {
  if (blocked.value) {
    MessagePlugin.error('命令被阻断：命中危险命令规则（提权/破坏性删除）。可申请临时授权或改用受控替代方案');
    return;
  }
  running.value = true;
  output.value = [`$ ${command.value}`, `[${mode.value}] 已启动（工作区 ${ws.value.workspaceId}）`];
  window.setTimeout(() => {
    output.value = [...output.value, 'Tests 128 passed (128)', mode.value === 'background' ? '已转为后台任务，句柄 bg-' + Math.floor(1000 + Math.random() * 9000) : `exit code 0（耗时 4.2s，峰值 cpu 3.4 / mem 1.9GB）`];
    running.value = false;
  }, 900);
}

/** resize：校验 cols/rows 后调整 PTY 尺寸，终端面板高度与远端窗口事件同步变化 */
function resizePty() {
  const c = Number(cols.value);
  const r = Number(rows.value);
  if (!Number.isFinite(c) || !Number.isFinite(r) || c < 20 || c > 400 || r < 5 || r > 200) {
    MessagePlugin.warning('resize 参数非法：cols 需在 20–400、rows 需在 5–200 之间（越界会导致远端渲染错乱）');
    return;
  }
  cols.value = c;
  rows.value = r;
  ptyGeometry.value = `${c} × ${r}`;
  output.value = [...output.value, `SIGWINCH：PTY 尺寸已调整为 ${c} × ${r}（TIOCSWINSZ 回执，终端面板高度同步变化）`];
  MessagePlugin.success(`resize 完成：PTY 尺寸 ${c} × ${r}，面板高度已调整并通知远端（SIGWINCH），已完成输出的换行会按新宽度重排`);
}

function openOutput(row: WsCommand) {
  outputTarget.value = row;
  streamView.value = 'all';
}

/** 终止运行中的会话 / 后台任务：Popconfirm 确认后清理进程组，会话状态更新为「已终止」 */
function terminateCommand(row: WsCommand) {
  if (row.exitCode !== null) {
    MessagePlugin.warning(`该命令已结束（退出码 ${row.exitCode}）：无法终止，可用「输出」查看结果；终止仅对运行中的 PTY 会话 / 后台任务（退出码显示「运行中」）生效`);
    return;
  }
  const target = row.handle ? '后台任务' : 'PTY 会话';
  row.exitCode = SIGKILL_EXIT_CODE;
  row.handle = null;
  row.outputTail = [...row.outputTail, `收到 SIGKILL：进程组已清理（未落盘的中间输出不再产出），${target}已终止`];
  MessagePlugin.success(`已终止 ${row.commandId}（${row.command}）：${target}进程组已清理并防僵尸，会话状态更新为「已终止」；未保存输出已丢失，可重新提交`);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = platformData.workspaces.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="命令终端"
      desc="一次性命令用于构建/测试；PTY 用于交互式会话（支持 stdin、resize、信号）；后台任务返回句柄并纳入任务系统，可查输出、可终止。"
      volume="卷 20" manifest="O-05" :cli="`oc workspace exec --id ${ws.workspaceId} --mode ${mode} -- '${command}'`"
      :status="[{ label: ws.capabilities.pty ? 'PTY 可用' : 'PTY 不可用（降级）', theme: ws.capabilities.pty ? 'success' : 'warning' }, { label: ws.capabilities.isolationTier, theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 150px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' },
          { value: 'ERROR', label: '错误' }, { value: 'OFFLINE', label: '离线' },
        ]" />
        <Select v-model="wsId" size="small" style="width: 230px" aria-label="选择工作区">
          <Option v-for="w in platformData.workspaces" :key="w.workspaceId" :value="w.workspaceId" :label="w.name" />
        </Select>
      </template>
    </PageHeader>

    <div v-if="!ws.capabilities.pty" class="oc-flex oc-flex--wrap">
      <Tag theme="warning" variant="light-outline" size="small">PTY 能力缺失</Tag>
      <span style="font-size: 12px">替代：降级为一次性命令 + 轮询输出（非实时）——供应商不支持交互式终端，需重认证或更换后端。</span>
    </div>

    <StateShell
      :state="demo" stage="正在建立命令通道（连接池复用）…"
      empty-title="该工作区还没有命令记录" empty-desc="执行第一条命令后，输出、退出码与资源峰值会在此归档（脱敏后进入审计）。"
      empty-action="执行示例命令" example-task="在 SSH 构建机上跑 mvn verify 并查看资源峰值"
      what="命令通道建立失败" why="连接不可用（SSH 重连退避已达上限 5 次）"
      how="可重试；离线期间命令被拒绝而不是排队（避免长尾堆积）" trace-id="trace-b77f4a13"
      :reconnect-in-ms="5000" :disabled-capabilities="['命令执行', 'PTY 会话', '后台任务提交']"
      @retry="demo = 'NORMAL'" @empty-action="run" @dismiss-offline="demo = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            执行命令
            <RiskBadge :level="blocked ? 'R4' : 'R2'" />
          </h3>
          <div class="oc-stack">
            <Select v-model="mode" size="small" aria-label="执行模式">
              <Option value="oneshot" label="一次性（捕获输出/退出码/资源/超时）" />
              <Option value="pty" label="PTY 交互（stdin / resize / 信号）" :disabled="!ws.capabilities.pty" />
              <Option value="background" label="后台任务（返回句柄，纳入任务系统）" />
            </Select>
            <Textarea v-model="command" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="命令，例如 pnpm test --run" />
            <div v-if="blocked" class="oc-card" style="border-color: var(--oc-sev-error)">
              <div class="oc-flex oc-flex--wrap">
                <Tag theme="danger" variant="light-outline" size="small">危险命令已阻断</Tag>
                <span style="font-size: 12px">命中规则：提权（sudo）或破坏性删除。企业策略默认为 DENY；如需放行请申请临时授权并说明理由。</span>
              </div>
            </div>
            <div v-if="mode === 'pty'" class="oc-flex oc-flex--wrap" style="gap: 8px">
              <Input v-model="stdin" size="small" style="width: 180px" placeholder="stdin 输入" />
              <Input v-model="cols" size="small" style="width: 90px" placeholder="cols" />
              <Input v-model="rows" size="small" style="width: 90px" placeholder="rows" />
              <Button size="small" variant="outline" @click="resizePty">resize</Button>
            </div>
            <div class="oc-flex oc-flex--wrap">
              <Button size="small" theme="primary" :disabled="running" @click="run">{{ running ? '执行中' : '执行' }}</Button>
              <Button size="small" variant="outline" :disabled="!running" @click="running = false; output = [...output, '发送 SIGINT（等价 Ctrl+C），保留已完成部分']">发送 SIGINT</Button>
              <Popconfirm theme="danger" :confirm-btn="{ content: '强制终止', theme: 'danger' }" cancel-btn="取消" @confirm="running = false; MessagePlugin.success('已发送 SIGKILL 并清理进程组（防僵尸）；输出保留至中断点')">
                <template #content>
                  <div style="max-width: 320px">
                    <div>后果：立即终止进程组，未落盘的中间产物可能残留。</div>
                    <div>是否可撤销：不可撤销（工作区快照可在恢复页回滚文件）。</div>
                  </div>
                </template>
                <Button size="small" variant="outline" theme="danger">强制终止</Button>
              </Popconfirm>
              <Switch size="small" disabled /> <span style="font-size: 12px">输出脱敏（密钥类字段掩码）</span>
            </div>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 6px">
              <Tag size="small" variant="light-outline">PTY 尺寸 {{ ptyGeometry }}</Tag>
              <span class="oc-muted" style="font-size: 11px">resize 即时改变面板高度并通知远端（SIGWINCH）</span>
            </div>
            <pre class="oc-pre" :style="{ minHeight: ptyMinHeight }" aria-label="命令输出">{{ output.join('\n') }}</pre>
            <CliHint :command="`oc workspace exec --id ${ws.workspaceId} --mode ${mode} -- '${command}'`" />
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">最近命令（该工作区）</h3>
            <Table :data="commands" :columns="columns" row-key="commandId" size="small" :pagination="undefined">
              <template #mode="{ row }">
                <Tag :theme="row.mode === 'oneshot' ? 'primary' : row.mode === 'pty' ? 'success' : 'warning'" size="small" variant="light-outline">{{ row.mode }}</Tag>
              </template>
              <template #cmd="{ row }"><span class="oc-mono oc-truncate">{{ row.command }}</span></template>
              <template #code="{ row }">
                <span v-if="row.exitCode === SIGKILL_EXIT_CODE" style="font-size: 12px; color: var(--oc-sev-error)">已终止</span>
                <span v-else>{{ row.exitCode ?? '运行中' }}</span>
              </template>
              <template #handle="{ row }"><span class="oc-mono">{{ row.handle ?? '—' }}</span></template>
              <template #op="{ row }">
                <Button size="small" variant="text" @click="openOutput(row as WsCommand)">输出</Button>
                <Popconfirm theme="danger" :confirm-btn="{ content: '终止任务', theme: 'danger' }" cancel-btn="取消" @confirm="terminateCommand(row as WsCommand)">
                  <template #content>
                    <div style="max-width: 320px">
                      <div>作用对象：{{ row.commandId }}（{{ row.command }}）及其进程组。</div>
                      <div>影响：立即终止并清理进程组，未落盘的中间输出会丢失，任务不再产出。</div>
                      <div>是否可撤销：不可撤销（产物可用工作区快照回滚文件）。</div>
                    </div>
                  </template>
                  <Button size="small" variant="text" theme="danger">终止</Button>
                </Popconfirm>
              </template>
            </Table>
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">后台任务句柄</h3>
            <InfoGrid
              :columns="1"
              :items="bgHandles.length
                ? bgHandles.map((h) => ({ key: h.commandId, label: h.handle ?? h.commandId, value: `${h.command} · ${h.exitCode === null ? '运行中' : `退出码 ${h.exitCode}`} · ${h.outputTail[0]}` }))
                : [{ key: 'none', label: '后台任务', value: '当前无后台任务（长任务会返回句柄并可分页读输出）' }]"
            />
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog :visible="!!outputTarget" @visible-change="(v: boolean) => { if (!v) outputTarget = null }" :header="outputTarget ? `命令输出：${outputTarget.commandId}` : ''" width="760px" :footer="false">
      <div v-if="outputTarget" class="oc-stack">
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" variant="outline">{{ outputTarget.mode }}</Tag>
          <span class="oc-mono" style="font-size: 12px">{{ outputTarget.command }}</span>
          <Tag size="small" variant="light-outline" :theme="outputTarget.exitCode === SIGKILL_EXIT_CODE ? 'danger' : 'default'">
            {{ outputTarget.exitCode === SIGKILL_EXIT_CODE ? '已终止' : `退出码 ${outputTarget.exitCode ?? '运行中'}` }}
          </Tag>
          <Tag size="small" variant="light-outline">资源峰值 {{ outputTarget.resourcePeak }}</Tag>
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Select v-model="streamView" size="small" style="width: 210px" aria-label="输出流视图">
            <Option value="all" label="合并视图（stdout + stderr）" />
            <Option value="stdout" label="仅 stdout" />
            <Option value="stderr" label="仅 stderr" />
          </Select>
          <span class="oc-muted" style="font-size: 12px">stderr 按错误标记（error / 失败 / 拒绝 / 非零退出码）从输出尾部识别，切换即刷新视图</span>
        </div>
        <pre class="oc-pre" aria-label="命令输出详情">{{ streamLines.length ? streamLines.join('\n') : '（该输出流当前无内容）' }}</pre>
      </div>
    </Dialog>
  </div>
</template>
