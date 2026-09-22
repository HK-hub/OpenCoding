<script setup lang="ts">
/**
 * 迁出中心（G2-02）：迁出目标五类（通用存档 / 其他 Coding Agent·Harness / 代码与产物 /
 * 知识与索引 / 审计与计量）+ 导出包真实生成下载 + 迁出检查清单（逐项说明）+
 * 脱敏开关（凭证永不导出）+ 导出历史。
 * 溯源：卷 29 / BUILD-MANIFEST G2-02。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, MessagePlugin, Popconfirm, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { enterpriseData, type ExportPackage } from '@/mock/data/enterprise';
import { downloadJson } from '@/utils/download';
import { useUiStore, type UiStateKind } from '@/stores/ui';

const ui = useUiStore();
const packages = enterpriseData.exportPackages;
const selectedId = ref(packages[0].id);
const selected = computed(() => packages.find((p) => p.id === selectedId.value) ?? packages[0]);

/** 脱敏开关：只影响内容字段；凭证（密钥/令牌/连接串）在任何模式下都不导出（硬约束） */
const redactOn = ref(true);
const loading = ref(true);
const limit = ref(4);
/** 导出前预检：审计类导出的哈希链校验结果（未通过即阻断导出，不输出不完整包） */
const chainVerified = ref(true);
const errorMsg = ref('');

/** 检查清单逐项说明：告诉用户「为什么勾这项」，而不是只给一句口号 */
const CHECKLIST_WHY: Record<string, string> = {
  '确认导出范围（项目/团队/全部）': '范围决定包体积与合规口径；跨项目导出要求具备对应读取权限。',
  '确认脱敏预览（凭证永不导出）': '导出前预览将被替换的字段；凭证字段在服务端被剥离，无法通过关闭开关绕过。',
  '校验 checksums': '包内逐文件哈希 + 清单签名，导入侧据此拒绝被篡改的包。',
  '在目标环境执行 oc import --verify': '先校验后写入，避免半成品数据进入目标环境。',
  '逐项确认工具绑定（需重配）': '工具绑定与本地环境相关，迁移后必须重配（不复制凭据）。',
  '确认对方支持的协议版本': '协议不匹配时导出仅保留语义（降级为 Markdown/JSON），不保证可执行。',
  '迁移后跑示例任务验证': '用真实示例任务验证「读 → 改 → 跑 → 测」闭环，作为迁出验收依据。',
  '确认 Git 远端可达': '代码本身无需迁移；只需保证远端可达与 LFS 对象已推送。',
  '确认 LFS 对象已推送': '未推送的大文件会导致克隆后缺对象（迁移后编译失败）。',
  '导出原始文档': '向量不可移植：先导出原始文档，目标侧重建立索引。',
  '导出索引元数据': '保留分块与标签，目标环境重建后可对齐召回质量。',
  '在目标环境重建索引（预计 8.4 分钟/仓）': '重建期间检索降级为关键词模式（显式标注，不静默）。',
  '确认脱敏预览（强制）': '审计导出默认脱敏，预览确认后才能生成文件。',
  '确认哈希链校验通过': '审计链连续性是合规前提；断链时导出会被阻断并提示修复。',
  '记录导出审计（谁导出、范围、格式）': '导出行为本身写入审计（含操作者、范围、格式与哈希）。',
};

type HistoryRow = { id: string; target: string; format: string; at: string; sizeMb: number; actor: string; result: string };

/** 导出历史（含负样本：一次因哈希链断链被阻断） */
const history = ref<HistoryRow[]>([
  { id: 'ex-2201', target: '通用存档（完整可复原）', format: '导出包', at: '2026-09-21T21:14:00+08:00', sizeMb: 1860, actor: '沈亦舟', result: 'SUCCEEDED' },
  { id: 'ex-2200', target: '审计与计量', format: 'CSV / Parquet', at: '2026-09-21T17:02:00+08:00', sizeMb: 168, actor: '秦越人', result: 'SUCCEEDED' },
  { id: 'ex-2199', target: '知识与索引', format: '原始文档 + 索引元数据', at: '2026-09-20T11:40:00+08:00', sizeMb: 4200, actor: '陆知微', result: 'SUCCEEDED' },
  { id: 'ex-2198', target: '其他 Coding Agent / Harness', format: '移植包', at: '2026-09-19T20:25:00+08:00', sizeMb: 240, actor: '顾清和', result: 'PARTIAL' },
  { id: 'ex-2197', target: '审计与计量', format: 'CSV', at: '2026-09-18T09:10:00+08:00', sizeMb: 0, actor: '柏一川', result: 'BLOCKED' },
  { id: 'ex-2196', target: '代码与产物', format: 'Git 引用', at: '2026-09-17T15:48:00+08:00', sizeMb: 0, actor: '施予安', result: 'SUCCEEDED' },
]);

const HISTORY_THEME: Record<string, 'success' | 'warning' | 'danger'> = { SUCCEEDED: 'success', PARTIAL: 'warning', BLOCKED: 'danger' };
const HISTORY_NOTE: Record<string, string> = {
  PARTIAL: '工具绑定未重配：目标侧需手工映射（已在包内标注）',
  BLOCKED: '审计哈希链断链：导出被阻断，修复后重试（不输出不完整包）',
};

const visibleHistory = computed(() => history.value.slice(0, limit.value));
const pageState = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (errorMsg.value) return 'ERROR';
  if (!history.value.length) return 'EMPTY';
  return history.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

/** 关闭脱敏需二次确认：说明影响面（内容字段原样），凭证仍不下发 */
function setRedact(on: boolean) {
  if (on) {
    redactOn.value = true;
    return;
  }
  redactOn.value = false;
  MessagePlugin.warning('已关闭内容脱敏：仅内容字段保持原样，凭证字段仍被服务端剥离（硬约束不可关闭）');
}

/** 真实生成导出包（下载 JSON）：审计类导出需哈希链校验通过，否则阻断（不输出不完整包） */
function exportPackage(pkg: ExportPackage) {
  if (pkg.id === 'exp-05' && !chainVerified.value) {
    errorMsg.value = '审计哈希链校验未通过：存在断链区间，导出被阻断（合规口径不允许输出不完整包）。';
    ui.track('eco.export.blocked', { target: pkg.target });
    return;
  }
  errorMsg.value = '';
  const payload = {
    packageId: `${pkg.id}-${history.value.length + 1}`,
    target: pkg.target,
    format: pkg.format,
    fidelity: pkg.fidelity,
    contains: pkg.contains,
    contentRedacted: redactOn.value,
    credentialsIncluded: false,
    checklist: pkg.checklist,
    note: pkg.note,
  };
  const name = downloadJson(payload, `oc-export-${pkg.id}.json`);
  history.value = [
    { id: `ex-${2202 + history.value.length}`, target: pkg.target, format: pkg.format, at: new Date().toISOString(), sizeMb: pkg.sizeMb, actor: '当前用户', result: 'SUCCEEDED' },
    ...history.value,
  ];
  ui.track('eco.export.generated', { target: pkg.target, redacted: redactOn.value });
  MessagePlugin.success(`已生成并下载 ${name}（凭证未包含：硬约束不可关闭）`);
}

onMounted(() => {
  window.setTimeout(() => {
    loading.value = false;
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="迁出中心"
      desc="数据归用户：五类迁出目标（通用存档 / 其他 Coding Agent·Harness / 代码与产物 / 知识与索引 / 审计与计量），导出前逐项确认检查清单；凭证永不导出，导出行为本身记审计。"
      volume="卷 29"
      manifest="G2-02"
      cli="oc export --target archive --format json --redact"
      :status="[{ label: '无需管理员审批（自有数据）', theme: 'success' }, { label: '凭证永不导出', theme: 'default' }]"
    >
      <template #actions>
        <div class="oc-flex" style="gap: 6px; align-items: center">
          <Popconfirm
            v-if="redactOn"
            content="关闭脱敏后内容字段（内网地址、人员标识等）将按原样导出；凭证字段在任何模式下都不导出。导出包会记录脱敏状态，导入侧可见。是否继续？"
            @confirm="setRedact(false)"
          >
            <Switch :model-value="redactOn" size="small" />
          </Popconfirm>
          <Switch v-else :model-value="redactOn" size="small" @change="setRedact(true)" />
          <span style="font-size: 13px">导出脱敏</span>
        </div>
        <Button size="small" theme="primary" @click="exportPackage(selected)">
          <OcIcon name="download" size="12px" /> 生成导出包
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="迁出目标" :value="packages.length" unit="类" icon="download" hint="每类可独立导出" />
      <StatCard label="导出历史" :value="history.length" unit="次" icon="history" hint="含 1 次被阻断（哈希链断链）" />
      <StatCard label="脱敏状态" :value="redactOn ? '已开启' : '仅内容字段原样'" format="raw" icon="secured" hint="凭证在任何模式下都不导出" />
      <StatCard label="最近包体积" :value="history[0].sizeMb" unit="MB" icon="layers" />
    </div>

    <StateShell
      :state="pageState"
      :collapsed-summary="`导出历史 ${history.length} 条，超过单次渲染阈值（4 条）已折叠。`"
      :page-size="4"
      stage="正在汇总可迁出内容与检查清单…"
      empty-title="暂无导出记录"
      empty-desc="还没有执行过迁出；任何用户对自己的数据都有完全处置权，无需管理员审批即可导出。"
      empty-action="生成第一份导出包"
      example-task="导出「通用存档」并在另一台机器上执行 oc import --verify 校验完整性"
      what="导出历史读取失败"
      why="导出账本不可读（审计投影缺失 ex-* 事件），或审计哈希链校验未通过。"
      how="可重试；导出功能本身不依赖账本，但审计类导出必须修复断链后才能生成包。"
      trace-id="trace-export-5be0d1"
      @retry="loading = false; errorMsg = ''"
      @load-more="limit += 4"
      @empty-action="exportPackage(packages[0])"
    >
      <Alert
        v-if="errorMsg"
        theme="error"
        :message="`事实：${errorMsg}`"
        description="原因：审计事件链存在断链区间（区间已定位，需管理员修复或从备份补齐）。动作：修复后重试；确需部分导出请改用「知识与索引」类目标（不含审计链）。"
        style="margin-bottom: 10px"
      />
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">迁出目标五类（点击选择）<CopyableId id="trace-export-5be0d1" label="复制 traceId" /></div>
          <div class="oc-stack" style="gap: 6px">
            <div
              v-for="p in packages"
              :key="p.id"
              class="oc-flex--between"
              style="gap: 8px; padding: 6px 8px; border: 1px solid var(--oc-border); border-radius: 6px; cursor: pointer"
              :style="p.id === selectedId ? { borderColor: 'var(--td-brand-color, #0052d9)' } : undefined"
              @click="selectedId = p.id"
            >
              <div class="oc-grow">
                <div class="oc-flex" style="gap: 6px">
                  <b style="font-size: 13px">{{ p.target }}</b>
                  <Tag size="small" :theme="p.fidelity === '高' || p.fidelity === '完整' ? 'success' : 'warning'" variant="light-outline">保真度 {{ p.fidelity }}</Tag>
                  <Tag v-if="p.requiresAdmin" size="small" theme="warning" variant="light-outline">需管理员审批</Tag>
                </div>
                <div class="oc-muted" style="font-size: 12px">{{ p.format }} · {{ p.note }}</div>
              </div>
              <Button size="small" variant="outline" @click.stop="exportPackage(p)">导出</Button>
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
            说明：代码与产物走标准 Git（无需迁移）；知识与索引的向量不可移植，需在目标侧重建。
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">迁出检查清单（逐项说明）· {{ selected.target }}</div>
          <InfoGrid :columns="1" :items="[
            { key: 'format', label: '包格式', value: selected.format },
            { key: 'contains', label: '包含内容', value: selected.contains.join('、') },
            { key: 'size', label: '最近包体积', value: `${selected.sizeMb} MB` },
            { key: 'last', label: '最近导出', value: new Date(selected.lastExportedAt).toLocaleString('zh-CN') },
          ]" />
          <div class="oc-stack" style="gap: 6px; margin-top: 8px">
            <div v-for="c in selected.checklist" :key="c" class="oc-flex" style="gap: 6px; font-size: 12px">
              <Tag size="small" theme="primary" variant="outline">清单</Tag>
              <span>{{ c }}</span>
              <span class="oc-muted">— {{ CHECKLIST_WHY[c] ?? '按向导提示逐项确认' }}</span>
            </div>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <CliHint :command="`oc export --target ${selected.id} --format json --redact=${redactOn}`" label="等价 CLI" />
            <Button size="small" theme="primary" @click="exportPackage(selected)">生成导出包（JSON）</Button>
          </div>
          <div class="oc-flex" style="gap: 8px; align-items: center; margin-top: 8px">
            <Switch v-model="chainVerified" size="small" />
            <span style="font-size: 12px">导出前预检：审计哈希链校验通过（关闭以观察审计类导出被阻断）</span>
          </div>
          <Alert
            v-if="!chainVerified"
            theme="warning"
            style="margin-top: 6px"
            message="哈希链校验未通过：审计与计量类导出会被阻断（合规口径不允许输出不完整包）。"
            description="已定位断链区间；修复或从备份补齐后重新校验即可恢复（其他迁出目标不受影响）。"
          />
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">脱敏开关的影响（凭证永不导出）</div>
          <Alert
            :theme="redactOn ? 'info' : 'warning'"
            :message="redactOn ? '导出脱敏已开启：内容字段按规则替换（如内网地址、人员标识）。' : '导出脱敏已关闭：仅内容字段保持原样，凭证字段仍被服务端剥离。'"
            description="凭证（密钥 / 令牌 / 连接串 / 密码）在任何模式下都不进入导出包；包内仅保留引用名（如 secret://model/anthropic-prod），目标环境需重新授权。"
          />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Tag size="small" theme="success" variant="light-outline">密钥：剥离</Tag>
            <Tag size="small" theme="success" variant="light-outline">令牌：剥离</Tag>
            <Tag size="small" theme="success" variant="light-outline">连接串：剥离</Tag>
            <Tag size="small" theme="warning" variant="light-outline">内容字段：{{ redactOn ? '替换' : '原样' }}</Tag>
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">导出历史（目标 / 时间 / 体积 / 操作者 / 结果）</div>
          <Table :data="visibleHistory" row-key="id" size="small" :columns="[
            { colKey: 'target', title: '迁出目标', ellipsis: true },
            { colKey: 'at', title: '时间', width: 170, cell: 'at' },
            { colKey: 'sizeMb', title: '体积', width: 90, cell: 'size' },
            { colKey: 'actor', title: '操作者', width: 100 },
            { colKey: 'result', title: '结果', width: 120, cell: 'result' },
          ]" table-layout="fixed">
            <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
            <template #size="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.sizeMb ? `${row.sizeMb} MB` : '引用' }}</span></template>
            <template #result="{ row }">
              <Tooltip :content="HISTORY_NOTE[row.result] ?? '按检查清单完成全部前置确认'">
                <Tag size="small" :theme="HISTORY_THEME[row.result] ?? 'default'" variant="light-outline">{{ row.result }}</Tag>
              </Tooltip>
            </template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">展示 {{ visibleHistory.length }} / {{ history.length }} 条；被阻断的导出不会产生不完整包。</div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
