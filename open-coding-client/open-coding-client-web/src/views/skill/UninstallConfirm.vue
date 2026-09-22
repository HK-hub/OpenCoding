<script setup lang="ts">
/**
 * 卸载与禁用确认（K-05）：依赖链提示 + 强制卸载需理由。
 * 溯源：卷 08 §4.5 依赖保护；危险操作使用 Popconfirm/Dialog 并说明后果与撤销窗口。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Dialog, MessagePlugin, Popconfirm, Select, Table, Tag, Textarea, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { SKILL_SOURCE_LABEL } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const skills = extensionData.skills;
const name = ref(String(route.query.name ?? skills[0].name));
const skill = computed(() => skills.find((s) => s.name === name.value) ?? skills[0]);

/** 依赖链：直接依赖方 + 依赖方再被依赖的两跳展开 */
const chain = computed(() =>
  skill.value.dependents.map((d) => ({
    target: d,
    reason: '声明依赖本技能的指令与工具集（卸载后其必需工具缺失 → 拒绝激活）',
  })),
);

const forceOpen = ref(false);
const forceReason = ref('');
const forceReady = computed(() => forceReason.value.trim().length >= 10);

const options = skills.map((s) => ({ label: `${s.name}@${s.version}`, value: s.name }));

function uninstall(kind: 'normal' | 'force') {
  if (kind === 'force') forceOpen.value = true;
  else MessagePlugin.success(`已卸载 ${skill.value.name}：装配已解除、配置保留；10 秒内可撤销（oc skill undo）`);
}

function confirmForce() {
  forceOpen.value = false;
  MessagePlugin.warning(
    `已强制卸载 ${skill.value.name}：理由已写入审计（${forceReason.value}）；依赖方 ${chain.value.length} 项将在下次装配时拒绝激活`,
  );
  router.push('/extension/skills');
}

function disable() {
  MessagePlugin.info('已禁用（保留安装与配置）：随时可启用，不需要重新授权能力声明');
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/skills/uninstall', () => skills.some((s) => s.name === name.value));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="卸载与禁用确认"
      desc="卸载会解除装配并清理运行时缓存（配置保留 30 天）；被依赖的技能需显式强制卸载并填写理由。"
      volume="卷 08" manifest="K-05" :cli="`oc skill remove ${skill.name} --check-deps`"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/skills')">返回</Button>
        <Button size="small" variant="outline" @click="disable">仅禁用（可逆）</Button>
        <Popconfirm
          :content="`卸载 ${skill.name} 将解除其工具/钩子注册并清空运行时缓存；10 秒内可撤销。`"
          theme="warning"
          @confirm="uninstall('normal')"
        >
          <Button size="small" theme="danger" variant="outline">卸载</Button>
        </Popconfirm>
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


    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <span class="oc-secondary" style="font-size: 12px">选择技能</span>
        <Select v-model="name" size="small" :options="options" style="width: 340px" filterable />
        <Tag size="small" variant="outline">{{ skill.installState }}</Tag>
        <Tag size="small" variant="outline">{{ SKILL_SOURCE_LABEL[skill.source] }}</Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          依赖链（卸载前检查）
          <Tag size="small" :theme="chain.length ? 'warning' : 'success'" variant="light-outline">
            {{ chain.length ? `${chain.length} 个依赖方` : '无依赖方' }}
          </Tag>
        </h3>
        <Alert
          v-if="chain.length"
          theme="warning"
          message="存在依赖方：普通卸载会被拒绝"
          description="依赖保护（卷 08 §4.5）：被其它技能依赖时必须显式强制卸载，并记录原因以便追溯。"
        />
        <Table
          v-if="chain.length"
          row-key="target"
          size="small"
          :columns="[
            { colKey: 'target', title: '依赖方', width: 280 },
            { colKey: 'reason', title: '影响' },
          ]"
          :data="chain"
        >
          <template #target="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.target }}</span></template>
        </Table>
        <div v-else class="oc-muted" style="font-size: 12px">无其它技能/插件依赖本技能，普通卸载即可完成。</div>
      </div>

      <div class="oc-stack" style="gap: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">后果与撤销</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'a', label: '卸载后影响', value: '工具/钩子注册解除；依赖方下次装配将因缺少必需工具而拒绝激活（显式报错，不静默降级）' },
              { key: 'b', label: '保留内容', value: '配置与能力授权记录保留 30 天；锁文件保留以便复现' },
              { key: 'c', label: '撤销窗口', value: '10 秒（oc skill undo <name>），窗口内恢复为原状态' },
              { key: 'd', label: '可逆替代', value: '优先使用「仅禁用」：不解除安装，随时可启用' },
            ]"
          />
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">强制卸载（需理由）</h3>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 6px">
            强制卸载会跳过依赖保护；不解除依赖方，仅记录审计并让依赖方在下次装配时失败。
          </div>
          <Tooltip content="理由将写入审计事件 skill.removed（force=true），供合规追溯">
            <Button size="small" theme="danger" variant="outline" @click="uninstall('force')">
              <OcIcon name="delete" size="12px" /> 强制卸载
            </Button>
          </Tooltip>
          <div style="margin-top: 8px">
            <CopyableId id="trace-remove-a91f02" label="上次卸载 traceId" :short="16" />
          </div>
        </div>
      </div>
    </div>

    <Dialog
      v-model:visible="forceOpen"
      header="强制卸载确认"
      :confirm-btn="{ content: '确认强制卸载', theme: 'danger', disabled: !forceReady }"
      @confirm="confirmForce"
      width="560px"
    >
      <Alert
        theme="error"
        message="该操作跳过依赖保护，不可撤销（没有撤销窗口）"
        :description="`依赖方：${chain.map((c) => c.target).join('、') || '无'}；它们将在下次装配时以「必需工具缺失」拒绝激活。`"
      />
      <div style="margin-top: 12px">
        <div class="oc-secondary" style="font-size: 12px; margin-bottom: 4px">卸载理由（必填，≥10 字）</div>
        <Textarea v-model="forceReason" placeholder="例如：该技能持续劣化（成功率 54%），已用 acme.platform.java-refactor 替代，需清理避免误装配" :autosize="{ minRows: 3 }" />
      </div>
    </Dialog>
    </StateShell>
  </div>
</template>
