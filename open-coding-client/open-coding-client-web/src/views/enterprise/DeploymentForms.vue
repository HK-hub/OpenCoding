<script setup lang="ts">
/**
 * 部署形态（N-08）：local / server / enterprise-server / air-gapped 四形态卡片与能力差异。
 * 溯源：卷 24 §4.5
 */
import { computed, onMounted, ref } from 'vue';
import { Button, Dialog, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import { downloadText } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'ERROR'>('LOADING');
const current = ref('enterprise-server');
const forms = [
  { key: 'local', name: 'local（单机）', components: '内核 sidecar + 桌面端 + CLI + 本地 PG/文件', note: '单用户，无外部依赖', caps: { a2a: '默认关闭（仅回环）', sso: '不支持（本地账号）', audit: '本地留存', residency: '不适用' }, gpu: false, ha: false },
  { key: 'server', name: 'server（团队共享）', components: '内核服务（容器）+ PG + Redis + 对象存储 + 反向代理', note: '团队共享；可选 HTTPS 暴露', caps: { a2a: '可开启（需策略放行）', sso: '支持 OIDC/SAML', audit: '导出可用', residency: '单区域' }, gpu: false, ha: true },
  { key: 'enterprise-server', name: 'enterprise-server（多租户）', components: '上述 + SSO/SCIM + 审计导出 + 多副本 + KMS + 模型出口网关', note: '多租户；SLA 保障', caps: { a2a: '支持（含联邦）', sso: 'OIDC/SAML/LDAP/SCIM', audit: '三级审计 + 哈希链导出', residency: '多区域 + 驻留路由' }, gpu: false, ha: true },
  { key: 'air-gapped', name: 'air-gapped（离线）', components: '离线包安装（镜像 + 依赖 + 内网模型端点）+ 全禁外网', note: '涉密/内网场景', caps: { a2a: '仅内网回环', sso: '本地账号 / 内部 IdP', audit: '介质导出', residency: '不出网' }, gpu: true, ha: false },
];
const selected = computed(() => forms.find((f) => f.key === current.value) ?? forms[2]);
/** 形态切换路径（预检与「查看迁移路径」共用同一份数据） */
const migrationPaths = [
  { from: 'local', to: 'server', need: '迁移本地数据 + 配置 PG/Redis', license: '社区版可用' },
  { from: 'server', to: 'enterprise-server', need: '对接 SSO/SCIM + KMS + 多副本', license: '企业版许可' },
  { from: 'server', to: 'air-gapped', need: '介质包 + 内网模型端点 + 全禁外网', license: '企业版许可（离线激活）' },
];
/** 形态迁移预检结果（逐条给出可自动迁移/需人工准备） */
const precheckRows = ref<{ item: string; pass: boolean; detail: string }[]>([]);
const precheckAt = ref('');
const prechecking = ref(false);
/** 迁移路径弹窗：就地展示该形态相关的已有路径数据 */
const pathOpen = ref(false);
const pathForm = ref<(typeof forms)[number] | null>(null);

/** 导出拓扑说明：四形态组件与能力门控 + 切换路径，全部取自本页数据 */
function exportTopology() {
  const text = [
    `# 部署形态拓扑说明（当前视角：${selected.value.name}）`,
    '',
    ...forms.map((f) => [
      `## ${f.name}`,
      `- 组件：${f.components}`,
      `- 说明：${f.note}`,
      `- 能力门控：A2A ${f.caps.a2a}；SSO ${f.caps.sso}；审计 ${f.caps.audit}；数据驻留 ${f.caps.residency}`,
      `- 多副本：${f.ha ? '支持' : '不支持'}；GPU 基线：${f.gpu ? '需要' : '不需要'}`,
    ].join('\n')),
    '',
    '## 形态切换路径',
    ...migrationPaths.map((p) => `- ${p.from} → ${p.to}：前置条件 ${p.need}；许可 ${p.license}`),
  ].join('\n');
  const file = downloadText(text, `deployment-topology-${Date.now()}.md`);
  MessagePlugin.success('已生成 ' + file);
}

/** 形态迁移预检：核对当前形态的出向与回退路径，逐项给出结论并更新页面结果 */
function runPrecheck() {
  prechecking.value = true;
  MessagePlugin.info('正在执行形态迁移预检…');
  window.setTimeout(() => {
    const src = selected.value;
    const rows = [
      ...migrationPaths.filter((p) => p.from === src.key).map((p) => {
        const target = forms.find((f) => f.key === p.to)!;
        return { item: `${p.from} → ${p.to}`, pass: !target.gpu, detail: `${p.need}；许可：${p.license}${target.gpu ? '；需 GPU 内网模型端点（人工准备）' : ''}` };
      }),
      ...migrationPaths.filter((p) => p.to === src.key).map((p) => ({ item: `${p.from} → ${p.to}（回退路径）`, pass: true, detail: `回退方向：${p.need}；许可：${p.license}` })),
    ];
    precheckRows.value = rows.length ? rows : [{ item: `${src.key} → 目标形态`, pass: false, detail: '当前形态无预设切换路径：需人工评估迁移方案与许可，不允许静默降级' }];
    precheckAt.value = new Date().toISOString();
    prechecking.value = false;
    const blocked = precheckRows.value.filter((r) => !r.pass).length;
    MessagePlugin.success(`形态迁移预检完成：${precheckRows.value.length - blocked} 项通过，${blocked} 项需人工准备`);
  }, 560);
}

/** 查看迁移路径：打开弹窗展示该形态相关的路径与组件详情 */
function openPath(f: (typeof forms)[number]) {
  pathForm.value = f;
  pathOpen.value = true;
}

onMounted(() => {
  setTimeout(() => { state.value = 'NORMAL'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="部署形态"
      desc="四种交付形态的组件、能力差异与升级路径；形态决定默认安全边界（如 local 的 A2A 默认关闭且仅回环）。"
      volume="卷 24"
      manifest="N-08"
      cli="oc deployment describe --form enterprise-server"
      :status="[{ label: `当前形态：${selected.name}`, theme: 'primary' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportTopology">导出拓扑说明</Button>
        <Button size="small" theme="primary" :loading="prechecking" @click="runPrecheck">形态迁移预检</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      what="部署形态信息加载失败"
      why="装配计划读取失败（能力门控与降级项缺失）"
      how="可重试；形态信息为只读展示，不影响正在运行的服务"
      trace-id="trace-deploy-77c1a2"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="交付形态" :value="forms.length" unit="种" icon="server" />
        <StatCard label="多副本" :value="forms.filter((f) => f.ha).length" unit="种" />
        <StatCard label="需 GPU 基线" :value="forms.filter((f) => f.gpu).length" unit="种" hint="air-gapped 内网模型端点" />
        <StatCard label="水平扩展" :value="'协议面无状态'" format="raw" hint="执行节点可独立扩容；消费者分区消费" />
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div v-for="f in forms" :key="f.key" class="oc-card" :style="f.key === current ? 'border-color: var(--td-brand-color, #0052d9)' : ''">
          <div class="oc-flex--between">
            <div class="oc-card__title" style="margin: 0">{{ f.name }}</div>
            <Tag size="small" :theme="f.key === current ? 'primary' : 'default'" variant="light-outline">{{ f.key === current ? '当前形态' : '可切换' }}</Tag>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin: 4px 0">{{ f.note }}</div>
          <div class="oc-mono" style="font-size: 11px">{{ f.components }}</div>
          <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-top: 6px">
            <Tag size="small" variant="outline">A2A：{{ f.caps.a2a }}</Tag>
            <Tag size="small" variant="outline">SSO：{{ f.caps.sso }}</Tag>
            <Tag size="small" variant="outline">审计：{{ f.caps.audit }}</Tag>
            <Tag size="small" variant="outline">驻留：{{ f.caps.residency }}</Tag>
          </div>
          <div class="oc-flex" style="gap: 6px; margin-top: 8px">
            <Button size="small" variant="text" @click="current = f.key">设为当前视角</Button>
            <Button size="small" variant="text" @click="openPath(f)">查看迁移路径</Button>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">当前形态能力门控（{{ selected.key }}）</div>
          <InfoGrid
            :items="[
              { key: 'a2a', label: 'A2A 服务面', value: selected.caps.a2a },
              { key: 'sso', label: '身份源', value: selected.caps.sso },
              { key: 'audit', label: '审计', value: selected.caps.audit },
              { key: 'res', label: '数据驻留', value: selected.caps.residency },
            ]"
          />
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            不静默降级：能力门控关闭时接口返回 UNSUPPORTED_CAPABILITY，并在界面标注原因与替代路径。
          </div>
        </div>
        <div class="oc-card">
          <div class="oc-card__title">形态切换与许可</div>
          <Table
            :data="migrationPaths"
            row-key="from"
            size="small"
            :columns="[
              { colKey: 'from', title: '从', width: 110 },
              { colKey: 'to', title: '到', width: 150 },
              { colKey: 'need', title: '前置条件' },
              { colKey: 'license', title: '许可', width: 150 },
            ]"
          />
          <div v-if="precheckAt" class="oc-flex" style="gap: 8px; margin-top: 8px; align-items: center">
            <Tag size="small" :theme="precheckRows.every((r) => r.pass) ? 'success' : 'warning'" variant="light-outline">
              迁移预检 {{ new Date(precheckAt).toLocaleTimeString('zh-CN') }}
            </Tag>
            <span class="oc-muted" style="font-size: 12px">
              {{ precheckRows.map((r) => `${r.item}：${r.pass ? '通过' : '需人工准备'}`).join('；') }}
            </span>
          </div>
          <div class="oc-state__hint" style="margin-top: 6px">
            许可过期只读：可读、可检索、可导出（不锁死数据）；air-gapped 形态宽限 30 天后进入只读。
          </div>
          <CopyableId id="trace-deploy-lic-0912" label="复制 traceId" />
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="pathOpen" :header="pathForm ? `迁移路径：${pathForm.name}` : '迁移路径'" width="620px" :footer="false">
      <div v-if="pathForm" class="oc-stack">
        <div class="oc-muted" style="font-size: 12px">{{ pathForm.note }} · 组件：{{ pathForm.components }}</div>
        <Table
          v-if="migrationPaths.some((p) => p.from === pathForm?.key || p.to === pathForm?.key)"
          :data="migrationPaths.filter((p) => p.from === pathForm?.key || p.to === pathForm?.key)"
          row-key="from"
          size="small"
          :columns="[
            { colKey: 'from', title: '从', width: 110 },
            { colKey: 'to', title: '到', width: 150 },
            { colKey: 'need', title: '前置条件' },
            { colKey: 'license', title: '许可', width: 150 },
          ]"
        />
        <div v-else class="oc-state__hint">该形态没有预设切换路径（本页仅列出 local→server、server→enterprise-server、server→air-gapped）；如需调整请走人工评估，不允许静默降级。</div>
        <div class="oc-muted" style="font-size: 12px">
          切换语义：迁移过程中旧形态保持只读可导出；能力门控关闭的能力在目标形态若被支持需重新授权（不自动放宽）。
        </div>
      </div>
    </Dialog>
  </div>
</template>
