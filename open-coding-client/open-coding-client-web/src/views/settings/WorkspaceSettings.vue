<script setup lang="ts">
/**
 * 工作区设置（O-01）：默认工作区类型 / .ocignore 忽略规则（带校验）/ .oc/env.yaml 环境清单与探测 / 多工作区绑定与写范围 / 配额。
 * 忽略规则与绑定写范围共同决定「哪些路径可被 Agent 读写」，校验不通过不允许保存。溯源：卷 20 §4.1。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Progress, RadioButton, RadioGroup, Table, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { useUiStore } from '@/stores/ui';
import { platformData } from '@/mock/data/platform';

type WsType = 'local' | 'ssh' | 'container' | 'cloud';

const ui = useUiStore();
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
const wsType = ref<WsType>('local');
const probing = ref(false); const probedAt = ref(''); const workspace = platformData.workspaces[0];

const TYPE_META: Record<WsType, string> = {
  local: '本地：零配置直连本机目录；隔离依赖沙箱档位（L0–L3）', ssh: 'SSH：远程主机执行；需声明 host/jumpHost 与凭证引用',
  container: '容器：一次性镜像内运行；网络与路径默认拒绝', cloud: '云开发机：长驻实例 + 弹性配额；数据驻留受区域约束',
};

const ignoreText = ref(`# .ocignore — 相对工作区根目录，禁止绝对路径
.git/
target/
node_modules/
dist/
secrets/**
.oc/
`);

/** 忽略规则校验：围栏语义要求相对路径 + 必须保留 .oc/ 自身排除 */
const ignoreErrors = computed(() => {
  const errs: string[] = [];
  const lines = ignoreText.value.split('\n').map((l) => l.trim()).filter(Boolean);
  const abs = lines.filter((l) => !l.startsWith('#') && l.startsWith('/'));
  if (abs.length) errs.push(`第 ${abs.map((a) => lines.indexOf(a) + 1).join('、')} 行为绝对路径：工作区围栏只接受相对路径`);
  if (lines.length > 200) errs.push(`共 ${lines.length} 行，超过 200 行上限（超出会显著拖慢遍历）`);
  if (!lines.some((l) => l.startsWith('.oc/'))) errs.push('缺少 `.oc/` 排除：内核运行态目录不应进入上下文');
  return errs;
});

const envYaml = computed(() => `# .oc/env.yaml — 环境清单（可提交，凭证一律用引用）
languages: [java, typescript]
toolchain: [maven, node, git]
resources: { cpu: ${workspace?.envProfile.resources.cpuCores ?? 8}, memoryGb: ${workspace?.envProfile.resources.memoryGb ?? 16}, diskFreeGb: ${workspace?.envProfile.resources.diskFreeGb ?? 120} }
network: deny-by-default
`);

const envDiff = computed(() => workspace?.envProfile.diffFromManifest ?? []);
const bindingColumns = [
  { colKey: 'subjectKind', title: '对象类型', width: 110 }, { colKey: 'subjectId', title: '对象', width: 160 },
  { colKey: 'role', title: '角色', width: 100 }, { colKey: 'scope', title: '写范围', ellipsis: true },
];

function probe() {
  probing.value = true;
  window.setTimeout(() => {
    probing.value = false;
    probedAt.value = new Date().toLocaleTimeString('zh-CN');
    ui.track('settings.workspace.probed', { workspaceId: workspace?.workspaceId ?? '' });
    MessagePlugin.success('环境探测完成：以清单为准对比实际环境，差异项已显式列出（不静默修正）');
  }, 900);
}

function save() {
  if (ignoreErrors.value.length) { MessagePlugin.error('忽略规则校验未通过，已阻止保存（围栏语义不允许绝对路径）'); return; }
  MessagePlugin.success(`工作区设置已保存：类型 ${wsType.value} · 忽略规则 ${ignoreText.value.split('\n').filter(Boolean).length} 行`);
}

onMounted(() => {
  window.setTimeout(() => { state.value = workspace ? 'NORMAL' : 'EMPTY'; }, 220);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="工作区设置" volume="卷 20" manifest="O-01"
      desc="默认工作区类型、忽略规则与环境清单；多工作区按主/关联绑定并声明写范围，配额超限会暂停执行。"
      cli="oc workspace settings --type local --ignore .ocignore --env .oc/env.yaml"
      :status="[{ label: `类型 ${wsType}`, theme: 'primary' }, { label: '写范围受绑定约束', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" :loading="probing" @click="probe">探测环境</Button>
        <Button size="small" theme="primary" @click="save">保存设置</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state" trace-id="trace-ws-51d0" :page-size="6"
      empty-title="没有可用工作区" empty-desc="尚未创建工作区（本地目录未授权或远程连接未配置），Agent 无执行落点。"
      empty-action="创建工作区" example-task="把 node_modules 与 secrets/** 加入忽略规则，再运行一次环境探测"
      what="工作区设置加载失败" why="工作区元数据读取失败（连接配置的凭证引用不可解析）"
      how="可重试；失败时保持上一份已生效的忽略规则，不会放宽围栏"
      collapsed-summary="环境差异项超过阈值，仅展开前 6 条（其余按严重度折叠）。"
      @retry="state = 'LOADING'" @empty-action="MessagePlugin.info('已打开工作区创建向导')"
    >
      <div class="oc-grid oc-grid--2">
        <div class="oc-card">
          <div class="oc-card__title">默认工作区类型</div>
          <RadioGroup v-model="wsType">
            <RadioButton value="local">local</RadioButton><RadioButton value="ssh">ssh</RadioButton>
            <RadioButton value="container">container</RadioButton><RadioButton value="cloud">cloud</RadioButton>
          </RadioGroup>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">影响：{{ TYPE_META[wsType] }}；切换类型会重新校验路径围栏与网络域，不改变已有绑定。</div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">环境清单（.oc/env.yaml）</div>
          <JsonBlock :value="envYaml" :collapse-over="140" label=".oc/env.yaml" />
          <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px; align-items: center">
            <Button size="small" variant="outline" :loading="probing" @click="probe">探测环境</Button>
            <span class="oc-muted" style="font-size: 12px">上次探测：{{ probedAt || workspace?.envProfile.probedAt?.slice(0, 16).replace('T', ' ') || '未探测' }}</span>
          </div>
          <div class="oc-stack" style="gap: 4px; margin-top: 8px">
            <div v-for="d in envDiff.slice(0, 4)" :key="d.tool" class="oc-flex oc-flex--wrap" style="gap: 6px; align-items: center">
              <Tag size="small" :theme="d.severity === 'major' ? 'danger' : d.severity === 'minor' ? 'warning' : 'success'" variant="light-outline">{{ d.severity }}</Tag>
              <span class="oc-mono" style="font-size: 11px">{{ d.tool }}</span><span class="oc-muted" style="font-size: 12px">期望 {{ d.expected }} / 实际 {{ d.actual }} → {{ d.action }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">忽略规则（.ocignore）</div>
          <Textarea v-model="ignoreText" :autosize="{ minRows: 6, maxRows: 10 }" placeholder="每行一个相对路径 glob；! 前缀表示重新包含" />
          <div v-if="ignoreErrors.length" class="oc-stack" style="gap: 4px; margin-top: 6px">
            <div v-for="e in ignoreErrors" :key="e" class="oc-flex" style="gap: 6px; align-items: center">
              <OcIcon name="error" size="13px" color="var(--td-error-color)" /><span style="font-size: 12px">{{ e }}</span>
            </div>
          </div>
          <div v-else class="oc-flex" style="gap: 6px; margin-top: 6px; align-items: center">
            <OcIcon name="check" size="13px" color="var(--td-success-color)" /><span class="oc-muted" style="font-size: 12px">校验通过：相对路径、行数合规、已排除 .oc/ 运行态目录。</span>
          </div>
        </div>

        <div class="oc-card">
          <div class="oc-card__title">多工作区绑定与写范围</div>
          <Table :data="workspace?.bindings ?? []" row-key="subjectId" size="small" :columns="bindingColumns" :pagination="undefined">
            <template #role="{ row }"><Tag size="small" :theme="row.role === 'primary' ? 'primary' : 'default'" variant="light-outline">{{ row.role === 'primary' ? '主工作区' : '关联' }}</Tag></template>
            <template #scope="{ row }"><span class="oc-mono" style="font-size: 11px">{{ row.writeScope.join(' · ') }}</span></template>
          </Table>
          <div class="oc-muted" style="font-size: 12px; margin-top: 6px">
            写范围硬约束：关联工作区默认只读；跨区写入必须命中 crossGrant 声明，否则拒绝并审计（不静默降级为只读）。
          </div>
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">配额提示</div>
        <div class="oc-grid oc-grid--2">
          <div>
            <div class="oc-flex oc-flex--between" style="font-size: 12px">
              <span>磁盘使用率</span><span class="oc-mono">{{ Math.round((workspace?.quota.diskUsedRatio ?? 0) * 100) }}%</span>
            </div>
            <Progress :percentage="Math.round((workspace?.quota.diskUsedRatio ?? 0) * 100)" :status="(workspace?.quota.diskUsedRatio ?? 0) > 0.85 ? 'warning' : 'success'" :label="false" size="small" />
          </div>
          <InfoGrid :columns="3" :items="[
            { key: 'cpu', label: 'CPU', value: `${workspace?.quota.cpu ?? 0} 核` }, { key: 'mem', label: '内存', value: `${workspace?.quota.memory ?? 0} GiB` }, { key: 'net', label: '网络流量', value: workspace?.quota.networkTraffic ?? '—' },
            { key: 'limit', label: '总配额', value: workspace?.quota.limit ?? '—' }, { key: 'paused', label: '暂停状态', value: workspace?.quota.paused ? '已暂停（超限）' : '正常' }, { key: 'inode', label: 'inode', value: workspace?.quota.inodeCount ?? 0 },
          ]" />
        </div>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc workspace settings --probe-env --show-quota" />
          <CopyableId id="trace-ws-51d0" label="复制 traceId" />
        </div>
      </div>
    </StateShell>
  </div>
</template>
