<script setup lang="ts">
/**
 * IM 机器人（G2-05）：指令表（/status /task /cost /run，说明 /run 受配额与权限约束且默认进 plan 模式
 * 需确认）、审批卡片预览、身份绑定状态（IM 账号 ↔ 平台账号，未绑定一律拒绝执行）、
 * 敏感信息不落 IM 的说明。
 * 溯源：卷 29 / BUILD-MANIFEST G2-05。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Alert, Button, Dialog, Input, MessagePlugin, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useExtList } from '@/components/extension/useExtList';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const bindings = enterpriseData.imBindings;

/** /run 的配额与默认模式（受约束：配额 + 权限 + plan 模式确认） */
const RUN_QUOTA = { used: 12, limit: 20, resetAt: '次日 00:00', mode: 'plan（默认，需在 IM 内确认后才执行）' };

/** 绑定状态：未绑定的 IM 账号一律拒绝执行（绑定后即时生效，可解绑） */
const bound = ref<Record<string, boolean>>(Object.fromEntries(bindings.map((b) => [b.id, b.bound])));
const bindingTarget = ref<(typeof bindings)[number] | null>(null);
const bindingOpen = ref(false);
const bindingCode = ref('');
const cardSeconds = ref(272);

const boundCount = computed(() => bindings.filter((b) => bound.value[b.id]).length);
const bindingColumns = [
  { colKey: 'command', title: '指令', width: 190, cell: 'cmd' },
  { colKey: 'desc', title: '说明', ellipsis: true },
  { colKey: 'permission', title: '权限', width: 230, ellipsis: true },
  { colKey: 'identity', title: '身份绑定（IM ↔ 平台）', width: 230, cell: 'identity' },
  { colKey: 'ops', title: '操作', width: 110, cell: 'ops' },
];

const list = useExtList(bindings, { persistKey: 'eco-im-bindings', pageSize: 3, match: () => true });
const { visible, state, matched, edgeSummary, reload, loadMore } = list;

const countdown = computed(() => `${Math.floor(cardSeconds.value / 60)}:${String(cardSeconds.value % 60).padStart(2, '0')}`);
let timer: number | undefined;

function openBinding(id: string) {
  bindingTarget.value = bindings.find((b) => b.id === id) ?? null;
  bindingCode.value = '';
  bindingOpen.value = true;
}

/** 绑定：用一次性绑定码把 IM 账号与平台账号关联；未绑定身份时 /run 与审批动作一律拒绝 */
function confirmBinding() {
  const target = bindingTarget.value;
  if (!target) return;
  if (bindingCode.value.trim().length < 6) {
    MessagePlugin.warning('绑定码格式不合法（6 位一次性码，由控制台生成，10 分钟内有效）');
    return;
  }
  bound.value = { ...bound.value, [target.id]: true };
  bindingOpen.value = false;
  MessagePlugin.success(`已绑定 ${target.command}：IM 账号 ↔ 平台账号（绑定关系可随时在控制台解绑）`);
}

onMounted(() => {
  // 审批卡片倒计时（真实递减；到期自动失效，需重新发起审批）
  timer = window.setInterval(() => {
    cardSeconds.value = Math.max(0, cardSeconds.value - 1);
  }, 1000);
  ui.setViewState({ state: 'NORMAL' });
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="IM 机器人"
      desc="IM 只做「轻交互入口」：状态查询与审批卡片；/run 受配额与权限约束、默认进 plan 模式需确认；未绑定身份一律拒绝执行；敏感信息不落 IM。"
      volume="卷 29"
      manifest="G2-05"
      cli="oc im binding list --json"
      :status="[{ label: '未绑定即拒绝', theme: 'danger' }, { label: '/run 默认 plan 模式', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="reload">刷新绑定状态</Button>
        <Button size="small" theme="primary" @click="openBinding('im-04')">绑定身份</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="指令数" :value="bindings.length" unit="个" icon="robot" hint="状态 / 任务 / 成本 / 提交 / 审批卡" />
      <StatCard label="已绑定身份" :value="boundCount" unit="个" icon="user" hint="IM 账号 ↔ 平台账号" />
      <StatCard label="/run 今日用量" :value="RUN_QUOTA.used" unit="次" icon="chart" :target="RUN_QUOTA.limit" target-kind="max" :lower-is-better="true" :hint="`配额 ${RUN_QUOTA.limit} 次，${RUN_QUOTA.resetAt} 重置`" />
      <StatCard label="卡片倒计时" :value="countdown" format="raw" icon="time" hint="审批卡片到期即失效（需重新发起）" />
    </div>

    <StateShell
      :state="state"
      :collapsed-summary="edgeSummary"
      :page-size="3"
      stage="正在读取 IM 指令与绑定状态…"
      empty-title="尚未配置 IM 机器人"
      empty-desc="没有可用的指令适配器；IM 集成是可选入口，未配置不影响桌面端与 CLI 的完整能力。"
      empty-action="查看配置指引"
      example-task="在 IM 中发送 /status 查看内核状态与待审批数"
      what="IM 绑定状态读取失败"
      why="适配器不可达（Webhook 回调地址未通过校验或平台 Token 过期）。"
      how="可重试；Token 过期需在平台侧重装应用，绑定关系会保留。"
      trace-id="trace-imbot-5e07c2"
      @retry="reload"
      @load-more="loadMore"
      @empty-action="reload"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">指令表（匹配 {{ matched.length }} 条）<CopyableId id="trace-imbot-5e07c2" label="复制 traceId" /></div>
          <Table :data="visible" row-key="id" size="small" :columns="bindingColumns" table-layout="fixed">
            <template #cmd="{ row }">
              <span class="oc-mono" style="font-size: 12px">{{ row.command }}</span>
              <Tag v-if="row.command === '/run <指令>'" size="small" theme="warning" variant="light-outline" style="margin-left: 4px">受约束</Tag>
            </template>
            <template #identity="{ row }">
              <div class="oc-stack" style="gap: 2px">
                <span style="font-size: 12px">{{ bound[row.id] ? row.boundIdentity : '（未绑定）' }}</span>
                <Tag size="small" :theme="bound[row.id] ? 'success' : 'danger'" variant="light-outline">{{ bound[row.id] ? '已绑定' : '未绑定：拒绝执行' }}</Tag>
              </div>
            </template>
            <template #ops="{ row }">
              <Button v-if="!bound[row.id]" size="small" variant="text" @click="openBinding(row.id)">去绑定</Button>
              <Tooltip v-else content="解绑后该 IM 账号的 /run 与审批动作立即被拒绝">
                <Button size="small" variant="text" @click="MessagePlugin.warning('解绑需在「组织身份 → 绑定关系」中操作（此处不提供快捷解绑，避免误触）')">解绑</Button>
              </Tooltip>
            </template>
          </Table>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">/run 的约束（配额 + 权限 + plan 模式）</div>
          <Alert
            theme="warning"
            message="/run 受配额与权限双重约束，且默认进 plan 模式：先在 IM 内确认计划，再执行。"
            :description="`配额：${RUN_QUOTA.limit} 次/日（已用 ${RUN_QUOTA.used}），超限直接拒绝并提示；权限：受限写，越权动作转入审批；模式：plan（可显式改 default，但高风险工具仍需确认）。`"
          />
          <InfoGrid :columns="1" :items="[
            { key: 'mode', label: '默认模式', value: RUN_QUOTA.mode },
            { key: 'quota', label: '配额', value: `${RUN_QUOTA.used} / ${RUN_QUOTA.limit} 次（${RUN_QUOTA.resetAt} 重置）` },
            { key: 'perm', label: '权限', value: '受限写；删除 / 推送 / 发布类动作必须转审批（IM 内不直接放行）' },
            { key: 'cancel', label: '打断', value: 'IM 中可发送 /cancel <taskId>（安全点停止，保留已完成部分）' },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <CliHint command="oc im run --quota --plan-first" label="等价 CLI" />
            <Tag size="small" variant="outline">配额≠权限：配额是额度，权限是边界</Tag>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">审批卡片预览（IM 内真实形态）</div>
          <div class="oc-card" style="border: 1px dashed var(--oc-border-strong, #ccc)">
            <div class="oc-flex--between">
              <div class="oc-flex" style="gap: 6px">
                <OcIcon name="secured" size="16px" />
                <b style="font-size: 13px">待审批 · R3 删除操作</b>
              </div>
              <Tag size="small" theme="danger" variant="light-outline">倒计时 {{ countdown }}</Tag>
            </div>
            <InfoGrid :columns="1" :items="[
              { key: 'target', label: '目标', value: 'secrets/ 目录（3 个文件）', mono: true },
              { key: 'scope', label: '范围', value: '单次（不做授权记忆；审批≠授权记忆）' },
              { key: 'by', label: '发起者', value: '会话 S-4001 · 模型 claude-sonnet-4.5' },
              { key: 'why', label: '理由', value: '清理已轮换的旧凭证文件（含 diff 链接，正文在客户端查看）' },
            ]" />
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
              <Tooltip content="预览态：实际按钮在 IM 卡片内点击；批准动作带签名回调 + 身份校验">
                <Button size="small" theme="danger" disabled>批准（预览）</Button>
              </Tooltip>
              <Button size="small" variant="outline" disabled>拒绝（预览）</Button>
              <Button size="small" variant="outline" disabled>查看 diff（预览）</Button>
              <CliHint command="oc approval respond AR-9a02 --decision approve --channel im" label="等价 CLI" />
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            卡片动作写回审批链路并携带 IM 身份：绑定关系校验失败 → 拒绝（不做「先执行后补验证」）。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">敏感信息不落 IM（硬约束）</div>
          <div class="oc-stack" style="gap: 6px; font-size: 13px">
            <div class="oc-flex" style="gap: 6px"><OcIcon name="lock" size="14px" /><span>卡片只含摘要与引用：不含 diff 全文、密钥、明文提示词、文件内容。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="secured" size="14px" /><span>审批详情一律回到客户端内查看（IM 无「展开全文」入口，避免内容留在聊天记录）。</span></div>
            <div class="oc-flex" style="gap: 6px"><OcIcon name="error" size="14px" /><span>消息删除与撤回不影响审计：审批结果以服务端审计链为准（IM 只是通道）。</span></div>
          </div>
          <Alert theme="info" style="margin-top: 8px" message="如果 IM 平台侧开启了消息归档，卡片中的摘要会进入该平台的存储——这是企业 IM 策略的边界，需在采购/合规评审中确认。" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" variant="outline">/status：仅内核与连接状态</Tag>
            <Tag size="small" variant="outline">/cost：按权限返回（越权仅提示无权限）</Tag>
            <Switch :model-value="true" size="small" disabled /> 卡片脱敏（不可关闭）
          </div>
        </div>
      </div>
    </StateShell>

    <Dialog
      v-model:visible="bindingOpen"
      header="绑定 IM 身份（IM 账号 ↔ 平台账号）"
      width="520px"
      :confirm-btn="{ content: '确认绑定', theme: 'primary' }"
      cancel-btn="取消"
      @confirm="confirmBinding"
    >
      <div class="oc-stack">
        <Alert theme="info" message="绑定把 IM 账号与平台账号关联；绑定前该 IM 账号的一切执行类指令一律拒绝。" description="绑定码由控制台生成，6 位一次性、10 分钟有效；绑定关系记录审计，可随时解绑（解绑立即生效）。" />
        <InfoGrid :columns="1" :items="[
          { key: 'cmd', label: '目标指令', value: bindingTarget?.command ?? '—', mono: true },
          { key: 'platform', label: 'IM 平台', value: bindingTarget?.platform ?? '—' },
          { key: 'perm', label: '可获得权限', value: bindingTarget?.permission ?? '—' },
        ]" />
        <Input v-model="bindingCode" size="small" placeholder="输入 6 位一次性绑定码" maxlength="6" />
        <CliHint command="oc im binding create --platform feishu --ttl 10m" label="生成绑定码（等价 CLI）" />
      </div>
    </Dialog>
  </div>
</template>
