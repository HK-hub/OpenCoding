<script setup lang="ts">
/**
 * W-09 嵌入与索引设置：嵌入模型 + 渐进迁移 + IndexStore 切换 + 代码外发开关（默认禁用）。
 * 默认安全：代码外发到外部嵌入服务默认关闭，须企业显式开启并审计；air-gapped 强制本地嵌入（卷 11 §7）。
 * 溯源：卷 11 D-KB-2 / §7 / BUILD-MANIFEST W-09
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Progress, RadioGroup, RadioButton, Select, Switch, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import type { UiStateKind } from '@/stores/ui';
import { knowledgeData } from '@/mock/data/knowledge';
import { downloadJson } from '@/utils/download';

const ui = useUiStore();
const data = knowledgeData.knowledge;

const state = ref<UiStateKind>('LOADING');
const embedModel = ref('bge-m3（本地，v3）');
const store = ref('postgres');
const egress = ref(false);
const migrating = ref(true);

/** 迁移暂停时刻（安全点）：暂停后进度冻结、检索不受影响，可恢复续跑 */
const migratePausedAt = ref<string | null>(null);

/** 在安全点暂停迁移：进度冻结（已迁移块保持可检索），按钮切换为恢复 */
function pauseMigration() {
  migrating.value = false;
  migratePausedAt.value = new Date().toLocaleTimeString();
  MessagePlugin.warning(`已在安全点暂停迁移（进度冻结在 ${migrateProgress}%）：已迁移块保持可检索，恢复后从断点继续`);
}

/** 恢复迁移：从断点续跑 */
function resumeMigration() {
  migrating.value = true;
  migratePausedAt.value = null;
  MessagePlugin.success(`已从断点恢复迁移（${migrateProgress}% → 继续）`);
}

const egressBlocked = computed(() => store.value === 'postgres' && !egress.value);

const migrateProgress = 62;

const EMBED_OPTIONS = [
  { label: 'bge-m3（本地，v3）— 当前生效，零外发', value: 'bge-m3（本地，v3）' },
  { label: 'text-embedding-3-large（外部）— 需开启代码外发', value: 'text-embedding-3-large（外部）' },
  { label: 'jina-embeddings-v3（本地）— 备选，需重建', value: 'jina-embeddings-v3（本地）' },
];

const STORE_OPTIONS = [
  { key: 'postgres', label: 'PostgreSQL（全文 + 向量扩展 + 边表）', note: '默认：单栈运维、事务一致；单租户 ≤ 500 万块' },
  { key: 'engine', label: '专用检索引擎（OpenSearch 等）', note: '规模阈值触发（> 500 万块或 P95 超预算）' },
  { key: 'vector', label: '专用向量库', note: '向量规模阈值触发；需额外运维' },
];

const stateOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
];

function switchStore(next: string | number | boolean) {
  store.value = String(next);
  MessagePlugin.info(`IndexStore 切换为 ${String(next)}：接口不变（IndexStorePort），切换期间检索不中断`);
}

function enableEgress() {
  egress.value = true;
  MessagePlugin.warning('已开启代码外发：仅发送切分后的片段，域名白名单 + 审计开启（企业开关可强制禁用）');
}

/** 导出索引设置：模型 / IndexStore / 外发开关 / 迁移进度取自本页状态，知识源凭据仅导出引用名 */
function exportSettings() {
  const filename = `oc-index-settings-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
  downloadJson(
    {
      embeddingModel: embedModel.value,
      indexStore: store.value,
      codeEgressEnabled: egress.value,
      migration: { inProgress: migrating.value, progress: migrateProgress },
      sources: data.sources.map((s) => ({
        sourceId: s.sourceId,
        name: s.name,
        type: s.type,
        credentialRef: s.credentialRef,
        syncStatus: s.syncStatus,
        chunkCount: s.chunkCount,
      })),
    },
    filename,
  );
  MessagePlugin.success(`已导出索引设置（${filename}，不含凭据）`);
}

onMounted(() => {
  window.setTimeout(() => (state.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="嵌入与索引设置"
      desc="嵌入模型、索引存储与代码外发三项核心配置；换模型走渐进迁移（新旧索引并存），代码外发默认关闭。"
      volume="卷 11"
      manifest="W-09"
      cli="oc kb settings set embedding.model bge-m3"
      :status="[{ label: '代码外发默认禁用', theme: 'success' }, { label: migrating ? '迁移进行中' : migratePausedAt ? '迁移已暂停（安全点）' : '索引稳定', theme: migrating ? 'warning' : migratePausedAt ? 'danger' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportSettings">导出配置</Button>
        <Select :model-value="state" size="small" style="width: 120px" :options="stateOptions" @change="(v) => (state = v as UiStateKind)" />
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="当前嵌入模型" :value="embedModel.split('（')[0]" format="raw" icon="layers" hint="维度与存储版本随模型记录，换模型需重建" />
      <StatCard label="迁移进度" :value="migrating || migratePausedAt ? migrateProgress : 100" unit="%" icon="refresh" :hint="migratePausedAt ? '已在安全点暂停：已迁移块保持可检索，恢复后从断点继续' : '新旧索引并存：迁移期间两路检索均可用'" />
      <StatCard label="索引块" :value="data.sources.reduce((a, s) => a + s.chunkCount, 0)" unit="块" format="token" icon="database" hint="当前 IndexStore：PostgreSQL" />
      <StatCard label="嵌入成本（本月）" :value="18.42" unit="美元" format="cost" icon="discount" hint="嵌入调用计量并入预算口径" />
    </div>

    <StateShell
      :state="state"
      stage="加载索引设置…"
      empty-title="索引尚未初始化"
      empty-desc="首次接入知识源后会自动选择默认 IndexStore 与本地嵌入模型；也可在此手动配置。"
      empty-action="使用推荐配置"
      example-task="切换到本地 jina-embeddings-v3 并启动渐进迁移"
      what="索引设置加载失败"
      why="配置服务不可达或当前模型制品缺失（嵌入模型未下载）。"
      how="可重试；配置失败不影响既有索引检索，按上一次生效配置继续工作。"
      trace-id="trace-kset-93af20"
      @retry="state = 'NORMAL'"
      @empty-action="state = 'NORMAL'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            嵌入模型
            <Tag size="small" variant="outline">EmbeddingProviderSPI</Tag>
          </h3>
          <Select v-model="embedModel" :options="EMBED_OPTIONS" style="width: 100%" />
          <div class="oc-divider" />
          <div class="oc-flex--between">
            <span style="font-size: 13px">渐进迁移（新旧索引并存）</span>
            <Tag size="small" :theme="migrating ? 'warning' : migratePausedAt ? 'danger' : 'success'">{{ migrating ? `进行中 ${migrateProgress}%` : migratePausedAt ? `已暂停（安全点 ${migrateProgress}%）` : '已完成' }}</Tag>
          </div>
          <Progress :percentage="migrateProgress" theme="line" style="margin: 8px 0" />
          <div class="oc-muted" style="font-size: 12px">
            迁移策略：新块用新模型编码并双写；旧块后台重编码；检索时两路结果融合（带模型版本标注），迁移完成后回收旧索引。
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 10px">
            <Popconfirm content="迁移为长任务：可暂停（安全点）、可取消（保留已完成部分），检索不中断。" @confirm="MessagePlugin.success('已启动渐进迁移（后台任务）')">
              <Button size="small" theme="primary" variant="outline">启动 / 续跑迁移</Button>
            </Popconfirm>
            <Button size="small" variant="outline" @click="migrating ? pauseMigration() : resumeMigration()">{{ migrating ? '暂停迁移' : '恢复迁移' }}</Button>
            <CliHint command="oc kb index migrate --to bge-m3 --mode progressive" />
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            代码外发（默认禁用）
            <Tag size="small" :theme="egress ? 'warning' : 'success'" variant="light-outline">{{ egress ? '已开启（审计中）' : '已禁用' }}</Tag>
          </h3>
          <div class="oc-flex" style="gap: 10px; margin-bottom: 8px">
            <Switch v-model="egress" />
            <span style="font-size: 13px">
              {{ egress ? '外发已开启：仅发送切分后的片段，须白名单域名' : '外发已禁用：嵌入全部在本地完成，代码不出工作区' }}
            </span>
          </div>
          <div v-if="!egress" class="oc-flex" style="gap: 8px">
            <OcIcon name="lock" size="14px" color="var(--oc-sev-ok)" />
            <span class="oc-secondary" style="font-size: 12px">
              默认安全：air-gapped 部署强制本地嵌入，企业开关可永久禁用外发（界面仅展示，不可开启）。
            </span>
          </div>
          <Popconfirm
            theme="danger"
            content="开启后会把代码片段发送到外部嵌入服务；需确认驻留策略允许，并接受审计。"
            @confirm="enableEgress"
          >
            <Button size="small" theme="danger" variant="outline" style="margin-top: 10px">申请开启外发（需合规确认）</Button>
          </Popconfirm>
          <div class="oc-divider" />
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'residency', label: '驻留约束', value: 'mem-o-06：境内租户数据不得外发到区域外端点；当前外发开关受该策略约束' },
              { key: 'audit', label: '外发审计', value: '域名 / 字节数 / 调用方 / 命中片段哈希（正文不入日志）' },
              { key: 'cost', label: '成本口径', value: '嵌入调用逐次计量，计入租户预算（可设每日上限）' },
            ]"
          />
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          IndexStore 切换
          <span class="oc-muted" style="font-size: 12px">接口不变（IndexStorePort），配置切换不影响检索 API</span>
        </h3>
        <RadioGroup :model-value="store" @change="switchStore">
          <RadioButton v-for="s in STORE_OPTIONS" :key="s.key" :value="s.key">{{ s.label }}</RadioButton>
        </RadioGroup>
        <Table
          :data="STORE_OPTIONS"
          :columns="[
            { colKey: 'label', title: '存储后端', width: 380 },
            { colKey: 'note', title: '适用条件与代价', cell: 'cell' },
            { colKey: 'state', title: '当前', width: 100, cell: 'cell' },
          ]"
          row-key="key"
          size="small"
          style="margin-top: 10px"
        >
          <template #cell="{ col, row }">
            <template v-if="col.colKey === 'state'">
              <Tag size="small" :theme="store === row.key ? 'success' : 'default'">{{ store === row.key ? '生效中' : '未启用' }}</Tag>
            </template>
            <span v-else>{{ row[col.colKey] }}</span>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
          切换触发条件：单租户文档块 &gt; 500 万 或 检索 P95 超 300ms 预算时，建议切到专用检索引擎；切换期间新旧索引并存，检索不中断。
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 10px">
          <Tag size="small" variant="outline">向量维度与存储版本记录在索引元数据</Tag>
          <Tag v-if="egressBlocked" size="small" theme="success" variant="light-outline">本地嵌入 + 外发关闭（推荐组合）</Tag>
        </div>
      </div>
    </StateShell>
  </div>
</template>
