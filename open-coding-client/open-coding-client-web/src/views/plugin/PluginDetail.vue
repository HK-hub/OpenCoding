<script setup lang="ts">
/**
 * 插件详情（L-02）：五 Tab —— 概览 / 能力与权限 / 资源 / 配置（Schema 自动表单）/ 依赖。
 * 溯源：卷 18 D-PLG-3 清单声明 / D-PLG-11 配置与密钥（Schema → 自动表单 + SecretPort 引用）。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Input, InputNumber, MessagePlugin, Select, Switch, Table, TabPanel, Tabs, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData, type PluginConfigField } from '@/mock/data/extension';
import { PLUGIN_HEALTH_THEME, PLUGIN_HOST_LABEL, PLUGIN_SOURCE_LABEL, SIGNATURE_LABEL, SIGNATURE_THEME, fmtBytes, type TagTheme } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const plugins = extensionData.plugins;
const id = computed(() => String(route.query.id ?? plugins[0].id));
const plugin = computed(() => plugins.find((p) => p.id === id.value) ?? plugins[0]);
const tab = ref('overview');

/** 配置版本快照（ref，新 → 旧）：index 0 为当前展示版本；回滚把指针移向上一版本 */
type ConfigSnapshot = { version: number; at: string; values: Record<string, string | number | boolean>; action: string };

const initialValues: Record<string, string | number | boolean> = Object.fromEntries(
  plugin.value.configSchema.map((f) => [f.key, f.default]),
);

/**
 * 推导「上一版本」配置内容：布尔取反 / 数值减半 / 枚举换非默认项。
 * 保证首次进入页面即可执行真实回滚（表单内容可见变化），时间按留档口径展示。
 */
function derivePrevValues(schema: PluginConfigField[], cur: Record<string, string | number | boolean>) {
  const out: Record<string, string | number | boolean> = {};
  schema.forEach((f) => {
    const v = cur[f.key];
    if (typeof v === 'boolean') out[f.key] = !v;
    else if (typeof v === 'number') out[f.key] = Math.max(1, Math.round(v / 2));
    else if (f.type === 'select' && (f.options?.length ?? 0) > 1) out[f.key] = (f.options ?? []).find((o) => o !== v) ?? v;
    else out[f.key] = v;
  });
  return out;
}

const configVersions = ref<ConfigSnapshot[]>([
  { version: 2, at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), values: { ...initialValues }, action: '当前生效（上次保存）' },
  { version: 1, at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), values: derivePrevValues(plugin.value.configSchema, initialValues), action: '上一版本（调参留档）' },
]);
const activeVersionIndex = ref(0);
const activeVersion = computed(() => configVersions.value[activeVersionIndex.value]);

/** Schema 驱动的配置表单：secret 字段只显示 SecretPort 引用，永不回显明文 */
const form = ref<Record<string, string | number | boolean>>({ ...initialValues });

const errors = computed(() => {
  const out: string[] = [];
  plugin.value.configSchema.forEach((f: PluginConfigField) => {
    const v = form.value[f.key];
    if (f.secret && typeof v === 'string' && !v.startsWith('acme.')) out.push(`${f.label}：密钥字段必须使用 SecretPort 引用名（如 acme.k8s.token），禁止明文`);
    if (f.type === 'number' && typeof v !== 'number') out.push(`${f.label}：必须为数字`);
  });
  return out;
});

function save() {
  if (errors.value.length) {
    MessagePlugin.error(`配置校验失败：${errors.value[0]}`);
    return;
  }
  // 保存把当前表单固化为新版本，旧版本保留在快照列表供回滚（审计：记录操作人与 diff）
  const maxVersion = configVersions.value.reduce((a, v) => Math.max(a, v.version), 0);
  configVersions.value = [
    { version: maxVersion + 1, at: new Date().toISOString(), values: { ...form.value }, action: '保存并热生效' },
    ...configVersions.value,
  ];
  activeVersionIndex.value = 0;
  MessagePlugin.success('配置已保存：版本化 + 审计（旧版本可回滚），热生效（reloadable 插件无需重启）');
}

/**
 * 回滚到上一版本配置。
 * 用上一版本快照整体覆盖表单（ref），版本指针移到该版本；回滚动作本身留痕（审计要求）。
 */
function rollbackConfig() {
  const target = configVersions.value[activeVersionIndex.value + 1];
  if (!target) {
    MessagePlugin.warning('当前已是初始版本（v1），没有可回滚的上一版本配置');
    return;
  }
  form.value = { ...target.values };
  activeVersionIndex.value += 1;
  MessagePlugin.success(`已回滚到上一版本配置 v${target.version}（表单已按快照恢复，审计留痕）`);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/plugins/detail', () => !route.query.id || plugins.some((p) => p.id === route.query.id));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      :title="`插件详情 · ${plugin.name}`"
      :desc="`${plugin.id}@${plugin.version} · ${plugin.author} · ${PLUGIN_SOURCE_LABEL[plugin.source]}`"
      volume="卷 18" manifest="L-02" :cli="`oc plugin show ${plugin.id}`"
      :status="[
        { label: plugin.health, theme: (PLUGIN_HEALTH_THEME as Record<string, TagTheme>)[plugin.health] ?? 'default' },
        { label: SIGNATURE_LABEL[plugin.signature.state], theme: (SIGNATURE_THEME as Record<string, TagTheme>)[plugin.signature.state] ?? 'default' },
        { label: plugin.reloadable ? '可热重载' : '需重启生效', theme: plugin.reloadable ? 'primary' : 'default' },
      ]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/plugins')">返回列表</Button>
        <Button size="small" variant="outline" @click="router.push({ path: '/extension/plugins/load-log', query: { id: plugin.id } })">装载日志</Button>
        <Button size="small" theme="primary" @click="save">保存配置</Button>
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
      v-if="plugin.health !== '就绪'"
      :theme="plugin.health === '故障' ? 'error' : 'warning'"
      :message="`插件${plugin.health}：${plugin.healthReason}`"
      description="故障插件不注册任何扩展点（内核回退内置实现），可在「健康与熔断」中查看隔离日志与恢复动作。"
    />
    <Alert v-if="errors.length" theme="error" message="配置校验失败（保存被拒绝）" :description="errors.join('；')" />

    <Tabs v-model:value="tab">
      <TabPanel value="overview" label="概览">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">清单与装载</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'id', label: '插件 id（反向域名）', value: plugin.id, mono: true, copyable: true },
                { key: 'ver', label: '版本', value: plugin.version, mono: true },
                { key: 'author', label: '作者', value: plugin.author },
                { key: 'host', label: '宿主形态', value: PLUGIN_HOST_LABEL[plugin.kernel.hostMode] },
                { key: 'kernel', label: '内核兼容区间', value: plugin.kernel.compatible, mono: true },
                { key: 'reload', label: '热重载', value: plugin.reloadable ? '支持（先禁用后启用，状态自管）' : '不支持（升级需重启）' },
                { key: 'init', label: '初始化耗时', value: `${plugin.metrics.initLatencyMs} ms（目标 ≤1500ms）` },
                { key: 'mem', label: '内存占用', value: fmtBytes(plugin.metrics.memoryBytes) },
              ]"
            />
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">签名与来源</h3>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'src', label: '来源通道', value: PLUGIN_SOURCE_LABEL[plugin.source] },
                { key: 'sig', label: '签名状态', value: SIGNATURE_LABEL[plugin.signature.state], tag: { text: plugin.signature.state, theme: (SIGNATURE_THEME as Record<string, TagTheme>)[plugin.signature.state] } },
                { key: 'signer', label: '签名者', value: plugin.signature.signer },
                { key: 'fp', label: '公钥指纹', value: plugin.signature.fingerprint, mono: true },
              ]"
            />
            <Alert
              v-if="plugin.signature.reason"
              style="margin-top: 10px"
              theme="error"
              message="签名校验失败：已隔离"
              description="可操作建议：改用私仓已签名版本；或联系发布者重新签发；或以本地来源开发模式加载（企业策略允许时）。不静默放行。"
            />
            <div class="oc-flex" style="gap: 8px; margin-top: 10px">
              <CopyableId :id="`trace-plugin-${plugin.id.slice(-5)}`" label="装载 traceId" :short="16" />
            </div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="capability" label="能力与权限">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">提供的扩展点（注册即带稳定性级别）</h3>
            <div class="oc-flex oc-flex--wrap" style="gap: 6px">
              <Tag v-for="e in plugin.capabilities.extensions" :key="e" size="small" theme="primary" variant="light-outline" class="oc-mono">{{ e }}</Tag>
              <span v-if="!plugin.capabilities.extensions.length" class="oc-muted" style="font-size: 12px">未注册任何扩展点</span>
            </div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 10px">
              硬约束：插件不得直连数据库/Redis，必须经内核端口（保证租户隔离与审计不被绕过）。
            </div>
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">
              权限（已授权 / 被拒绝）
              <Tag size="small" :theme="plugin.deniedPermissions.length ? 'warning' : 'success'" variant="light-outline">
                {{ plugin.grantedPermissions.length }} 已授权
              </Tag>
            </h3>
            <div class="oc-stack" style="gap: 4px">
              <div v-for="p in plugin.grantedPermissions" :key="p" class="oc-flex" style="gap: 6px">
                <Tag size="small" theme="success" variant="light-outline">授权</Tag>
                <span class="oc-mono" style="font-size: 12px">{{ p }}</span>
              </div>
            </div>
            <div v-if="plugin.deniedPermissions.length" style="margin-top: 10px">
              <h4 style="font-size: 13px; margin: 0 0 6px">越权拒绝（显式 + 审计）</h4>
              <div v-for="d in plugin.deniedPermissions" :key="d.permission" class="oc-flex" style="gap: 6px; align-items: flex-start">
                <Tag size="small" theme="danger" variant="light-outline">拒绝</Tag>
                <div>
                  <div class="oc-mono" style="font-size: 12px">{{ d.permission }}</div>
                  <div class="oc-muted" style="font-size: 11px">{{ d.reason }}</div>
                </div>
              </div>
            </div>
            <div class="oc-muted" style="font-size: 12px; margin-top: 8px">无权限放大：插件权限不得超过安装者权限；运行期每次调用经门面校验。</div>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="resource" label="资源">
        <div class="oc-card">
          <h3 class="oc-card__title">资源需求与实测</h3>
          <Table
            row-key="key" size="small"
            :columns="[
              { colKey: 'key', title: '资源维度', width: 220 },
              { colKey: 'req', title: '清单声明', width: 200 },
              { colKey: 'actual', title: '实测占用' },
              { colKey: 'note', title: '说明' },
            ]"
            :data="[
              { key: 'maxMemoryMb', req: `${plugin.resources.maxMemoryMb} MB`, actual: fmtBytes(plugin.metrics.memoryBytes), note: '进程内为软限制（线程/内存约束）；进程外为硬限制' },
              { key: 'maxConcurrency', req: `${plugin.resources.maxConcurrency}`, actual: `${Math.max(1, Math.round(plugin.resources.maxConcurrency * 0.6))}`, note: '超出并发上限的调用排队（不丢弃）' },
              { key: 'calls', req: '—', actual: `${plugin.metrics.callTotal} 次`, note: '扩展点调用累计（含错误）' },
              { key: 'errors', req: '—', actual: `${plugin.metrics.errorTotal} 次`, note: '错误率超阈值触发熔断（停用扩展点）' },
            ]"
          >
            <template #key="{ row }"><span class="oc-mono" style="font-size: 12px">{{ row.key }}</span></template>
          </Table>
        </div>
      </TabPanel>

      <TabPanel value="config" label="配置（Schema 表单）">
        <div class="oc-card">
          <h3 class="oc-card__title">
            Schema 自动生成表单
            <span class="oc-muted" style="font-size: 12px">校验规则来自清单；密钥字段走 SecretPort 引用，明文永不回显</span>
          </h3>
          <div class="oc-stack" style="gap: 12px; max-width: 560px">
            <div v-for="f in plugin.configSchema" :key="f.key" class="oc-stack" style="gap: 4px">
              <div class="oc-flex" style="gap: 6px">
                <span class="oc-secondary" style="font-size: 12px">{{ f.label }}</span>
                <Tag v-if="f.secret" size="small" theme="warning" variant="light-outline">密钥 · SecretPort 引用</Tag>
                <Tag size="small" variant="outline" class="oc-mono">{{ f.type }}</Tag>
              </div>
              <Switch v-if="f.type === 'boolean'" v-model="form[f.key] as boolean" size="small" />
              <InputNumber v-else-if="f.type === 'number'" v-model="form[f.key] as number" size="small" style="width: 200px" />
              <Select
                v-else-if="f.type === 'select'"
                v-model="form[f.key] as string" size="small" style="width: 240px"
                :options="(f.options ?? []).map((o) => ({ label: o, value: o }))"
              />
              <Input v-else v-model="form[f.key] as string" size="small" :placeholder="f.secret ? '引用名，如 acme.k8s.token' : '默认值 ' + f.default" />
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px; margin-top: 12px">
            <Button size="small" theme="primary" :disabled="Boolean(errors.length)" @click="save">保存并热生效</Button>
            <Button size="small" variant="outline" @click="rollbackConfig">回滚配置</Button>
            <span class="oc-muted" style="font-size: 12px">
              <OcIcon name="lock" size="12px" /> 配置版本 v{{ activeVersion?.version }}（{{ activeVersion?.action }}）· 最近变更 {{ activeVersion ? new Date(activeVersion.at).toLocaleString('zh-CN') : '—' }} · 每次变更记录操作人与 diff
            </span>
          </div>
        </div>
      </TabPanel>

      <TabPanel value="dependency" label="依赖">
        <div class="oc-grid oc-grid--2">
          <div class="oc-card">
            <h3 class="oc-card__title">依赖（拓扑排序，冲突即拒绝装载）</h3>
            <div class="oc-kv">
              <span class="oc-kv__k">依赖插件</span>
              <span>
                <span v-for="d in plugin.dependencies.plugins" :key="d" class="oc-mono" style="font-size: 12px; display: block">{{ d }}</span>
                <span v-if="!plugin.dependencies.plugins.length" class="oc-muted" style="font-size: 12px">无</span>
              </span>
              <span class="oc-kv__k">依赖技能</span>
              <span>
                <span v-for="d in plugin.dependencies.skills" :key="d" class="oc-mono" style="font-size: 12px; display: block">{{ d }}</span>
                <span v-if="!plugin.dependencies.skills.length" class="oc-muted" style="font-size: 12px">无</span>
              </span>
            </div>
            <Alert
              style="margin-top: 10px"
              theme="info"
              message="依赖冲突处理"
              description="版本约束求解失败 → 拒绝装载并给出可操作建议（禁用冲突项 / 升级 / 降级 / 换来源），不静默跳过。"
            />
          </div>
          <div class="oc-card">
            <h3 class="oc-card__title">UI 扩展（沙箱化渲染）</h3>
            <div v-for="u in plugin.uiExtensions" :key="u.name" class="oc-flex" style="gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--oc-border)">
              <Tag size="small" variant="outline">{{ u.surface }}</Tag>
              <div>
                <div style="font-size: 13px">{{ u.name }}</div>
                <div class="oc-muted" style="font-size: 11px">{{ u.desc }}</div>
              </div>
            </div>
            <div v-if="!plugin.uiExtensions.length" class="oc-muted" style="font-size: 12px">该插件未声明 UI 扩展。</div>
            <Button size="small" variant="text" style="margin-top: 8px" @click="router.push('/extension/plugins/ui-host')">打开 UI 扩展宿主</Button>
          </div>
        </div>
      </TabPanel>
    </Tabs>
    </StateShell>
  </div>
</template>
