<script setup lang="ts">
/**
 * 技能分发与签名（K-09）：三通道（本地 / 组织私仓 / 公共市场）+ 签名 + 企业开关。
 * 溯源：卷 08 D-SKILL-8 与 §7 安全（签名校验失败禁止装载；企业可禁用未签名 / 公网来源）。
 */
import { computed, ref } from 'vue';
import { Alert, Button, Dialog, MessagePlugin, Switch, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { fmtTime } from '@/components/extension/useExtList';

const channels = ref(extensionData.distribution.map((c) => ({ ...c })));

/** 私仓索引同步中（短异步）：期间按钮 loading，完成后刷新「最近同步 / 已发布」可见数据 */
const indexSyncing = ref(false);

/** 同步组织私仓索引（增量）：短异步后更新最近同步时间与已发布计数（可见数据，不静默） */
function syncIndex() {
  if (indexSyncing.value) return;
  indexSyncing.value = true;
  window.setTimeout(() => {
    const c = channels.value.find((x) => x.channel === 'org-registry');
    if (c) {
      c.lastSyncAt = new Date().toISOString();
      c.published += 1;
    }
    indexSyncing.value = false;
    MessagePlugin.success(`已同步组织私仓索引（增量）：索引新增 1 个已发布技能（共 ${c?.published ?? 0} 个），最近同步时间已更新`);
  }, 600);
}


const publishOpen = ref(false);
const publishNote = ref('');
const pickedChannel = ref<'org-registry' | 'market'>('org-registry');
const publishReady = computed(() => publishNote.value.trim().length >= 5);

/** 允许发布的技能：签名有效且评测达标 */
const publishable = extensionData.skills.filter((s) => s.signature.state === 'verified' && s.eval.gate.met);
const blockedSkills = extensionData.skills.filter((s) => s.signature.state !== 'verified' || !s.eval.gate.met);
const selected = ref<string[]>(publishable.slice(0, 2).map((s) => s.name));

const publishPlan = computed(() => ({
  channel: pickedChannel.value,
  signing: 'Ed25519（发布者私钥离线签名；平台仅存公钥）',
  items: selected.value.map((n) => {
    const s = publishable.find((x) => x.name === n);
    return { name: n, version: s?.version, passRate: `${s?.eval.gate.actual}` , gate: s?.eval.gate.met ? '达标' : '未达标' };
  }),
  blocked: blockedSkills.map((s) => ({ name: s.name, reason: s.signature.state !== 'verified' ? '未签名/签名失败' : '评测未达门槛' })),
}));

function toggleChannel(c: (typeof channels.value)[number], v: boolean) {
  if (c.channel === 'org-registry' && !v) {
    MessagePlugin.warning('组织私仓是企业默认通道：禁用后所有技能来源仅剩本地目录，安全类技能将失效');
  }
  c.enabled = v;
  MessagePlugin.info(`${c.label} 已${v ? '启用' : '禁用'}（记录分发策略变更审计）`);
}

function doPublish() {
  publishOpen.value = false;
  const n = selected.value.length;
  // 发布提交写回目标通道的已发布计数（三通道状态表随即更新，不静默）
  const c = channels.value.find((x) => x.channel === pickedChannel.value);
  if (c) c.published += n;
  MessagePlugin.success(`已提交 ${n} 个技能到${pickedChannel.value === 'org-registry' ? '组织私仓' : '公共市场'}：制品 + 清单 + 评测记录 + 签名，等待审核（通道已发布 ${c?.published ?? 0} 个）`);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/skills/distribution', () => channels.value.length > 0);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="技能分发与签名"
      desc="三通道分发：本地目录 / 组织私仓 / 公共市场；全部要求可校验签名，企业可禁用公网来源。"
      volume="卷 08" manifest="K-09" cli="oc skill publish --channel org-registry --sign"
      :status="[{ label: '私仓强制签名', theme: 'success' }, { label: '公共市场已禁用', theme: 'warning' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="indexSyncing" @click="syncIndex">同步索引</Button>
        <Button size="small" theme="primary" :disabled="!selected.length" @click="publishOpen = true">
          <OcIcon name="upload" size="12px" /> 发布技能
        </Button>
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
      theme="warning"
      message="企业策略：仅允许私仓白名单来源"
      description="公共市场已禁用（企业开关）；未签名技能在装载期即被拒绝并隔离，不做「先装后审」的静默降级。"
    />

    <div class="oc-card">
      <h3 class="oc-card__title">三通道状态</h3>
      <Table
        row-key="channel"
        size="small"
        :columns="[
          { colKey: 'label', title: '分发通道', width: 260 },
          { colKey: 'enabled', title: '启用', width: 90 },
          { colKey: 'requireSignature', title: '强制签名', width: 110 },
          { colKey: 'enterpriseToggle', title: '企业开关', width: 110 },
          { colKey: 'published', title: '已发布', width: 100 },
          { colKey: 'lastSyncAt', title: '最近同步', width: 180 },
          { colKey: 'note', title: '说明' },
        ]"
        :data="channels"
      >
        <template #enabled="{ row }">
          <Tooltip content="本地目录通道无签名要求，仅供开发期使用">
            <Switch size="small" :value="row.enabled" @change="(v) => toggleChannel(row, Boolean(v))" />
          </Tooltip>
        </template>
        <template #requireSignature="{ row }">
          <Tag size="small" :theme="row.requireSignature ? 'success' : 'warning'" variant="light-outline">{{ row.requireSignature ? '强制' : '可选' }}</Tag>
        </template>
        <template #enterpriseToggle="{ row }">
          <Tag size="small" :theme="row.enterpriseToggle ? 'primary' : 'default'" variant="light-outline">{{ row.enterpriseToggle ? '受企业策略控制' : '个人级' }}</Tag>
        </template>
        <template #lastSyncAt="{ row }"><span class="oc-muted" style="font-size: 12px">{{ fmtTime(row.lastSyncAt) }}</span></template>
        <template #note="{ row }"><span class="oc-secondary" style="font-size: 12px">{{ row.note }}</span></template>
      </Table>
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">待发布（可签名）</h3>
        <Table
          row-key="name" size="small"
          :selected-row-keys="selected"
          :columns="[
            { colKey: 'row-select', type: 'multiple', width: 46 },
            { colKey: 'name', title: '技能', width: 300 },
            { colKey: 'version', title: '版本', width: 100 },
            { colKey: 'gate', title: '评测门禁', width: 120 },
          ]"
          :data="publishable"
          @select-change="(keys: Array<string | number>) => (selected = keys.map(String))"
        >
          <template #name="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.name }}</span></template>
          <template #gate="{ row }">
            <Tag size="small" :theme="row.eval.gate.met ? 'success' : 'danger'" variant="light-outline">
              {{ (row.eval.gate.actual * 100).toFixed(0) }}%
            </Tag>
          </template>
        </Table>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
          已勾选 {{ selected.length }} 项（示例默认勾选前 2 项）
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          禁止发布（显式拦截）
          <Tag size="small" theme="danger" variant="light-outline">{{ blockedSkills.length }} 项</Tag>
        </h3>
        <div class="oc-stack" style="gap: 6px">
          <div v-for="s in blockedSkills" :key="s.id" class="oc-flex" style="gap: 8px; font-size: 12px">
            <Tag size="small" theme="danger" variant="outline">拦截</Tag>
            <span class="oc-mono oc-grow">{{ s.name }}@{{ s.version }}</span>
            <span class="oc-secondary">{{ s.signature.state !== 'verified' ? '未签名 / 签名失败' : '评测未达门槛' }}</span>
          </div>
        </div>
        <Alert
          style="margin-top: 10px"
          theme="info"
          message="拦截不是错误态"
          description="签名与门禁拦截均可在技能库中查看原因与可操作建议（换已签名来源 / 修复用例后重跑）。"
        />
      </div>
    </div>

    <Dialog v-model:visible="publishOpen" header="发布前确认（制品 + 签名）" width="640px"
      :confirm-btn="{ content: '签名并发布', theme: 'primary', disabled: !publishReady }" @confirm="doPublish">
      <InfoGrid
        :columns="1"
        :items="[
          { key: 'channel', label: '目标通道', value: pickedChannel === 'org-registry' ? '组织私仓（强制签名 + 管理员审核）' : '公共市场（自动扫描 + 人工抽检）' },
          { key: 'sign', label: '签名方式', value: publishPlan.signing },
          { key: 'count', label: '发布数量', value: `${selected.length} 个技能（含评测记录与制品哈希）` },
        ]"
      />
      <div style="margin-top: 10px">
        <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">发布说明（必填，≥5 字，将写入发布记录）</div>
        <Textarea v-model="publishNote" :autosize="{ minRows: 2 }" placeholder="例如：v2.4.1 收紧指令分段；评测通过率 92%（门槛 88%）" />
      </div>
      <div style="margin-top: 10px">
        <JsonBlock :value="publishPlan" label="发布清单（含被拦截项，不静默略过）" :collapse-over="180" />
      </div>
    </Dialog>
    </StateShell>
  </div>
</template>
