<script setup lang="ts">
/**
 * 导入导出与复现包（S-17 / 卷 19 §导入导出中心 Z-07）：
 * 中立包结构预览（manifest/events/workitems/memory/artifacts/workspace-refs/checksums）+ 哈希校验状态
 * + 部分导入 + 引用缺失报告 + 复现包校验 + 导入前快照与失败自动回滚（不留半成品）。
 * 包内不携带凭证与绝对路径（脱敏与路径归一化在导出侧完成）。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Checkbox, MessagePlugin, Popconfirm, Progress, RadioGroup, RadioButton, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { makeError, type MockError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

type SectionKey = 'manifest' | 'events' | 'workitems' | 'memory' | 'artifacts' | 'workspace' | 'checksums';
interface PackageEntry {
  key: SectionKey;
  path: string;
  size: string;
  sha256: string;
  hashOk: boolean;
  desc: string;
}

/** 中立导出包结构（导出侧生成；导入侧可部分选取，未选取部分保持本地现状） */
const entries: PackageEntry[] = [
  { key: 'manifest', path: 'manifest.json', size: '4.2 KB', sha256: '7c1ad9f0', hashOk: true, desc: '包格式版本、会话元数据、导出范围与脱敏声明' },
  { key: 'events', path: 'events.jsonl', size: '18.6 MB', sha256: '41ab77e3', hashOk: true, desc: 'durable 事件流（按 seq 升序，含审批与工具审计）' },
  { key: 'workitems', path: 'workitems.json', size: '842 KB', sha256: 'b90e4421', hashOk: true, desc: '任务/计划/验收标准与状态（层级结构保留）' },
  { key: 'memory', path: 'memory/', size: '126 KB', sha256: 'd1c0a55f', hashOk: true, desc: '记忆条目（四层）与授权记忆；R4/R5 相关不落包' },
  { key: 'artifacts', path: 'artifacts/index.json', size: '2.1 MB', sha256: '9f2102cc', hashOk: false, desc: '工件索引与引用（大对象按引用导出，可缺省）' },
  { key: 'workspace', path: 'workspace-refs.json', size: '18 KB', sha256: 'e77b1a04', hashOk: true, desc: '工作区引用（相对路径 + 提交哈希），不含绝对路径与凭证' },
  { key: 'checksums', path: 'checksums.txt', size: '1.1 KB', sha256: '3d9f77aa', hashOk: true, desc: '全包校验和清单（导入前校验，失败即拒绝）' },
];

const phase = ref<'LOADING' | 'NORMAL'>('LOADING');
const failure = ref<MockError | null>(null);
const mode = ref<'export' | 'import'>('export');
const selected = ref<Record<SectionKey, boolean>>({ manifest: true, events: true, workitems: true, memory: true, artifacts: false, workspace: true, checksums: true });
const importing = ref(false);
const progress = ref(0);
const importFailed = ref(false);
const rollbackDone = ref(false);
const verifying = ref(false);
const verifyResult = ref<{ ok: boolean; at: string } | null>(null);
const pageSize = ref(6);

const missingRefs = [
  { ref: 'artifact://media/sha256:9f21c0…（回执幂等时序图.png）', reason: '大对象未随包导出（按引用导出策略）', fix: '从源工作区补包，或接受「图片缺失」继续导入' },
  { ref: 'repo://payment-core@7f4c1a2（工作树快照）', reason: '目标环境未检出该提交', fix: '导入后执行 `oc git fetch && oc git checkout 7f4c1a2` 再校验' },
  { ref: 'secret://prod/payment/db-password', reason: '凭证永不入包（安全约束）', fix: '导入后在密钥服务重新绑定引用（必须人工确认）' },
];

const hashOkCount = computed(() => entries.filter((e) => e.hashOk).length);
const selectedCount = computed(() => Object.values(selected.value).filter(Boolean).length);
const edge = computed(() => entries.length > pageSize.value);

const shellState = computed(() => {
  if (ui.connection !== 'CONNECTED') return 'OFFLINE' as const;
  if (failure.value) return 'ERROR' as const;
  if (phase.value === 'LOADING') return 'LOADING' as const;
  return entries.length ? (edge.value ? ('EDGE_DATA' as const) : ('NORMAL' as const)) : ('EMPTY' as const);
});

function toggle(key: SectionKey, v: unknown) {
  selected.value = { ...selected.value, [key]: Boolean(v) };
}

/** 复现包校验：三要素（包版本 / 策略版本 / 模型清单）+ 校验和，失败即拒绝导入 */
function verify() {
  verifying.value = true;
  window.setTimeout(() => {
    verifying.value = false;
    verifyResult.value = { ok: true, at: new Date().toISOString() };
    MessagePlugin.success('复现包校验通过：checksums 与 manifest 一致；策略版本 policy.org@v12 可解析；模型清单完整');
  }, 800);
}

let importTimer: number | null = null;

/** 部分导入：先拍快照，失败自动回滚到快照（不留半成品） */
function runImport() {
  importing.value = true;
  progress.value = 0;
  rollbackDone.value = false;
  importTimer = window.setInterval(() => {
    progress.value = Math.min(100, progress.value + 14);
    if (progress.value >= 100) {
      if (importTimer !== null) window.clearInterval(importTimer);
      importTimer = null;
      importing.value = false;
      if (importFailed.value) {
        rollbackDone.value = true;
        MessagePlugin.error('导入失败：checksums 第 3 项不匹配（artifacts/index.json）；已自动回滚到导入前快照 snap-pre-import');
        return;
      }
      MessagePlugin.success(`已导入 ${selectedCount.value} 个分区；引用缺失 ${missingRefs.length} 项已标注，未静默跳过`);
    }
  }, 160);
}

/** 取消导入：终止进度并回滚到导入前快照（未提交写入全部丢弃，不产生半成品） */
function cancelImport() {
  if (!importing.value) {
    MessagePlugin.warning('当前没有进行中的导入；「取消」用于终止正在导入的包并回滚到快照 snap-pre-import');
    return;
  }
  if (importTimer !== null) {
    window.clearInterval(importTimer);
    importTimer = null;
  }
  importing.value = false;
  rollbackDone.value = true;
  MessagePlugin.success(`已取消导入并回滚到快照 snap-pre-import：已选 ${selectedCount.value} 个分区未提交，本地数据与投影位点均未变化`);
}

onMounted(() => {
  window.setTimeout(() => (phase.value = 'NORMAL'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="导入导出与复现包"
      desc="中立导出包结构预览、哈希校验、部分导入、引用缺失报告与复现包校验；导入前先拍快照，失败自动回滚，绝不静默跳过内容。"
      volume="卷 19"
      manifest="S-17"
      cli="oc session export --session <id> --format neutral | oc session import <pkg> --verify --partial"
      :status="[
        { label: `哈希一致 ${hashOkCount}/${entries.length}`, theme: hashOkCount === entries.length ? 'success' : 'warning' },
        { label: '凭证不入包', theme: 'danger' },
      ]"
    >
      <template #actions>
        <Tooltip content="用于自审六态：注入一次包读取失败">
          <Button size="small" variant="text" @click="failure = makeError('NOT_FOUND', 'package index')">模拟异常</Button>
        </Tooltip>
        <RadioGroup v-model="mode" variant="default-filled" size="small">
          <RadioButton value="export">导出</RadioButton>
          <RadioButton value="import">导入</RadioButton>
        </RadioGroup>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="包大小（合计）" :value="'22.9 MB'" format="raw" icon="file" />
      <StatCard label="分区" :value="entries.length" unit="个" format="raw" icon="layers" />
      <StatCard label="引用缺失" :value="missingRefs.length" unit="项" format="raw" icon="link" hint="缺失项在导入报告中显式列出，不静默跳过" />
      <StatCard label="校验和" :value="hashOkCount === entries.length ? '一致' : '1 项不一致'" format="raw" icon="check" />
    </div>

    <StateShell
      :state="shellState"
      stage="正在读取包索引与校验和清单…"
      cancellable
      empty-title="尚未选择要导入的包"
      empty-desc="可从导出目录或对象存储选择中立包；导入前会先做校验和与三要素校验。"
      empty-action="选择包文件"
      what="包索引读取失败"
      :why="failure?.message ?? ''"
      how="可重试；若批次已过期，请重新导出（导出与导入都可断点续接）。"
      :trace-id="failure?.traceId ?? ''"
      :collapsed-summary="`包内条目 ${entries.length} 项，已折叠展示前 ${pageSize} 项`"
      :page-size="pageSize"
      :disabled-capabilities="['部分导入', '复现包校验']"
      @retry="failure = null; ui.simulateReconnect()"
      @load-more="pageSize += 6"
      @empty-action="mode = 'export'"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <h3 class="oc-card__title">
            中立包结构
            <Tag size="small" variant="outline">脱敏：无凭证 / 无绝对路径 / 无内部地址</Tag>
          </h3>
          <div class="oc-stack" style="gap: 6px">
            <div v-for="e in entries.slice(0, pageSize)" :key="e.key" class="oc-flex--between oc-flex--wrap" style="gap: 6px">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; min-width: 0">
                <OcIcon :name="e.hashOk ? 'check' : 'error'" size="13px" :color="e.hashOk ? 'var(--oc-sev-ok)' : 'var(--oc-sev-error)'" />
                <span class="oc-mono" style="font-size: 12px">{{ e.path }}</span>
                <span class="oc-muted" style="font-size: 11px">{{ e.size }}</span>
                <CopyableId :id="`sha256:${e.sha256}`" label="复制校验和" />
                <Checkbox v-if="mode === 'import'" :checked="selected[e.key]" size="small" @change="(v) => toggle(e.key, v)">
                  <span style="font-size: 12px">导入</span>
                </Checkbox>
              </div>
              <span class="oc-secondary oc-truncate" style="font-size: 11px; max-width: 320px">{{ e.desc }}</span>
            </div>
            <div v-if="!entries.every((e) => e.hashOk)" class="oc-muted" style="font-size: 11px">
              哈希不一致项：{{ entries.filter((e) => !e.hashOk).map((e) => e.path).join(' / ') }}（导入前必须修复，否则拒绝整包）
            </div>
          </div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <h3 class="oc-card__title">复现包校验</h3>
            <Progress v-if="verifying" :percentage="100" :stroke-width="4" status="active" label="正在校验 checksums 与三要素…" />
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'pkg', label: '包格式版本', value: 'neutral-package@v3（向后兼容 v2 只读）' },
                { key: 'policy', label: '策略版本快照', value: 'policy.org@v12（可重放决策）' },
                { key: 'models', label: '模型清单', value: 'claude-sonnet-4.5 / gpt-5.1 / text-embedding-3-large（哈希已记录）' },
                { key: 'checksum', label: '校验和验证', value: verifyResult ? `通过（${new Date(verifyResult.at).toLocaleTimeString('zh-CN')}）` : '未校验' },
              ]"
            />
            <div class="oc-flex" style="gap: 8px; margin-top: 8px">
              <Button size="small" theme="primary" variant="outline" :loading="verifying" @click="verify">校验复现包</Button>
              <span class="oc-muted" style="font-size: 11px">校验失败即拒绝导入（不产生半成品数据）。</span>
            </div>
          </div>

          <div class="oc-card">
            <h3 class="oc-card__title">引用缺失报告（不静默跳过）</h3>
            <div class="oc-stack" style="gap: 6px">
              <div v-for="m in missingRefs" :key="m.ref" class="oc-card" style="padding: 8px 10px">
                <div class="oc-mono" style="font-size: 12px">{{ m.ref }}</div>
                <div class="oc-secondary" style="font-size: 12px">原因：{{ m.reason }}</div>
                <div class="oc-muted" style="font-size: 11px">修复：{{ m.fix }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          部分导入与失败回滚
          <Tag size="small" variant="outline">导入前快照 → 失败自动回滚</Tag>
        </h3>
        <div class="oc-stack" style="gap: 8px">
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; font-size: 12px">
            <Tag size="small" variant="outline">已选 {{ selectedCount }}/{{ entries.length }} 个分区</Tag>
            <span class="oc-secondary">未选取的分区保持本地现状（不覆盖、不删除）；已选取但引用缺失的条目会在报告中列出。</span>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Checkbox :checked="importFailed" size="small" @change="(v) => (importFailed = Boolean(v))">模拟导入失败（用于演示自动回滚）</Checkbox>
            <span class="oc-muted" style="font-size: 11px">导入前快照：snap-pre-import（可用于手动回滚，保留 7 天）</span>
          </div>
          <Progress v-if="importing" :percentage="progress" :stroke-width="4" :label="`正在导入… ${progress}%（可取消：取消即回滚到快照）`" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Button theme="primary" :loading="importing" @click="runImport">开始部分导入</Button>
            <Popconfirm
              content="取消本次部分导入并回滚到导入前快照 snap-pre-import：已选分区的未提交写入与投影位点全部丢弃，不会留下半成品；回滚后可再次发起导入。"
              @confirm="cancelImport"
            >
              <Button variant="text">取消（回滚到快照）</Button>
            </Popconfirm>
            <Button v-if="importFailed" theme="warning" variant="outline" :disabled="!rollbackDone" @click="rollbackDone = false">清理回滚现场</Button>
          </div>
          <div v-if="rollbackDone" class="oc-flex" style="gap: 6px">
            <OcIcon name="history" size="13px" color="var(--oc-sev-warn)" />
            <span class="oc-secondary" style="font-size: 12px">已回滚到导入前快照：本地数据与投影位点均未变化（校验和失败项已记录，供包作者修复）。</span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
