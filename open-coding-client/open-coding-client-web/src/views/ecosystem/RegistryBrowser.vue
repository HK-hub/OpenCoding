<script setup lang="ts">
/**
 * Registry 浏览器（G2-03）：搜索 + 标签过滤 + 兼容性过滤；结果卡展示名称/描述/标签/版本/签名/
 * 评分/安装量/兼容矩阵；安装前弹确认（权限与资源声明 + 来源 + 签名状态）；支持举报；空态给引导。
 * 溯源：卷 29 / BUILD-MANIFEST G2-03。
 */
import { computed, onMounted, ref } from 'vue';
import { Alert, Button, Dialog, Input, MessagePlugin, Select, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore, type UiStateKind } from '@/stores/ui';

const ui = useUiStore();

/** 当前内核/协议环境：兼容性过滤按此断言（不满足即拒绝安装，不做静默降级） */
const KERNEL = '2.9.x';
const PROTOCOL = 'v1';

type SigState = 'verified' | 'unsigned' | 'invalid';

interface RegistryItem {
  id: string;
  name: string;
  desc: string;
  kind: '技能' | '插件' | 'MCP 服务';
  tags: string[];
  version: string;
  signature: SigState;
  rating: number;
  installs: number;
  kernel: string;
  source: string;
  permissions: string[];
  resources: string[];
  author: string;
}

/** Registry 条目（含负样本：签名失败、内核不兼容、公共源未验证） */
const ITEMS: RegistryItem[] = [
  { id: 'refactor-kit', name: 'refactor-kit 重构套件', desc: '安全重构：重命名 / 抽取 / 内联，改完自动跑单测并给出回滚点', kind: '技能', tags: ['重构', 'Java', '安全'], version: '2.4.1', signature: 'verified', rating: 4.8, installs: 12840, kernel: '2.8.x–2.9.x', source: '组织私仓（已签名）', permissions: ['workspace.read', 'file.edit(受限：src/**)', 'shell.exec(mvn test*)'], resources: ['内存 ≤512MB', 'CPU ≤2 核', '无网络外发'], author: '平台工程组' },
  { id: 'com.acme.k8s-ops', name: 'K8s 运维扩展', desc: '集群巡检面板 + 策略规则 + 事件订阅模板（企业常用）', kind: '插件', tags: ['运维', 'K8s', '面板'], version: '2.3.1', signature: 'verified', rating: 4.6, installs: 5210, kernel: '2.9.x', source: '组织私仓（已签名）', permissions: ['network.egress(api.acme.internal)', 'ui.panel', 'tool.provider'], resources: ['进程外宿主', '内存 ≤1GB', '审计：全量工具调用'], author: 'Acme 平台组' },
  { id: 'dockerfile-opt', name: 'Dockerfile 优化', desc: '镜像层级与缓存优化建议；只读分析 + 建议补丁', kind: '技能', tags: ['容器', '构建'], version: '1.4.0', signature: 'verified', rating: 4.5, installs: 9420, kernel: '2.7.x–2.9.x', source: '公共市场（企业默认关闭）', permissions: ['workspace.read', 'file.edit(受限：**/Dockerfile)'], resources: ['无网络外发', '证据：diff 补丁'], author: '社区（已签名）' },
  { id: 'sql-audit', name: 'SQL 变更审计', desc: '变更前后对比 + 无索引扫描告警 + 回滚脚本生成', kind: '技能', tags: ['数据库', '审计'], version: '3.0.2', signature: 'verified', rating: 4.7, installs: 7715, kernel: '2.9.x', source: '组织私仓（已签名）', permissions: ['workspace.read', 'shell.exec(psql --dry-run)'], resources: ['只读连接', '审计：全部查询语句'], author: '数据平台组' },
  { id: 'mcp-jira-sync', name: 'Jira 同步 MCP', desc: '任务目标 ↔ Jira Issue 双向同步（含幂等键与冲突提示）', kind: 'MCP 服务', tags: ['协作', 'MCP', '同步'], version: '0.9.7', signature: 'verified', rating: 4.2, installs: 3180, kernel: '2.8.x–2.9.x', source: '组织私仓（已签名）', permissions: ['network.egress(jira.internal)', 'task.write(受限：本项目)'], resources: ['密钥：凭据引用注入', '限流：60 次/分钟'], author: '协作平台组' },
  { id: 'legacy-analyzer', name: '遗留代码分析器', desc: '跨模块依赖图 + 高风险改动热区标注', kind: '插件', tags: ['分析', '图谱'], version: '1.1.0', signature: 'unsigned', rating: 3.9, installs: 640, kernel: '2.9.x', source: '公共市场（未签名）', permissions: ['workspace.read'], resources: ['本地索引缓存 ≤2GB'], author: '社区（未签名）' },
  { id: 'prompt-lint', name: '提示词质检', desc: '提示词资产静态检查：歧义、缺验收标准、越权指令', kind: '技能', tags: ['提示词', '质量'], version: '2.0.0', signature: 'verified', rating: 4.4, installs: 4060, kernel: '2.9.x', source: '公共市场（企业默认关闭）', permissions: ['prompt.read'], resources: ['无网络外发'], author: '质量工程组' },
  { id: 'exp-token-lab', name: 'Token 实验台', desc: '上下文压缩策略 A/B 实验（实验特性，接口可破坏）', kind: '插件', tags: ['实验', '上下文'], version: '0.3.0-beta', signature: 'verified', rating: 4.0, installs: 380, kernel: '2.10.x（前瞻）', source: '组织私仓（已签名）', permissions: ['context.read', 'experiment.run'], resources: ['仅评测环境', '不承诺兼容'], author: '前沿探索组' },
  { id: 'bad-sig-tool', name: '镜像清理工具', desc: '清理本地沙箱镜像缓存（签名校验失败，已下架）', kind: '插件', tags: ['容器', '清理'], version: '0.2.4', signature: 'invalid', rating: 2.1, installs: 96, kernel: '2.9.x', source: '公共市场（签名失败）', permissions: ['sandbox.image.purge'], resources: ['需 root（拒绝装载）'], author: '未知发布者' },
  { id: 'shell-completion-plus', name: 'Shell 补全增强', desc: '在官方补全之上增加历史会话与任务 ID 动态补全', kind: '技能', tags: ['Shell', '效率'], version: '1.2.3', signature: 'verified', rating: 4.3, installs: 5310, kernel: '2.7.x–2.9.x', source: '组织私仓（已签名）', permissions: ['shell.completion'], resources: ['本地缓存', '不含敏感参数'], author: '开发者体验组' },
];

const SIG_META: Record<SigState, { label: string; theme: 'success' | 'warning' | 'danger' }> = {
  verified: { label: '签名有效', theme: 'success' },
  unsigned: { label: '未签名', theme: 'warning' },
  invalid: { label: '签名失败', theme: 'danger' },
};

const keyword = ref('');
const tagFilter = ref('all');
const compatFilter = ref('all');
const limit = ref(6);
const loading = ref(true);
const installed = ref<string[]>([]);
const reported = ref<string[]>([]);

const tagOptions = computed(() => [{ label: '全部标签', value: 'all' }, ...[...new Set(ITEMS.flatMap((i) => i.tags))].map((t) => ({ label: t, value: t }))]);

const matched = computed(() =>
  ITEMS.filter((i) => {
    const kw = keyword.value.trim().toLowerCase();
    const kwHit = !kw || `${i.name}${i.desc}${i.author}${i.id}`.toLowerCase().includes(kw);
    const tagHit = tagFilter.value === 'all' || i.tags.includes(tagFilter.value);
    const compatHit = compatFilter.value === 'all' || i.kernel.includes(KERNEL);
    return kwHit && tagHit && compatHit;
  }),
);
const visible = computed(() => matched.value.slice(0, limit.value));
const pageState = computed<UiStateKind>(() => {
  if (loading.value) return 'LOADING';
  if (!matched.value.length) return 'EMPTY';
  return matched.value.length > limit.value ? 'EDGE_DATA' : 'NORMAL';
});

const installTarget = ref<RegistryItem | null>(null);
const installOpen = ref(false);
const reportTarget = ref<RegistryItem | null>(null);
const reportOpen = ref(false);
const reportReason = ref('');
const reportKind = ref('签名可疑');

/** 打开安装确认：先看权限与资源声明、来源与签名状态，再决定安装（不自动安装） */
function openInstall(item: RegistryItem) {
  installTarget.value = item;
  installOpen.value = true;
}

function confirmInstall() {
  const item = installTarget.value;
  if (!item) return;
  if (item.signature === 'invalid') {
    MessagePlugin.error('签名校验失败：拒绝安装并隔离（供应链阻断），请改用私仓已签名版本');
    return;
  }
  installed.value = [...installed.value, item.id];
  installOpen.value = false;
  MessagePlugin.success(`已安装 ${item.name}@${item.version}：权限按声明收窄，来源与签名已记录审计`);
}

function confirmReport() {
  const item = reportTarget.value;
  if (!item) return;
  if (!reportReason.value.trim()) {
    MessagePlugin.warning('举报必须填写理由（安全与合规要求）');
    return;
  }
  reported.value = [...reported.value, item.id];
  reportOpen.value = false;
  MessagePlugin.success(`已受理举报 ${item.id}：工单已创建，处理结果会回执到通知中心`);
  reportReason.value = '';
}

function clearFilters() {
  keyword.value = '';
  tagFilter.value = 'all';
  compatFilter.value = 'all';
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
      title="Registry 浏览"
      desc="搜索 + 标签 + 兼容性三重过滤；安装前逐一确认权限与资源声明、来源与签名状态；未签名默认告警，签名失败直接拒绝（不做静默降级）。"
      volume="卷 29"
      manifest="G2-03"
      cli="oc registry search --keyword <kw> --compat 2.9.x --json"
      :status="[{ label: '私仓优先', theme: 'primary' }, { label: '签名失败即拒绝', theme: 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="clearFilters">清除过滤</Button>
        <Button size="small" variant="outline" @click="reportKind = '签名可疑'">举报流程</Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="可浏览条目" :value="ITEMS.length" unit="个" icon="browse" hint="私仓 + 公共市场（企业默认关闭）" />
      <StatCard label="匹配结果" :value="matched.length" unit="个" icon="search" />
      <StatCard label="已安装" :value="installed.length" unit="个" icon="check" />
      <StatCard label="签名异常" :value="ITEMS.filter((i) => i.signature !== 'verified').length" unit="个" icon="secured" :lower-is-better="true" hint="未签名告警 / 签名失败拒绝" />
    </div>

    <StateShell
      :state="pageState"
      :collapsed-summary="`匹配 ${matched.length} 条，超过单次渲染阈值（6 条）已折叠。`"
      :page-size="6"
      stage="正在检索 Registry…"
      empty-title="没有匹配的条目"
      empty-desc="当前关键词 / 标签 / 兼容性组合没有结果；可放宽兼容性过滤（当前内核 2.9.x），或改用组织私仓的镜像索引。"
      empty-action="清除过滤条件"
      example-task="搜索「重构」并安装 refactor-kit，观察权限与资源声明确认流程"
      what="Registry 检索失败"
      why="私仓索引不可达（网络或凭据引用失效），公共源处于禁用状态。"
      how="可重试；离线环境请改用私仓离线镜像包（本地 file:// 源）。"
      trace-id="trace-registry-0ac93e"
      @retry="loading = false"
      @load-more="limit += 6"
      @empty-action="clearFilters"
    >
      <div class="oc-card">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px">
          <Input v-model="keyword" size="small" placeholder="搜索名称 / 描述 / 作者 / id" clearable style="width: 300px">
            <template #prefix-icon><OcIcon name="search" size="14px" /></template>
          </Input>
          <Select v-model="tagFilter" size="small" :options="tagOptions" style="width: 170px" aria-label="标签过滤" />
          <Select v-model="compatFilter" size="small" style="width: 230px" aria-label="兼容性过滤" :options="[
            { label: '全部兼容性', value: 'all' },
            { label: `仅看兼容当前内核（${KERNEL}）`, value: 'compat' },
          ]" />
          <span class="oc-muted" style="font-size: 12px">匹配 {{ matched.length }} 条 · 当前环境 内核 {{ KERNEL }} / 协议 {{ PROTOCOL }}</span>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div v-for="item in visible" :key="item.id" class="oc-card">
          <div class="oc-flex--between">
            <div class="oc-grow">
              <div class="oc-flex oc-flex--wrap" style="gap: 6px">
                <b>{{ item.name }}</b>
                <Tag size="small" variant="outline" class="oc-mono">{{ item.version }}</Tag>
                <Tag size="small" variant="outline">{{ item.kind }}</Tag>
                <Tag v-if="item.kernel.includes(KERNEL)" size="small" theme="success" variant="light-outline">兼容当前内核</Tag>
                <Tag v-else size="small" theme="warning" variant="light-outline">内核不兼容（{{ item.kernel }}）</Tag>
              </div>
              <div class="oc-secondary" style="font-size: 12px; margin: 4px 0">{{ item.desc }}</div>
            </div>
            <Tooltip :content="SIG_META[item.signature].label">
              <Tag size="small" :theme="SIG_META[item.signature].theme" variant="light-outline">{{ SIG_META[item.signature].label }}</Tag>
            </Tooltip>
          </div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
            <Tag v-for="t in item.tags" :key="t" size="small" variant="outline">{{ t }}</Tag>
          </div>
          <InfoGrid :columns="2" :items="[
            { key: 'rate', label: '评分 / 安装量', value: `${item.rating.toFixed(1)} 分 · ${item.installs.toLocaleString('zh-CN')} 次` },
            { key: 'src', label: '来源', value: item.source },
            { key: 'kernel', label: '内核兼容', value: item.kernel },
            { key: 'author', label: '发布者', value: item.author },
          ]" />
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 8px">
            <Button size="small" theme="primary" @click="openInstall(item)">安装</Button>
            <Button size="small" variant="outline" @click="reportTarget = item; reportOpen = true">举报</Button>
            <Tag v-if="installed.includes(item.id)" size="small" theme="success" variant="light-outline">已安装</Tag>
            <Tag v-if="reported.includes(item.id)" size="small" theme="warning" variant="light-outline">已举报</Tag>
            <CliHint :command="`oc registry install ${item.id}@${item.version}`" label="等价 CLI" />
          </div>
        </div>
      </div>
      <div v-if="matched.length > visible.length" class="oc-muted" style="font-size: 12px; margin-top: 8px">
        已展示 {{ visible.length }} / {{ matched.length }} 条（EDGE_DATA 折叠，可加载更多）。
      </div>
    </StateShell>

    <Dialog v-model:visible="installOpen" header="安装确认（权限与资源声明）" width="640px" :confirm-btn="{ content: '确认安装', theme: 'primary' }" cancel-btn="取消" @confirm="confirmInstall">
      <div v-if="installTarget" class="oc-stack">
        <Alert
          :theme="installTarget.signature === 'verified' ? 'info' : 'warning'"
          :message="`来源：${installTarget.source} · 签名：${SIG_META[installTarget.signature].label}`"
          description="安装即按其声明收窄权限；声明的每一项都会在首次使用前再次确认（权限≠自主度）。签名失败将被拒绝安装。"
        />
        <InfoGrid :columns="1" :items="[
          { key: 'pkg', label: '条目', value: `${installTarget.name}@${installTarget.version}（${installTarget.kind}）`, mono: true },
          { key: 'kernel', label: '内核兼容', value: installTarget.kernel },
          { key: 'perm', label: '权限声明', value: installTarget.permissions.join(' · ') },
          { key: 'res', label: '资源声明', value: installTarget.resources.join(' · ') },
          { key: 'audit', label: '审计', value: '安装、权限变更与全部调用均写入审计' },
        ]" />
        <div class="oc-flex" style="gap: 6px">
          <CopyableId :id="`${installTarget.id}@${installTarget.version}`" label="复制条目标识" />
          <CliHint :command="`oc registry install ${installTarget.id}@${installTarget.version} --dry-run`" label="先预演" />
        </div>
      </div>
    </Dialog>

    <Dialog v-model:visible="reportOpen" header="举报条目" width="520px" :confirm-btn="{ content: '提交举报', theme: 'primary' }" cancel-btn="取消" @confirm="confirmReport">
      <div class="oc-stack">
        <div class="oc-flex" style="gap: 8px; align-items: center">
          <span style="font-size: 13px">举报类型</span>
          <Select v-model="reportKind" size="small" style="width: 200px" :options="[
            { label: '签名可疑', value: '签名可疑' },
            { label: '越权索要权限', value: '越权索要权限' },
            { label: '描述与行为不符', value: '描述与行为不符' },
            { label: '恶意代码嫌疑', value: '恶意代码嫌疑' },
          ]" />
        </div>
        <Textarea v-model="reportReason" :autosize="{ minRows: 3, maxRows: 5 }" placeholder="请描述具体现象（含复现步骤与证据链接）；举报会创建工单并回执处理结果" />
        <div class="oc-muted" style="font-size: 12px">举报人信息仅对安全团队可见；被举报条目在复核期间仍可浏览但会打标。</div>
      </div>
    </Dialog>
  </div>
</template>
