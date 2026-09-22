<script setup lang="ts">
/**
 * 技能建议与激活（K-04）：语义路由/触发器只「建议」，用户确认才激活；
 * 每次自动激活产生 skill.activated 事件，可回溯「为什么这条技能生效」。
 * 溯源：卷 08 D-SKILL-3 / §4.3 装配时序 / D-SKILL-10 劣化降级。
 */
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Dialog, MessagePlugin, Switch, Table, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { SKILL_SOURCE_LABEL, useExtList } from '@/components/extension/useExtList';

const router = useRouter();
/** 建议来源：显式建议 + 劣化自动降级为建议（D-SKILL-10） */
const candidates = computed(() => extensionData.skills.filter((s) => s.suggestion || s.degraded));
const { visible, state, matched, edgeSummary, reload, loadMore } = useExtList(candidates.value, {
  persistKey: 'skill-suggestions',
  pageSize: 6,
  match: (s, kw) => !kw || `${s.name}${s.description}${s.activationReason}`.toLowerCase().includes(kw),
});

const decisions = ref<Record<string, 'pending' | 'accepted' | 'ignored'>>(
  Object.fromEntries(candidates.value.map((s) => [s.id, s.suggestion?.decision ?? 'pending'])),
);
const autoMap = ref<Record<string, boolean>>(Object.fromEntries(extensionData.autoActivation.map((a) => [a.skill, a.enabled])));
const traceOpen = ref(false);
const traceSkill = ref(candidates.value[0]?.name ?? '');

const traceSteps = computed(() => [
  { title: '触发', detail: `触发器/语义路由命中：${candidates.value.find((s) => s.name === traceSkill.value)?.suggestion?.trigger ?? '成功率劣化检测'}（仅产生建议，不直接激活）` },
  { title: '作用域解析与版本锁定', detail: '四源优先级：内置 → 组织 → 项目 → 用户；同名校验与锁文件生成' },
  { title: '装配器校验', detail: '内核版本区间 + 必需模型能力 + 必需工具可用性（不满足则拒绝并给出结构化原因）' },
  { title: '权限收窄', detail: '按 policy.yaml 建议收窄（不可放宽当前模式），越权能力被拒并审计' },
  { title: '上下文注入', detail: '主指令注入 S2 区段、资源按需注入 S5；记录 token 占用与证据引用' },
  { title: '事件留痕', detail: 'skill.activated（含版本、激活方式与理由）；可随时停用并从上下文移除' },
]);

function decide(sid: string, name: string, kind: 'accepted' | 'ignored') {
  decisions.value[sid] = kind;
  MessagePlugin[kind === 'accepted' ? 'success' : 'info'](
    kind === 'accepted'
      ? `已启用 ${name}：产生 skill.activated 事件，指令与资源已注入当前会话`
      : `已忽略 ${name} 的建议：写入 skill.suggestion.rejected 用于调优路由（24h 内不再重复提示同类）`,
  );
}

const autoColumns = [
  { colKey: 'skill', title: '技能', width: 280 },
  { colKey: 'enabled', title: '自动激活', width: 110 },
  { colKey: 'reason', title: '启用理由 / 被拦截原因' },
  { colKey: 'last', title: '最近触发', width: 170 },
];
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="技能建议与激活"
      desc="默认「显式 + 建议」：触发器与语义路由只建议，用户确认才激活；自动激活必须可解释、可关闭。"
      volume="卷 08" manifest="K-04" cli="oc skill suggest --explain"
      :status="[{ label: `待处理 ${matched.length}`, theme: 'warning' }, { label: '自动激活可关', theme: 'success' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="router.push('/extension/skills')">返回技能库</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      :edge-summary="edgeSummary"
      :page-size="6"
      empty-title="当前没有技能建议"
      empty-desc="语义路由未命中、触发器未触发，或所有建议已处理（采纳/忽略均记录用于调优）。"
      example-task="为 payment-core 启用 acme.platform.java-refactor"
      what="建议流加载失败"
      why="技能路由服务不可达；建议流为空但不影响已激活技能。"
      how="可重试；也可在技能库中显式激活。"
      trace-id="trace-sugg-21f7"
      @retry="reload"
      @load-more="loadMore"
    >
      <div class="oc-stack" style="gap: 12px">
        <div v-for="s in visible" :key="s.id" class="oc-card">
          <div class="oc-flex--between oc-flex--wrap" style="gap: 8px">
            <div class="oc-flex" style="gap: 8px; min-width: 0">
              <OcIcon :name="s.degraded ? 'thumb-down' : 'lightbulb'" size="16px" :color="s.degraded ? 'var(--oc-sev-warn)' : 'var(--td-brand-color)'" />
              <b class="oc-truncate">{{ s.name }}@{{ s.version }}</b>
              <Tag v-if="s.degraded" size="small" theme="warning" variant="light-outline">劣化 → 降级为建议</Tag>
              <Tag size="small" variant="outline">{{ SKILL_SOURCE_LABEL[s.source] }}</Tag>
            </div>
            <div class="oc-flex" style="gap: 4px">
              <Button size="small" theme="primary" variant="outline" @click="decide(s.id, s.name, 'accepted')">启用</Button>
              <Button size="small" variant="text" @click="decide(s.id, s.name, 'ignored')">忽略</Button>
              <Button size="small" variant="text" @click="traceSkill = s.name; traceOpen = true">为什么生效</Button>
              <Button size="small" variant="text" @click="router.push({ path: '/extension/skills/detail', query: { name: s.name } })">详情</Button>
            </div>
          </div>

          <div class="oc-kv" style="margin-top: 8px">
            <span class="oc-kv__k">建议理由</span>
            <span>{{ s.suggestion?.reason ?? '成功率连续低于无技能基线，按 D-SKILL-10 自动降级为建议（不再自动装配）' }}</span>
            <span class="oc-kv__k">触发条件</span>
            <span class="oc-mono" style="font-size: 12px">{{ s.suggestion?.trigger ?? 'metrics: successRate < baseline' }}</span>
            <span class="oc-kv__k">证据</span>
            <span style="font-size: 12px">{{ s.suggestion?.evidence ?? `近 30 天成功率 ${s.stats.successRate}% < 基线 ${s.stats.baselineSuccessRate}%` }}</span>
            <span class="oc-kv__k">当前决定</span>
            <span>
              <Tag size="small" :theme="decisions[s.id] === 'accepted' ? 'success' : decisions[s.id] === 'ignored' ? 'default' : 'warning'" variant="light-outline">
                {{ decisions[s.id] === 'accepted' ? '已启用' : decisions[s.id] === 'ignored' ? '已忽略' : '待处理' }}
              </Tag>
              <span class="oc-muted" style="font-size: 12px; margin-left: 8px">激活理由：{{ s.activationReason }}</span>
            </span>
          </div>
        </div>

        <div class="oc-card">
          <h3 class="oc-card__title">
            自动激活开关
            <span class="oc-muted" style="font-size: 12px">自动激活仅限已签名且评测达标技能；每次触发均产生可回溯事件</span>
          </h3>
          <Table row-key="skill" size="small" :data="extensionData.autoActivation" :columns="autoColumns">
            <template #skill="{ row }">
              <div class="oc-stack" style="gap: 2px">
                <span class="oc-mono" style="font-size: 12px">{{ row.skill }}</span>
                <div class="oc-flex" style="gap: 6px">
                  <Tag size="small" variant="outline">skill.suggested → skill.activated</Tag>
                  <CopyableId :id="`trace-auto-${row.skill.slice(-6)}`" label="traceId" :short="12" />
                </div>
              </div>
            </template>
            <template #enabled="{ row }">
              <Tooltip content="关闭后该技能仅保留建议，不再自动装配（安全类技能不可自动激活）">
                <Switch size="small" :value="autoMap[row.skill]" @change="(v) => { autoMap[row.skill] = Boolean(v); MessagePlugin.info(v ? '已开启自动激活' : '已关闭自动激活（仅保留建议）'); }" />
              </Tooltip>
            </template>
            <template #last="{ row }"><span class="oc-muted" style="font-size: 12px">{{ row.lastTriggeredAt ? new Date(row.lastTriggeredAt).toLocaleString('zh-CN') : '未触发' }}</span></template>
          </Table>
        </div>
      </div>
    </StateShell>

    <Dialog v-model:visible="traceOpen" header="为什么这条技能生效（溯源链）" :footer="false" width="640px">
      <div class="oc-stack" style="gap: 8px">
        <div v-for="(t, i) in traceSteps" :key="t.title" class="oc-flex" style="gap: 8px; align-items: flex-start">
          <Tag size="small" theme="primary" variant="light-outline">{{ i + 1 }}</Tag>
          <div>
            <div style="font-size: 13px; font-weight: 600">{{ t.title }}</div>
            <div class="oc-secondary" style="font-size: 12px">{{ t.detail }}</div>
          </div>
        </div>
        <div class="oc-divider" />
        <div class="oc-flex" style="gap: 8px">
          <span class="oc-muted" style="font-size: 12px">事件引用</span>
          <CopyableId id="evt-skill-activated-9f21c4" label="skill.activated" :short="22" />
          <CopyableId id="trace-auto-3f21c4" label="traceId" :short="12" />
        </div>
      </div>
    </Dialog>
  </div>
</template>
