<script setup lang="ts">
/**
 * 技能详情（K-02）：八 Tab —— 概览 / 指令预览 / 资源 / 工具依赖 / 能力声明 / 权限建议 / 评测用例 / 统计与版本。
 * 溯源：卷 08 §4.2 manifest 字段与 §4.6 事件；能力声明逐条可核对，越权路径显式拒绝并审计。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Popconfirm, Table, TabPanel, Tabs, Tag, MessagePlugin } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import DiffView from '@/components/common/DiffView.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import {
  PERMISSION_MODE_LABEL, SIGNATURE_LABEL, SIGNATURE_THEME, SKILL_SCOPE_LABEL, SKILL_SOURCE_LABEL, SKILL_STATE_THEME,
  fmtBytes, fmtMs, fmtTime, type TagTheme,
} from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const skills = extensionData.skills;
const name = computed(() => String(route.query.name ?? skills[0].name));
const skill = computed(() => skills.find((s) => s.name === name.value) ?? skills[0]);
const tab = ref('overview');

const MODES = ['readonly', 'plan', 'default', 'acceptEdits', 'autonomous', 'yolo'];
const currentMode = 'default';

/** 能力声明逐条（与卷 08 D-SKILL-6 对应：安装授权 + 运行期仍受治理） */
const capabilityRows = computed(() => {
  const c = skill.value.capabilities;
  return [
    { key: 'network', label: '网络域名', items: c.networkDomains, risk: 'R3 外发', desc: '仅在声明域名内允许出网，走网络策略与审计' },
    { key: 'command', label: '命令执行', items: c.commandExecution ? ['沙箱内执行（L1 档，资源受限）'] : [], risk: 'R2 执行', desc: '脚本在沙箱执行，不能放宽权限' },
    { key: 'write', label: '文件写范围', items: c.fileWriteScopes, risk: 'R1 受控写', desc: '越出范围写入一律拒绝并审计' },
    { key: 'secret', label: '密钥引用', items: c.secretRefs, risk: 'R5 敏感', desc: '仅引用名可见，明文经 SecretPort 注入' },
    { key: 'subagent', label: '子 Agent 派生', items: c.subagent ? ['允许派生（深度 ≤2，预算独立）'] : [], risk: 'R2 执行', desc: '子 Agent 继承父级权限上限，不可放大' },
  ].filter((r) => r.items.length);
});

const relatedAudit = computed(() => extensionData.auditEvents.filter((e) => e.subject.startsWith(skill.value.name)));

const toolColumns = [
  { colKey: 'path', title: '资源路径', width: 320 },
  { colKey: 'kind', title: '类型', width: 110 },
  { colKey: 'size', title: '大小 / token', width: 180 },
];
const evalColumns = [
  { colKey: 'name', title: '用例', width: 220 },
  { colKey: 'expect', title: '期望行为', width: 300 },
  { colKey: 'status', title: '状态', width: 110 },
  { colKey: 'cost', title: '成本 / 耗时', width: 160 },
  { colKey: 'lastRun', title: '最近运行', width: 170 },
];

function activate() {
  MessagePlugin.success(`已激活 ${skill.value.name}@${skill.value.version}：产生 skill.activated 事件（含激活方式与理由）`);
}
function deactivate() {
  MessagePlugin.info('已停用：指令与资源从上下文区段移除，运行中的轮次保持稳定（下一轮生效）');
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/skills/detail', () => !route.query.name || skills.some((s) => s.name === route.query.name));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`技能详情 · ${skill.name}`"
      :desc="skill.description"
      volume="卷 08" manifest="K-02" :cli="`oc skill show ${skill.name}`"
      :status="[
        { label: SIGNATURE_LABEL[skill.signature.state], theme: SIGNATURE_THEME[skill.signature.state] },
        { label: `${skill.installState}`, theme: (SKILL_STATE_THEME[skill.installState] ?? 'default') as TagTheme },
      ]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/skills')">返回列表</Button>
        <Popconfirm content="激活会收窄权限并按 policy 注入指令（不可放宽当前模式），是否继续？" @confirm="activate">
          <Button size="small" theme="primary">激活</Button>
        </Popconfirm>
        <Popconfirm content="停用后本会话不再注入该技能指令与资源；运行中轮次保持稳定。" @confirm="deactivate">
          <Button size="small" variant="outline">停用</Button>
        </Popconfirm>
        <Button size="small" variant="text" @click="router.push({ path: '/extension/skills/uninstall', query: { name: skill.name } })">卸载</Button>
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


    <Alert
      v-if="skill.blockedReason"
      theme="error"
      :message="`拒绝装载：${skill.blockedReason}`"
      description="不静默降级：该技能未注册任何工具与钩子实现；可改用已签名来源或联系发布者重新签发。"
    />
    <Alert
      v-else-if="!skill.eval.gate.met"
      theme="warning"
      message="评测未达门槛"
      :description="`用例通过率 ${(skill.eval.gate.actual * 100).toFixed(0)}% 低于门槛 ${(skill.eval.gate.threshold * 100).toFixed(0)}%；发布到私仓/市场将被门禁拦截，本地使用会显式标注劣化。`"
    />

    <Tabs v-model:value="tab">
      <TabPanel value="overview" label="概览">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">标识与来源</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'name', label: '命名空间式名称', value: skill.name, mono: true, copyable: true },
                { key: 'ver', label: '版本（语义化）', value: skill.version, mono: true },
                { key: 'scope', label: '作用域', value: SKILL_SCOPE_LABEL[skill.scope] },
                { key: 'src', label: '发现来源', value: `${SKILL_SOURCE_LABEL[skill.source]} · ${skill.sourcePath}` },
                { key: 'owner', label: '维护人', value: skill.owner },
                { key: 'kernel', label: '内核兼容区间', value: skill.compatibility.kernelRange, mono: true },
                { key: 'caps', label: '必需模型能力', value: skill.compatibility.modelCapabilities.join(' / ') || '无' },
                { key: 'lock', label: '依赖锁文件', value: skill.lockFile, mono: true, copyable: true },
                { key: 'tokens', label: '主指令 token', value: `${skill.mainInstructionTokens}（上限 8k，超出需拆分到 resources）`, hint: '影响上下文 S2/S5 区段' },
              ]"
            />
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">
              入参与触发
              <span class="oc-muted" style="font-size: 12px">默认「显式 + 建议」，自动激活可关</span>
            </h3>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 10px">
              <Tag v-for="t in skill.triggers" :key="t.kind + t.value" size="small" variant="light-outline">
                {{ t.kind }}: {{ t.value }}
              </Tag>
            </div>
            <div class="oc-kv">
              <span class="oc-kv__k">当前生效理由</span>
              <span>{{ skill.activationReason }}</span>
              <span class="oc-kv__k">验收清单</span>
              <span>
                <div v-for="a in skill.acceptance" :key="a" class="oc-flex" style="gap: 6px">
                  <OcIcon name="check" size="13px" color="var(--oc-sev-ok)" /><span>{{ a }}</span>
                </div>
              </span>
              <span class="oc-kv__k">必需工具</span>
              <span>
                <span v-for="t in skill.tools.required" :key="t" class="oc-mono" style="font-size: 12px; margin-right: 6px">{{ t }}</span>
              </span>
            </div>
            <Alert v-if="skill.missingRequiredTools?.length" theme="error" message="缺失必需工具，拒绝激活" :description="skill.missingRequiredTools.join('、')" />
            <div v-if="skill.suggestion" class="oc-card" style="margin-top: 10px; background: var(--td-bg-color-secondarycontainer)">
              <div class="oc-flex--between">
                <b style="font-size: 13px">技能建议</b>
                <Tag size="small" variant="outline">置信度 {{ (skill.suggestion.confidence * 100).toFixed(0) }}%</Tag>
              </div>
              <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ skill.suggestion.reason }}</div>
              <div class="oc-muted" style="font-size: 12px">触发：{{ skill.suggestion.trigger }} · 证据：{{ skill.suggestion.evidence }}</div>
              <Button size="small" variant="text" @click="router.push('/extension/skills/suggestion')">查看「为什么生效」溯源</Button>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="instruction" label="指令预览">
        <div class="oc-card">
          <h3 class="oc-card__title">
            主指令 diff（skill.md）
            <span class="oc-muted" style="font-size: 12px">与当前运行版本对比：{{ skill.instructionDiff.additions }} 增 / {{ skill.instructionDiff.deletions }} 删</span>
          </h3>
          <DiffView :files="[skill.instructionDiff]" />
        </div>
      </TabPanel>

      <TabPanel value="resources" label="资源">
        <div class="oc-card">
          <h3 class="oc-card__title">
            资源清单
            <span class="oc-muted" style="font-size: 12px">默认按需引用，不全量注入上下文</span>
          </h3>
          <Table row-key="path" size="small" :data="skill.resources" :columns="toolColumns">
            <template #path="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.path }}</span></template>
            <template #kind="{ row }"><Tag size="small" variant="outline">{{ row.kind }}</Tag></template>
            <template #size="{ row }"><span class="oc-mono" style="font-size: 12px">{{ fmtBytes(row.bytes) }} · {{ row.tokens }} token</span></template>
          </Table>
        </div>
      </TabPanel>

      <TabPanel value="tools" label="工具依赖">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">工具声明（收窄工具集）</h3>
            <div class="oc-kv">
              <span class="oc-kv__k">必需（缺失则拒绝激活）</span>
              <span>
                <Tag v-for="t in skill.tools.required" :key="t" size="small" theme="primary" variant="light-outline" style="margin: 0 4px 4px 0">{{ t }}</Tag>
              </span>
              <span class="oc-kv__k">可选（不满足则降级能力）</span>
              <span>
                <Tag v-for="t in skill.tools.optional" :key="t" size="small" variant="outline" style="margin: 0 4px 4px 0">{{ t }}</Tag>
                <span v-if="!skill.tools.optional.length" class="oc-muted" style="font-size: 12px">无</span>
              </span>
            </div>
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">依赖与版本</h3>
            <div class="oc-kv">
              <span class="oc-kv__k">依赖技能</span>
              <span>
                <span v-for="d in skill.dependencies" :key="d" class="oc-mono" style="font-size: 12px; display: block">{{ d }}</span>
                <span v-if="!skill.dependencies.length" class="oc-muted" style="font-size: 12px">无</span>
              </span>
              <span class="oc-kv__k">被依赖（卸载前提示）</span>
              <span>
                <span v-for="d in skill.dependents" :key="d" class="oc-mono" style="font-size: 12px; display: block">{{ d }}</span>
                <span v-if="!skill.dependents.length" class="oc-muted" style="font-size: 12px">无</span>
              </span>
            </div>
            <Table style="margin-top: 10px" row-key="version" size="small" :columns="[
              { colKey: 'version', title: '版本', width: 100 },
              { colKey: 'note', title: '变更说明' },
              { colKey: 'breaking', title: '破坏性', width: 90 },
            ]" :data="skill.versionHistory">
              <template #version="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.version }}</span></template>
              <template #breaking="{ row }"><Tag size="small" :theme="row.breaking ? 'warning' : 'default'" variant="light-outline">{{ row.breaking ? '是' : '否' }}</Tag></template>
            </Table>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="capability" label="能力声明">
        <div class="oc-card">
          <h3 class="oc-card__title">
            能力声明逐条（安装授权 ≠ 运行期放行）
            <span class="oc-muted" style="font-size: 12px">每项在运行期仍逐动作走权限决策</span>
          </h3>
          <Table
            row-key="key" size="small"
            :columns="[
              { colKey: 'label', title: '能力', width: 140 },
              { colKey: 'items', title: '声明取值' },
              { colKey: 'risk', title: '风险提示', width: 110 },
              { colKey: 'desc', title: '治理说明' },
            ]"
            :data="capabilityRows"
          >
            <template #items="{ row }">
              <span v-for="i in row.items" :key="i" class="oc-mono" style="font-size: 12px; display: block">{{ i }}</span>
            </template>
            <template #risk="{ row }"><Tag size="small" variant="outline">{{ row.risk }}</Tag></template>
          </Table>
          <Alert
            style="margin-top: 10px"
            theme="info"
            message="不可放宽权限"
            description="技能声明的权限模式只可收窄当前模式（narrowOnly=true）；钩子与技能均不能把 DENY 改为 ALLOW。"
          />
          <div v-if="relatedAudit.length" style="margin-top: 10px">
            <h4 style="font-size: 13px; margin: 0 0 6px">相关审计（越权即显式拒绝）</h4>
            <div v-for="e in relatedAudit" :key="e.id" class="oc-flex" style="gap: 8px; font-size: 12px">
              <Tag size="small" theme="danger" variant="light-outline">{{ e.decision }}</Tag>
              <span class="oc-grow">{{ e.detail }}</span>
              <CopyableId :id="e.traceId" label="traceId" :short="14" />
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="permission" label="权限建议">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">建议模式对比</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'rec', label: '技能建议模式', value: PERMISSION_MODE_LABEL[skill.permissions.recommendedMode], tag: { text: '建议', theme: 'primary' } },
                { key: 'cur', label: '当前会话模式', value: PERMISSION_MODE_LABEL[currentMode] },
                { key: 'only', label: '收窄约束', value: '只可收窄（narrowOnly=true）：建议模式高于当前模式时按当前模式执行' },
              ]"
            />
            <Alert style="margin-top: 10px" theme="warning" message="切换模式需用户确认" description="技能可建议模式切换，但 autonomous 下也需按预授权边界；切换事件会写入审计。" />
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">权限六档语义（卷 06）</h3>
            <div class="oc-stack" style="gap: 4px">
              <div v-for="(label, key) in PERMISSION_MODE_LABEL" :key="key" class="oc-flex" style="gap: 8px; font-size: 12px">
                <Tag size="small" :theme="key === skill.permissions.recommendedMode ? 'primary' : 'default'" variant="outline">{{ key }}</Tag>
                <span class="oc-secondary">{{ label }}</span>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="eval" label="评测用例">
        <div class="oc-card">
          <h3 class="oc-card__title">
            用例集（入口 {{ skill.eval.entry }}）
            <span class="oc-muted" style="font-size: 12px">发布门禁：通过率 ≥ {{ (skill.eval.gate.threshold * 100).toFixed(0) }}%</span>
          </h3>
          <Table row-key="id" size="small" :data="skill.eval.cases" :columns="evalColumns">
            <template #name="{ row }">
              <div class="oc-stack" style="gap: 2px">
                <span>{{ row.name }}</span>
                <span class="oc-muted oc-mono" style="font-size: 11px">{{ row.input }}</span>
              </div>
            </template>
            <template #status="{ row }">
              <Tag size="small" :theme="row.status === 'passed' ? 'success' : row.status === 'failed' ? 'danger' : 'default'" variant="light-outline">
                {{ row.status }}
              </Tag>
            </template>
            <template #cost="{ row }"><span class="oc-mono" style="font-size: 12px">${{ row.cost.toFixed(4) }} · {{ fmtMs(row.durationMs) }}</span></template>
            <template #lastRun="{ row }"><span class="oc-muted" style="font-size: 12px">{{ fmtTime(row.lastRun) }}</span></template>
          </Table>
        </div>
      </TabPanel>

      <TabPanel value="stats" label="统计与版本">
        <div class="oc-grid oc-grid--4">
          <StatCard label="激活次数" :value="skill.stats.activationCount" unit="次" icon="refresh" :trend="skill.stats.trend" />
          <StatCard label="成功率" :value="skill.stats.successRate" format="percent" :target="skill.stats.baselineSuccessRate" target-kind="min" :delta="skill.stats.successRate - skill.stats.baselineSuccessRate" />
          <StatCard label="单次成本" :value="skill.stats.costPerRun" format="cost" :target="0.9" target-kind="max" />
          <StatCard label="单次时长" :value="skill.stats.durationMs" unit="ms" :target="300_000" target-kind="max" />
        </div>
        <div class="oc-card" style="margin-top: 12px">
          <h3 class="oc-card__title">用户反馈</h3>
          <div class="oc-flex" style="gap: 16px; font-size: 13px">
            <span class="oc-flex" style="gap: 6px"><OcIcon name="thumb-up" size="14px" color="var(--oc-sev-ok)" /> 好评 {{ skill.stats.userFeedback.up }}</span>
            <span class="oc-flex" style="gap: 6px"><OcIcon name="thumb-down" size="14px" color="var(--oc-sev-error)" /> 差评 {{ skill.stats.userFeedback.down }}</span>
            <span class="oc-muted">劣化判定：成功率低于无技能基线 {{ skill.stats.baselineSuccessRate }}% 时自动降级为「建议」</span>
          </div>
        </div>
      </TabPanel>
    </Tabs>
    </StateShell>
  </div>
</template>
