<script setup lang="ts">
/**
 * 安装确认（K-03）：能力声明逐条展示并可授权，未授权的能力显式拒绝（不静默放行）。
 * 溯源：卷 08 D-SKILL-6（能力声明 + 安装授权 + 运行期双重把关）/ §4.2 manifest。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, Checkbox, CheckboxGroup, MessagePlugin, StepItem, Steps, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { PERMISSION_MODE_LABEL, SIGNATURE_LABEL, SIGNATURE_THEME, SKILL_SOURCE_LABEL, type TagTheme } from '@/components/extension/useExtList';

const route = useRoute();
const router = useRouter();
const skills = extensionData.skills;
const name = computed(() => String(route.query.name ?? 'acme.qa.api-contract-test'));
const skill = computed(() => skills.find((s) => s.name === name.value) ?? skills[0]);

/** 逐条能力：可单独授权；未勾选项视为显式拒绝并记录审计 */
const capabilities = computed(() => {
  const c = skill.value.capabilities;
  const rows: { id: string; label: string; value: string; risk: string; why: string }[] = [];
  c.networkDomains.forEach((d, i) => rows.push({ id: `net-${i}`, label: `网络出网：${d}`, value: d, risk: 'R3 外发', why: '仅在声明域名内允许出网，超范围拒绝并审计' }));
  if (c.commandExecution) rows.push({ id: 'exec', label: '命令执行（沙箱内 L1）', value: 'sandbox:L1', risk: 'R2 执行', why: '脚本在沙箱内执行，受资源限制与路径围栏' });
  c.fileWriteScopes.forEach((p, i) => rows.push({ id: `write-${i}`, label: `文件写范围：${p}`, value: p, risk: 'R1 受控写', why: '越出范围的写入一律拒绝，不降级为只读' }));
  c.secretRefs.forEach((s, i) => rows.push({ id: `secret-${i}`, label: `密钥引用：${s}`, value: s, risk: 'R5 敏感', why: '仅引用名可见；明文经 SecretPort 注入，永不回显' }));
  if (c.subagent) rows.push({ id: 'subagent', label: '子 Agent 派生（深度 ≤2）', value: 'subagent:depth2', risk: 'R2 执行', why: '子 Agent 权限上限继承父级，不可放大' });
  return rows;
});

const granted = ref<string[]>(capabilities.value.map((c) => c.id));
const denied = computed(() => capabilities.value.filter((c) => !granted.value.includes(c.id)));
const installing = ref(false);

/** 权限收窄：技能建议模式不可高于当前会话模式 */
const narrowing = computed(() => {
  const order = ['readonly', 'plan', 'default', 'acceptEdits', 'autonomous', 'yolo'];
  const cur = 'default';
  const rec = skill.value.permissions.recommendedMode;
  const final = order.indexOf(rec) < order.indexOf(cur) ? rec : cur;
  return { cur, rec, final, narrowed: final !== rec };
});

function install() {
  if (denied.value.length) {
    MessagePlugin.warning(`已拒绝 ${denied.value.length} 项能力：技能以最小权限安装，被拒能力在运行期同样不可用（记录 skill.capability.denied）`);
  }
  installing.value = true;
  window.setTimeout(() => {
    installing.value = false;
    MessagePlugin.success(`已安装 ${skill.value.name}@${skill.value.version}：能力授权 ${granted.value.length} 项，锁文件已写入 ${skill.value.lockFile}`);
    router.push({ path: '/extension/skills', query: {} });
  }, 600);
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/skills/install', () => !route.query.name || skills.some((s) => s.name === route.query.name));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="安装确认"
      :desc="`${skill.name}@${skill.version} —— 安装即授权：先看清能力声明，再决定授予哪些。`"
      volume="卷 08" manifest="K-03" :cli="`oc skill install ${skill.name} --grant <capability>...`"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.back()">取消</Button>
        <Button size="small" theme="primary" :loading="installing" @click="install">
          <OcIcon name="download" size="12px" /> 同意并安装
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


    <Steps :current="1" size="small">
      <StepItem title="解析技能包" content="清单与签名已校验" />
      <StepItem title="授权能力声明" content="逐条确认（本页）" />
      <StepItem title="装配与激活" content="兼容性 + 必需工具校验后可选激活" />
    </Steps>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          能力声明逐条
          <span class="oc-muted" style="font-size: 12px">未勾选 = 显式拒绝（不静默降级）</span>
        </h3>
        <CheckboxGroup v-model="granted">
          <div v-for="c in capabilities" :key="c.id" class="oc-card" style="margin-bottom: 8px; padding: 10px 12px">
            <Checkbox :value="c.id">
              <span style="font-size: 13px">{{ c.label }}</span>
            </Checkbox>
            <div class="oc-flex" style="gap: 6px; margin-top: 4px; padding-left: 24px">
              <Tag size="small" variant="outline">{{ c.risk }}</Tag>
              <span class="oc-muted" style="font-size: 12px">{{ c.why }}</span>
            </div>
          </div>
        </CheckboxGroup>
        <Alert
          v-if="denied.length"
          theme="warning"
          :message="`已拒绝 ${denied.length} 项能力`"
          description="安装会继续，但被拒能力在运行期不可用；技能触发对应动作时将被显式拒绝并记录 skill.capability.denied 审计（不会静默跳过）。"
        />
        <div v-else class="oc-muted" style="font-size: 12px; margin-top: 8px">
          全部 {{ capabilities.length }} 项已授权；运行期仍逐动作走权限决策。
        </div>
      </div>

      <div class="oc-stack" style="gap: 12px">
        <div class="oc-card">
          <h3 class="oc-card__title">来源与签名</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'src', label: '来源', value: `${SKILL_SOURCE_LABEL[skill.source]} · ${skill.sourcePath}` },
              { key: 'sig', label: '签名状态', value: SIGNATURE_LABEL[skill.signature.state], tag: { text: skill.signature.state, theme: SIGNATURE_THEME[skill.signature.state] as TagTheme } },
              { key: 'signer', label: '签名者', value: skill.signature.signer },
              { key: 'fp', label: '指纹', value: skill.signature.fingerprint, mono: true },
              { key: 'deps', label: '依赖（安装时解析）', value: skill.dependencies.join('、') || '无' },
              { key: 'lock', label: '锁文件', value: skill.lockFile, mono: true },
              { key: 'eval', label: '评测门禁', value: `${(skill.eval.gate.actual * 100).toFixed(0)}% / 门槛 ${(skill.eval.gate.threshold * 100).toFixed(0)}%`, tag: { text: skill.eval.gate.met ? '达标' : '未达标', theme: skill.eval.gate.met ? 'success' : 'danger' } },
            ]"
          />
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">权限收窄（只可收窄）</h3>
          <InfoGrid
            :columns="1"
            :items="[
              { key: 'cur', label: '当前会话模式', value: PERMISSION_MODE_LABEL[narrowing.cur] },
              { key: 'rec', label: '技能建议模式', value: PERMISSION_MODE_LABEL[narrowing.rec] },
              { key: 'final', label: '安装后实际模式', value: PERMISSION_MODE_LABEL[narrowing.final] },
            ]"
          />
          <Alert
            style="margin-top: 10px"
            :theme="narrowing.narrowed ? 'warning' : 'info'"
            :message="narrowing.narrowed ? '建议模式高于当前模式，已按当前模式执行（收窄）' : '建议模式不高于当前模式，无需调整'"
            description="技能不能放宽权限：建议 acceptEdits/autonomous 时也只会向下收窄，绝不提升。"
          />
          <div style="margin-top: 10px">
            <CliHint :command="`oc skill install ${skill.name} --mode=${narrowing.final} --pin`" />
          </div>
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
