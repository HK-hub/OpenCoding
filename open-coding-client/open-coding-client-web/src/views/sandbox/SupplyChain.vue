<script setup lang="ts">
/**
 * 供应链安全（B-12 / 卷 07 D-SBOX-10）：四类制品检查（依赖 / 镜像 / 插件与技能 / 模型制品）+ 失败动作；
 * 锁文件强制与依赖差异审计、来源校验（私有 registry 优先）、安装后扫描、air-gapped 离线仓库开关与「强制扫描」。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { toolData } from '@/mock/data/tool';
import { makeError } from '@/mock/runtime';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const { supplyChain } = toolData;
const policy = supplyChain.policy;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA'>('LOADING');
const pageSize = ref(4); const airGapped = ref(policy.airGapped);
const scanning = ref(false); const scanProgress = ref(0); const scanNote = ref('尚未执行强制扫描：最近一次安装后扫描见下方命中样例（含 1 处已知漏洞）');
const err = ref(makeError('DEPENDENCY_UNAVAILABLE', '私仓制品库不可达（离线镜像源未连通）'));

/** 四类制品的检查项清单与失败动作（每类含至少 1 条失败样本，用于演示阻断分支） */
const ARTIFACT_TYPES = [
  { id: 'dep', name: '依赖制品', scope: 'npm / pnpm / pip 依赖树', failure: '阻断构建（依赖不落盘）', items: [
    { text: '清单与锁文件一致（--frozen-lockfile）', pass: true, detail: 'pnpm-lock.yaml 与 package.json 一致，禁止隐式升级' },
    { text: '来源校验：私有 registry 优先', pass: true, detail: 'npm.yunshu.io 命中私仓；公共源需签名校验通过' },
    { text: '安装后扫描 + 脚本审计', pass: false, detail: 'lodash@4.17.20 命中 CVE-2020-8203；pip 未用锁文件已被阻断（SC-8005）' } ] },
  { id: 'image', name: '镜像制品', scope: '沙箱基础镜像 / 执行节点镜像', failure: '拒绝拉取（不留本地副本）', items: [
    { text: '摘要固定（digest 锁定，不用浮动 tag）', pass: true, detail: 'oc/base-node:22.8.0@sha256:3f9c… 与清单一致' },
    { text: '来源与签名校验', pass: true, detail: '私仓镜像签名校验通过，构建流水线可追溯到提交' },
    { text: '镜像层漏洞扫描', pass: false, detail: 'oc/harness-runner:0.9.3 摘要与声明不符 → 拒绝拉取（PLN-2003）' } ] },
  { id: 'plugin', name: '插件与技能', scope: '插件 / 技能 / 钩子包', failure: '拒绝装载并下架（含已安装实例）', items: [
    { text: '能力声明与实际调用一致', pass: true, detail: '清单声明 process:execute 的插件才允许调用 run_command' },
    { text: '签名校验', pass: false, detail: 'oc-community-lint@0.3.0 未签名 + postinstall 请求网络 → 拒绝装载并下架（SEC-7003）' },
    { text: '钩子顺序合规（改写先于脱敏与裁剪）', pass: false, detail: 'hook oc/format-on-edit@1.2 改写晚于结果处理 → 标记违规（SEC-7012）' } ] },
  { id: 'model', name: '模型制品', scope: '自托管模型 / 量化与转换产物', failure: '拒绝启用（保持上一可用版本）', items: [
    { text: '来源限定私有制品库', pass: false, detail: 'ocr-model-v1 来自公共托管 → 拒绝启用（仅允许私仓 + 许可白名单）' },
    { text: '制品哈希固定（不可变引用）', pass: true, detail: '模型引用带 sha256 前缀，禁止按名称漂移' },
    { text: '量化 / 转换过程可复现', pass: true, detail: '转换脚本与随机种子入库，可复跑得到同一哈希' } ] },
];

const records = computed(() => supplyChain.records);
const shown = computed(() => records.value.slice(0, pageSize.value));
const vulnRecords = computed(() => records.value.filter((r) => r.scanResult === '已知漏洞')); const scriptFindings = computed(() => records.value.flatMap((r) => r.findings.filter((f) => f.includes('脚本'))));
const sigFailures = computed(() => records.value.filter((r) => !r.signatureVerified).length); const lockfileChanges = computed(() => records.value.filter((r) => r.lockfileChanged).length);

/** 强制扫描进度定时器句柄（完成与卸载都要清理） */
let scanTimer: number | null = null;
/** 强制扫描：进度推进后更新结果（复检全部安装记录，生成新的审计结论） */
function forceScan() {
  if (scanning.value) return;
  scanning.value = true; scanProgress.value = 20; scanNote.value = '扫描中：解析锁文件与制品来源…';
  scanTimer = window.setInterval(() => {
    scanProgress.value = Math.min(100, scanProgress.value + 20);
    if (scanProgress.value >= 100) {
      // 完成即停表并置空句柄，避免卸载钩子重复清理
      if (scanTimer !== null) window.clearInterval(scanTimer);
      scanTimer = null;
      scanning.value = false;
      scanNote.value = `复检完成：${records.value.length} 条安装记录；已知漏洞 ${vulnRecords.value.length} 处（CVE-2020-8203）、可疑脚本 ${scriptFindings.value.length} 处，签名失败 ${sigFailures.value} 条 → 已生成审计结论并保持「拒绝优先」处置`;
    }
  }, 240);
}

function onAirgap(value: unknown) {
  airGapped.value = Boolean(value);
  MessagePlugin.warning(airGapped.value
    ? '已启用 air-gapped：依赖与镜像仅允许私有离线仓库，公网源与未镜像制品一律拒绝（生效范围见卡片标注）'
    : '已关闭 air-gapped：恢复公网源可达，来源校验 + 安装后扫描继续生效（次优路径，已显式标注）');
}
function refresh() {
  state.value = 'LOADING';
  window.setTimeout(() => { state.value = records.value.length === 0 ? 'EMPTY' : records.value.length > pageSize.value ? 'EDGE_DATA' : 'NORMAL'; }, 240);
}
onMounted(() => {
  refresh();
  ui.setViewState({ state: 'NORMAL' });
});
onUnmounted(() => {
  // 离开页面时清理进度定时器：避免残留无归属定时器继续推进已卸载组件的状态
  if (scanTimer !== null) window.clearInterval(scanTimer);
  scanTimer = null;
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="供应链安全"
      desc="四道闸：锁文件强制（拒绝隐式升级）→ 来源校验（私有 registry 优先 + 签名）→ 安装后扫描（漏洞与可疑脚本）→ air-gapped 离线仓库（公网源全拒）。检查失败一律阻断并标注失败动作。"
      volume="卷 07" manifest="B-12" cli="oc sandbox supply-chain audit --lockfile --scan && oc sandbox supply-chain scan --force"
      :status="[{ label: `锁文件强制 ${policy.lockfileEnforced ? '开启' : '关闭'}`, theme: policy.lockfileEnforced ? 'success' : 'danger' }, { label: `air-gapped ${airGapped ? '已启用' : '未启用（次优路径）'}`, theme: airGapped ? 'success' : 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="state = 'ERROR'">演示异常态</Button>
        <Button size="small" theme="primary" :loading="scanning" @click="forceScan">强制扫描</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="安装记录（24h）" :value="records.length" format="raw" icon="git" hint="覆盖 pnpm / npm / pip 与全局安装" />
      <StatCard label="已知漏洞" :value="vulnRecords.length" format="raw" icon="bug" hint="CVE-2020-8203（lodash 原型污染）→ 建议升级 4.17.21" />
      <StatCard label="可疑脚本命中" :value="scriptFindings.length" format="raw" icon="code" hint="postinstall 请求网络 / 未签名包脚本" />
      <StatCard label="锁文件变更" :value="lockfileChanges" format="raw" icon="file" :hint="`签名失败 ${sigFailures} 条（未签名一律拒绝装载）`" />
    </div>

    <StateShell
      :state="state" empty-title="没有安装与扫描记录" empty-desc="近 24h 无依赖安装（空记录不等于无防护：锁文件强制与来源校验仍对每次安装生效）。"
      empty-action="重新拉取供应链记录" example-task="执行 pip install requests==2.31.0，验证「未使用锁文件」被阻断（ORG-S1）"
      :what="'供应链记录加载失败'" :why="err.message" how="失败时保持上次扫描快照（fail-safe）：新安装请求按「拒绝优先」处理，不会因读取失败而放行。"
      :trace-id="err.traceId" :collapsed-summary="`安装记录共 ${records.length} 条，已折叠展示前 ${pageSize} 条`" :page-size="pageSize"
      @retry="refresh" @load-more="pageSize = records.length" @empty-action="refresh()"
    >
      <div class="oc-flex oc-flex--wrap">
        <span class="oc-flex" style="gap: 8px">
          <Switch :value="airGapped" size="small" aria-label="air-gapped 离线仓库开关" @change="onAirgap" /><b style="font-size: 13px">air-gapped 离线仓库</b>
          <Tag size="small" variant="light-outline" :theme="airGapped ? 'success' : 'warning'">{{ airGapped ? '已启用 · 公网源全拒' : '未启用 · 公网源可达（次优路径）' }}</Tag>
        </span>
        <Tooltip content="开启后：依赖与镜像仅允许私有离线仓库；未镜像制品、公网源请求与匿名脚本一律拒绝（拒绝原因写入审计）。关闭状态标注为次优路径，靠来源校验 + 安装后扫描兜底。"><span class="oc-secondary" style="font-size: 12px">开启后仅解析私有离线仓库；关闭为次优路径（已显式标注，不静默降级）。</span></Tooltip>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 10px"><div v-for="t in ARTIFACT_TYPES" :key="t.id" class="oc-card">
          <div class="oc-card__title">
            <span class="oc-flex oc-flex--wrap" style="gap: 6px">
              <b>{{ t.name }}</b><Tag size="small" variant="light-outline">{{ t.scope }}</Tag>
              <Tag size="small" variant="light-outline" :theme="t.items.some((i) => !i.pass) ? 'warning' : 'success'">{{ t.items.filter((i) => !i.pass).length }} 项待整改</Tag>
            </span>
            <Tag size="small" variant="light-outline" theme="danger">失败动作：{{ t.failure }}</Tag>
          </div>
          <div v-for="i in t.items" :key="i.text" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
            <Tag size="small" variant="light-outline" :theme="i.pass ? 'success' : 'danger'">{{ i.pass ? '通过' : '失败' }}</Tag>
            <span style="font-size: 13px">{{ i.text }}</span><Tooltip :content="i.detail"><span class="oc-muted" style="font-size: 11px">依据</span></Tooltip>
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px"><div class="oc-card__title">
          锁文件强制与依赖差异审计
          <CopyableId id="policy://ORG-S1/lockfile-enforced" label="复制策略引用" />
        </div>
        <Table
          row-key="recordId" size="small" :data="shown"
          :columns="[
            { colKey: 'recordId', title: '记录', width: 100 }, { colKey: 'at', title: '时间', width: 170 }, { colKey: 'command', title: '命令', width: 240 },
            { colKey: 'deps', title: '依赖差异（新增 / 移除）', ellipsis: true }, { colKey: 'lockfileChanged', title: '锁文件', width: 110 },
            { colKey: 'source', title: '来源 / 签名', ellipsis: true }, { colKey: 'scanResult', title: '扫描结论', width: 110 },
          ]"
        >
          <template #at="{ row }">{{ new Date(row.at).toLocaleString('zh-CN') }}</template>
          <template #command="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.command }}</span></template>
          <template #deps="{ row }">
            <span style="font-size: 12px">新增：{{ row.addedDeps.join('、') || '—' }}</span><span class="oc-muted" style="font-size: 12px; margin-left: 8px">移除：{{ row.removedDeps.join('、') || '—' }}</span>
            <div v-if="row.findings.length" class="oc-muted" style="font-size: 11px">审计：{{ row.findings.join('；') }}</div>
          </template>
          <template #lockfileChanged="{ row }"><Tag size="small" variant="light-outline" :theme="row.lockfileChanged ? 'primary' : 'default'">{{ row.lockfileChanged ? '已更新' : '无变更' }}</Tag></template>
          <template #source="{ row }">
            <span style="font-size: 12px">{{ row.source }}</span><Tag size="small" variant="light-outline" :theme="row.signatureVerified ? 'success' : 'danger'" style="margin-left: 4px">{{ row.signatureVerified ? '签名通过' : '未签名' }}</Tag>
          </template>
          <template #scanResult="{ row }"><Tag size="small" variant="light-outline" :theme="row.scanResult === '通过' ? 'success' : row.scanResult === '可疑' ? 'warning' : 'danger'">{{ row.scanResult }}</Tag></template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px"><div class="oc-card">
          <div class="oc-card__title">安装后扫描结果</div>
          <InfoGrid :columns="1" :items="[
              { key: 'vuln', label: '已知漏洞数', value: `${vulnRecords.length} 处`, tag: { text: vulnRecords.length ? '需处置' : '无', theme: vulnRecords.length ? 'danger' : 'success' } }, { key: 'script', label: '可疑脚本数', value: `${scriptFindings.length} 处`, tag: { text: scriptFindings.length ? '需复核' : '无', theme: scriptFindings.length ? 'warning' : 'success' } },
              { key: 'sample', label: '命中样例（漏洞）', value: 'lodash@4.17.20 · CVE-2020-8203 原型污染（严重度 高）→ 建议升级至 4.17.21（SC-8003）' },
              { key: 'sample2', label: '命中样例（脚本）', value: 'oc-community-lint@0.3.0 postinstall 请求网络（与声明能力不符）→ 拒绝装载并下架（SC-8006）' },
            ]"
          />
        </div>
        <div class="oc-card">
          <div class="oc-card__title">强制扫描（进度 + 结果更新）</div>
          <Progress :percentage="scanProgress" theme="line" :status="scanning ? 'active' : scanProgress >= 100 ? 'success' : 'warning'" />
          <div class="oc-secondary" style="font-size: 12px; margin-top: 8px">{{ scanNote }}</div>
          <div class="oc-flex" style="gap: 8px; margin-top: 10px">
            <Button size="small" variant="outline" :loading="scanning" @click="forceScan">重新扫描</Button>
            <span class="oc-muted" style="font-size: 12px">扫描为只读动作（不修改制品）；结论差异会生成新的审计条目。</span>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
