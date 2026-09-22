<script setup lang="ts">
/**
 * 插件开发者控制台（L-06）：脚手架 / 热重载调试 / 测试夹具 / 契约测试 / 打包签名 / 发布私仓。
 * 溯源：卷 18 §4.5 开发套件；发布仅到组织私仓（企业策略禁用公共市场）。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin, StepItem, Steps, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';

const router = useRouter();
const step = ref(0);
const pkg = ref({ id: 'com.acme.sample-plugin', name: '示例插件', version: '0.1.0', kernel: '>=1.2 <2.0' });
const log = ref('');
const busy = ref(false);
const hotReload = ref(false);

const stages = [
  { title: '① 脚手架', cmd: 'oc-plugin init com.acme.sample-plugin', desc: '生成清单 + 骨架 + 示例扩展点 + 测试夹具' },
  { title: '② 本地调试', cmd: 'oc-plugin dev --hot-reload', desc: '内存内核 + 假模型 + 假工具 + 假事件总线；热重载（先禁用后启用）' },
  { title: '③ 契约测试', cmd: 'oc-plugin test --contract --kernel 1.3', desc: '自动跑扩展点契约用例，校验与目标内核的兼容性' },
  { title: '④ 打包签名', cmd: 'oc-plugin package --sign', desc: '产物 + 清单 + 签名（私钥离线，平台仅存公钥）' },
  { title: '⑤ 发布私仓', cmd: 'oc-plugin publish --channel org-registry', desc: '上传制品与契约报告，等待管理员审核' },
];

const artifacts = computed(() => [
  { path: 'dist/com.acme.sample-plugin-0.1.0.jar', size: '412 KB', note: 'JVM 字节码 + 平台标记' },
  { path: 'dist/plugin.json', size: '3.1 KB', note: '清单（扩展点 / 权限 / 资源 / 配置 Schema）' },
  { path: 'dist/manifest.sig', size: '96 B', note: 'Ed25519 签名' },
  { path: 'dist/contract-report.json', size: '18 KB', note: '契约测试报告（含内核版本矩阵）' },
]);

function run(i: number) {
  busy.value = true;
  step.value = i;
  log.value = `$ ${stages[i].cmd}\n`;
  window.setTimeout(() => {
    busy.value = false;
    log.value += i === 2 ? '✔ 契约用例 24/24 通过（内核 1.2 / 1.3）\n' : i === 3 ? '✔ 已生成签名：fingerprint ed:2c:4a:c1\n' : `✔ ${stages[i].title} 完成\n`;
    if (i === 1) hotReload.value = true;
    MessagePlugin.success(`${stages[i].title}完成`);
  }, 700);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/plugins/dev-console', () => true);
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="插件开发者控制台"
      desc="从脚手架到私仓发布的全链路：热重载调试、契约测试、打包签名；发布需管理员审核（公共市场已禁用）。"
      volume="卷 18" manifest="L-06" cli="oc-plugin init <id> && oc-plugin dev"
      :status="[{ label: '私仓发布', theme: 'primary' }, { label: hotReload ? '热重载已连接' : '未连接内核', theme: hotReload ? 'success' : 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/plugins')">返回市场</Button>
        <Button size="small" variant="outline" @click="router.push('/extension/plugins/compatibility')">兼容矩阵</Button>
        <Button size="small" theme="primary" :loading="busy" @click="run(4)">发布到私仓</Button>
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


    <Steps :current="step" size="small">
      <StepItem v-for="s in stages" :key="s.title" :title="s.title" :content="s.desc" />
    </Steps>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">插件标识</h3>
        <div class="oc-stack" style="gap: 8px">
          <Input v-model="pkg.id" size="small" label="插件 id（反向域名）" placeholder="com.acme.my-plugin" />
          <Input v-model="pkg.name" size="small" label="显示名" />
          <Input v-model="pkg.version" size="small" label="版本（语义化）" />
          <Input v-model="pkg.kernel" size="small" label="内核兼容区间" />
        </div>
        <Alert
          style="margin-top: 10px"
          theme="info"
          message="权限最小化"
          description="清单声明的权限不得超过安装者权限（无权限放大）；密钥字段只写 SecretPort 引用，不得明文。"
        />
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          流水线动作
          <Tag size="small" variant="outline">按顺序执行</Tag>
        </h3>
        <div class="oc-stack" style="gap: 8px">
          <div v-for="(s, i) in stages" :key="s.title" class="oc-flex oc-flex--wrap" style="gap: 8px">
            <Button size="small" :variant="i === step ? 'base' : 'outline'" :theme="i === step ? 'primary' : 'default'" :loading="busy && step === i" @click="run(i)">
              {{ s.title }}
            </Button>
            <span class="oc-mono oc-muted" style="font-size: 12px">{{ s.cmd }}</span>
          </div>
        </div>
        <div class="oc-flex" style="gap: 8px; margin-top: 10px">
          <CliHint command="oc-plugin dev --hot-reload --break" />
          <span class="oc-muted" style="font-size: 12px">热重载边界：仅 reloadable=true 的插件支持；状态需插件自管</span>
        </div>
      </div>
    </div>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">控制台输出</h3>
        <JsonBlock :value="log || '$ 等待执行…（选择上方动作开始）'" label="stdout（夹具内核）" :collapse-over="220" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">打包产物</h3>
        <div v-for="a in artifacts" :key="a.path" class="oc-flex" style="gap: 8px; padding: 5px 0; border-bottom: 1px dashed var(--oc-border)">
          <OcIcon name="file" size="13px" />
          <span class="oc-mono oc-grow" style="font-size: 12px">{{ a.path }}</span>
          <span class="oc-mono oc-muted" style="font-size: 12px">{{ a.size }}</span>
          <span class="oc-muted oc-truncate" style="font-size: 11px; max-width: 160px">{{ a.note }}</span>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
          发布拦截：签名缺失 / 契约测试未通过 / 清单权限超范围 → 拒绝发布并给出可操作建议（不静默略过）。
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
