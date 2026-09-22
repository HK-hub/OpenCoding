<script setup lang="ts">
/**
 * 插件升级与回滚（L-09）：版本迁移 + 兼容校验 + 升级/回滚（含后果说明与撤销）。
 * 溯源：卷 18 D-PLG-6 生命周期（升级 = 版本迁移 + 兼容校验；回滚 = 回上一版本）。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Popconfirm, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { PLUGIN_SOURCE_LABEL, SIGNATURE_LABEL, SIGNATURE_THEME, type TagTheme } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const plugins = extensionData.plugins.filter((p) => p.previousVersion);
const id = ref(String(route.query.id ?? plugins[0]?.id ?? extensionData.plugins[0].id));
const plugin = computed(() => extensionData.plugins.find((p) => p.id === id.value) ?? extensionData.plugins[0]);
const options = extensionData.plugins.map((p) => ({ label: `${p.name}（${p.version}）`, value: p.id }));
const targetVersion = ref('下一补丁版本');
const checking = ref(false);
const checked = ref(false);

/** 迁移检查：清单差异 + 配置 Schema 变化 + 兼容性 + 依赖 */
const migration = computed(() => ({
  from: plugin.value.previousVersion ?? '（首次安装）',
  to: plugin.value.version,
  kernel: plugin.value.kernel.compatible,
  configDiff: plugin.value.configSchema.map((f) => ({
    key: f.key,
    change: f.secret ? '密钥引用保持不变' : '默认值沿用（可在升级后调整）',
  })),
  permissions: plugin.value.capabilities.permissions.length,
  granted: plugin.value.grantedPermissions.length,
  needsRestart: !plugin.value.reloadable,
}));

const steps = computed(() => [
  { stage: '版本迁移脚本', ok: true, detail: `按 ${migration.value.from} → ${migration.value.to} 顺序执行（幂等，可重入）` },
  { stage: '兼容性校验', ok: true, detail: `内核 ${migration.value.kernel}；扩展点版本契约测试通过` },
  { stage: '权限复核', ok: true, detail: `新增权限 ${migration.value.permissions - migration.value.granted} 项（升级需重新授权，不自动继承）` },
  { stage: '配置迁移', ok: true, detail: '密钥引用名不变；新增字段使用默认值' },
  { stage: '回滚点创建', ok: true, detail: '保留上一版本制品与配置快照（可一键回滚）' },
]);

function runCheck() {
  checking.value = true;
  checked.value = false;
  window.setTimeout(() => {
    checking.value = false;
    checked.value = true;
    MessagePlugin.success('迁移检查通过：可执行升级（新增权限需在升级时重新授权）');
  }, 700);
}

function upgrade() {
  MessagePlugin.success(`已升级 ${plugin.value.name} 至 ${plugin.value.version}：装配重建完成，事件 plugin.updated 已记录`);
  router.push('/extension/plugins');
}

function rollback() {
  MessagePlugin.warning(`已回滚至 ${plugin.value.previousVersion}：配置快照同时回滚；回滚事件 plugin.rolled_back 已记录`);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/plugins/upgrade', () => extensionData.plugins.some((p) => p.id === id.value));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="插件升级与回滚"
      desc="升级 = 版本迁移 + 兼容校验 + 权限重新确认；回滚 = 回上一版本 + 配置快照回滚（可审计）。"
      volume="卷 18" manifest="L-09" :cli="`oc plugin upgrade ${plugin.id} --to ${targetVersion}`"
      :status="[
        { label: `当前 ${plugin.version}`, theme: 'primary' },
        { label: plugin.reloadable ? '可热重载' : '需重启生效', theme: plugin.reloadable ? 'success' : 'warning' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/plugins')">返回市场</Button>
        <Button size="small" variant="outline" :loading="checking" @click="runCheck">运行迁移检查</Button>
        <Popconfirm
          content="升级会重建扩展点装配；若需重启内核，升级窗口内相关能力暂不可用（显式标注）。新增权限需重新授权，不自动继承。"
          @confirm="upgrade"
        >
          <Button size="small" theme="primary" :disabled="!checked">执行升级</Button>
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


    <Alert
      v-if="migration.needsRestart"
      theme="warning"
      message="该插件不支持热重载：升级需重启内核"
      description="升级前请确认无运行中任务，或等待安全点；重启窗口内该插件扩展点不可用，界面会显式标注降级。"
    />
    <Alert
      v-else
      theme="info"
      message="支持热重载：先禁用后启用"
      description="热重载期间插件状态需自管（正在进行中的调用会完成或按幂等键重试）；失败自动回滚到旧版本。"
    />

    <div class="oc-card">
      <div class="oc-flex oc-flex--wrap" style="gap: 8px">
        <Select v-model="id" size="small" :options="options" style="width: 320px" filterable />
        <Select
          v-model="targetVersion" size="small" style="width: 200px"
          :options="[
            { label: '下一补丁版本（推荐）', value: '下一补丁版本' },
            { label: '指定版本（需兼容校验）', value: '指定版本' },
          ]"
        />
        <Tag size="small" variant="outline">{{ PLUGIN_SOURCE_LABEL[plugin.source] }}</Tag>
        <Tag size="small" :theme="(SIGNATURE_THEME as Record<string, TagTheme>)[plugin.signature.state] ?? 'default'" variant="light-outline">
          {{ SIGNATURE_LABEL[plugin.signature.state] }}
        </Tag>
      </div>
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">版本迁移检查（五步）</h3>
        <div v-for="s in steps" :key="s.stage" class="oc-flex" style="gap: 8px; align-items: flex-start; padding: 5px 0">
          <Tag size="small" :theme="checked ? (s.ok ? 'success' : 'danger') : 'default'" variant="light-outline">
            {{ checked ? (s.ok ? '通过' : '失败') : '待检' }}
          </Tag>
          <div>
            <div style="font-size: 13px">{{ s.stage }}</div>
            <div class="oc-muted" style="font-size: 12px">{{ checked ? s.detail : '点击「运行迁移检查」后展示' }}</div>
          </div>
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc plugin upgrade --dry-run --keep-rollback-point" />
          <span class="oc-muted" style="font-size: 12px">dry-run 仅评估不生效</span>
        </div>
      </div>

      <div class="oc-stack" style="gap: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">迁移摘要</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'from', label: '从', value: migration.from ?? '', mono: true },
              { key: 'to', label: '到', value: migration.to, mono: true },
              { key: 'kernel', label: '内核兼容区间', value: migration.kernel, mono: true },
              { key: 'perm', label: '权限（声明 / 已授权）', value: `${migration.permissions} / ${migration.granted}（新增项需重新授权）` },
              { key: 'cfg', label: '配置 Schema 项', value: `${migration.configDiff.length} 项（密钥引用名保持不变）` },
            ]"
          />
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">回滚与撤销</h3>
          <div class="oc-muted" style="font-size: 12px; margin-bottom: 8px">
            回滚点：上一版本制品 + 配置快照 + 授权记录；回滚后扩展点恢复旧实现，新增权限授权记录保留（审计可查）。
          </div>
          <Popconfirm
            :content="`回滚到 ${plugin.previousVersion}：将中断当前版本进行中的扩展点调用（按幂等键重试），配置同时回滚。`"
            theme="warning"
            @confirm="rollback"
          >
            <Button size="small" theme="danger" variant="outline">
              <OcIcon name="history" size="12px" /> 回滚到 {{ plugin.previousVersion ?? '上一版本' }}
            </Button>
          </Popconfirm>
          <div class="oc-flex" style="gap: 8px; margin-top: 10px">
            <CopyableId id="trace-plugin-upgrade-4b71" label="升级 traceId" :short="16" />
            <span class="oc-muted" style="font-size: 12px">事件：plugin.updated / plugin.rolled_back</span>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">配置项迁移明细</h3>
          <Table
            row-key="key" size="small"
            :columns="[
              { colKey: 'key', title: '配置键', width: 180 },
              { colKey: 'change', title: '迁移处理' },
            ]"
            :data="migration.configDiff"
          >
            <template #key="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.key }}</span></template>
          </Table>
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
