<script setup lang="ts">
/**
 * 模板市场（N2-01）。
 * 七个分类侧栏 + 模板卡片（风险徽标 / 来源角标 / 签名 / 已安装标记）。
 * 溯源：卷 34 §5.1/§5.6；BUILD-MANIFEST N2-01。
 * 契约：模板是配置不是新执行路径 —— 卡片只展示声明，运行时仍走调度 + 决策链 + 沙箱。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, Input, Select, Tag, Tooltip } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import RiskBadge from '@/components/common/RiskBadge.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { automationData } from '@/mock/data/automation';
import type { TemplateCategory } from '@/mock/data/automation';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const router = useRouter();
const data = automationData;

const DEMO = ['NORMAL', 'LOADING', 'EMPTY', 'ERROR', 'PERMISSION_DENIED', 'EDGE_DATA'] as const;
type Demo = (typeof DEMO)[number];
const demo = ref<Demo>('LOADING');
const demoOptions = DEMO.map((v) => ({ value: v as string, label: v }));
function onDemo(v: unknown) {
  demo.value = String(v) as Demo;
}

const cat = ref<TemplateCategory | '全部'>('全部');
const keyword = ref('');
const onlyInstalled = ref(false);
const expanded = ref(false);

const filtered = computed(() =>
  data.templates.filter((t) => {
    if (cat.value !== '全部' && t.category !== cat.value) return false;
    if (onlyInstalled.value && !t.installed) return false;
    const kw = keyword.value.trim();
    if (kw && !`${t.name} ${t.summary} ${t.tags.join(' ')} ${t.why}`.toLowerCase().includes(kw.toLowerCase())) return false;
    return true;
  }),
);
const shown = computed(() => (expanded.value ? filtered.value : filtered.value.slice(0, 8)));

const state = computed<Demo>(() => {
  if (demo.value !== 'NORMAL') return demo.value;
  if (!filtered.value.length) return 'EMPTY';
  if (filtered.value.length > 8 && !expanded.value) return 'EDGE_DATA';
  return 'NORMAL';
});

onMounted(() => {
  window.setTimeout(() => (demo.value = data.templates.length ? 'NORMAL' : 'EMPTY'), 260);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="模板市场"
      desc="模板 = 声明式配置（触发 + 目标 + 步骤 + 权限上限 + 验收断言），不产生新的执行路径；默认只提 PR，禁 force-push。"
      volume="卷 34" manifest="N2-01" cli="oc automation template list --category all"
      :status="[{ label: `${data.templates.length} 个内置模板族`, theme: 'default' }, { label: '装载期与权限交叉校验', theme: 'primary' }]"
    >
      <template #actions>
        <Select :value="demo" size="small" style="width: 140px" aria-label="状态演示" :options="demoOptions" @change="onDemo" />
        <Button size="small" variant="outline" @click="router.push('/automation/market-sync')">市场同步</Button>
        <Button size="small" theme="primary" @click="router.push('/automation/install')">安装模板</Button>
      </template>
    </PageHeader>

    <div class="oc-flex" style="gap: 12px; align-items: flex-start">
      <!-- 分类侧栏 -->
      <aside class="oc-card" style="width: 190px; flex: none">
        <div class="oc-card__title">分类</div>
        <div class="oc-stack" style="gap: 2px">
          <Button
            v-for="c in [{ name: '全部' as const, count: data.templates.length }, ...data.categories]"
            :key="c.name"
            size="small"
            :variant="cat === c.name ? 'base' : 'text'"
            :theme="cat === c.name ? 'primary' : 'default'"
            style="justify-content: space-between"
            @click="cat = c.name; expanded = false"
          >
            <span>{{ c.name }}</span><span class="oc-muted">{{ c.count }}</span>
          </Button>
        </div>
        <div class="oc-divider" />
        <div class="oc-flex" style="gap: 6px">
          <Button size="small" :theme="onlyInstalled ? 'primary' : 'default'" variant="outline" @click="onlyInstalled = !onlyInstalled">
            只看已安装
          </Button>
        </div>
        <div class="oc-muted" style="font-size: 12px; margin-top: 8px">
          风险级与权限声明交叉校验：声明与实际动作不匹配即装载期拒绝。
        </div>
      </aside>

      <!-- 卡片区 -->
      <div class="oc-grow">
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 10px">
          <Input v-model="keyword" size="small" style="width: 260px" placeholder="搜索模板名 / 标签 / 价值主张" clearable />
          <Tag variant="outline" size="small">共 {{ filtered.length }} 个匹配</Tag>
          <Tag variant="outline" size="small">来源：内置 / 组织私仓 / 市场</Tag>
        </div>

        <StateShell
          :state="state" stage="正在载入模板目录与签名结论…"
          empty-title="没有匹配的模板" empty-desc="当前分类或关键词下没有模板；可切换分类或清空关键词。"
          empty-action="清空筛选" example-task="安装「依赖升级」模板并对 payment-core 干跑一次"
          what="模板目录加载失败" why="模板仓索引不可达（市场连接中断，本地缓存仍可用）"
          how="重试；或前往「市场同步」查看离线标记与恢复路径" trace-id="trace-a91f0c24"
          :collapsed-summary="`模板较多（${filtered.length} 个），已折叠展示前 8 个（边界数据态）。`" :page-size="shown.length"
          @retry="demo = 'NORMAL'" @empty-action="cat = '全部'; keyword = ''; onlyInstalled = false" @load-more="expanded = true"
        >
          <div class="oc-grid oc-grid--3">
            <div v-for="t in shown" :key="t.id" class="oc-card" style="cursor: pointer" @click="router.push(`/automation/templates/${t.id}`)">
              <div class="oc-flex--between">
                <b>{{ t.name }}</b>
                <RiskBadge :level="t.riskLevel" />
              </div>
              <div class="oc-flex oc-flex--wrap" style="gap: 4px; margin: 6px 0">
                <Tag size="small" variant="light-outline" theme="primary">{{ t.category }}</Tag>
                <Tag size="small" variant="outline">v{{ t.version }}</Tag>
                <Tag size="small" variant="outline">{{ t.provenance === 'builtin' ? '内置' : t.provenance === 'org-repo' ? '组织私仓' : '市场' }}</Tag>
                <Tag v-if="t.installed" size="small" theme="success" variant="light-outline">已安装</Tag>
              </div>
              <div class="oc-secondary" style="font-size: 12px; min-height: 34px">{{ t.summary }}</div>
              <div class="oc-muted" style="font-size: 12px; margin-top: 4px">{{ t.why }}</div>
              <div class="oc-divider" />
              <div class="oc-flex oc-flex--wrap" style="gap: 6px; font-size: 12px">
                <Tag size="small" variant="outline">{{ t.sandboxTier }}</Tag>
                <Tag size="small" variant="outline">预算 ${{ t.budget.costUsd }} / {{ t.budget.durationMin }}min</Tag>
                <Tag size="small" variant="outline">主指标：{{ t.mainMetric }}</Tag>
              </div>
              <div class="oc-flex" style="gap: 6px; margin-top: 8px">
                <Tooltip :content="`签名：${t.signature}（${t.signedBy}）`">
                  <span class="oc-mono oc-muted" style="font-size: 11px">
                    <OcIcon name="lock" size="12px" /> {{ t.signature.slice(0, 22) }}…
                  </span>
                </Tooltip>
                <span class="oc-grow" />
                <Tag size="small" variant="outline">上限 {{ t.permissions.ceiling }}</Tag>
              </div>
            </div>
          </div>
          <div class="oc-muted" style="font-size: 12px; margin-top: 10px">
            上限清单（不可请求）：{{ data.templates[0].permissions.denied.join('、') }}。任何模板都无法修改自身或提升上限。
          </div>
        </StateShell>
      </div>
    </div>
  </div>
</template>
