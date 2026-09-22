<script setup lang="ts">
/**
 * 租户化自检（N-15）：逐域租户化清单 + 跨租户红线检查。
 * 溯源：卷 24 §4.10
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Table, Tag } from 'tdesign-vue-next';
import { downloadText } from '@/utils/download';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 租户化清单（卷 24 §4.10 逐域）：每行都必须能在实现中被验证，缺项即视为租户隔离缺陷 */
const domains = [
  { vol: '卷 16 事件', required: '信封强制 tenantId；分区键含租户；查询自动过滤', miss: '全局消费者忘记过滤（投影泄漏）', pass: true },
  { vol: '卷 01/12 会话', required: '会话属租户；跨端 attach 校验租户', miss: '分享链接越租户', pass: true },
  { vol: '卷 03 上下文', required: '检索注入按租户过滤；引用再读重新鉴权', miss: '缓存键未含租户（跨租户命中）', pass: false },
  { vol: '卷 10 记忆', required: '四层各自作用域；组织记忆按角色', miss: '向量索引共享导致串味', pass: true },
  { vol: '卷 11 知识', required: '索引标签含租户；前置过滤', miss: '连接器凭据跨租户复用', pass: true },
  { vol: '卷 05 工具', required: '工作区路由属租户；缓存键含租户', miss: '只读缓存跨租户命中', pass: false },
  { vol: '卷 06 权限', required: '策略 / 授权记忆按租户；企业基线不可跨租户', miss: '策略缓存未分区', pass: true },
  { vol: '卷 07 沙箱', required: '执行域按租户隔离（L2/L3 强制）', miss: '容器复用导致环境残留', pass: true },
  { vol: '卷 20/21 工作区/Git', required: '连接配置与凭证按租户；worktree 目录按租户分根', miss: '临时目录共享', pass: true },
  { vol: '卷 13 团队', required: '成员、黑板、消息按租户', miss: '跨租户成员误加入', pass: true },
  { vol: '卷 34/35 自动化/增强', required: '模板与运行按租户；预算按租户', miss: '报告外发到错误接收人', pass: true },
  { vol: '卷 24/31 计量', required: '归因必含租户；看板默认按租户过滤', miss: '聚合表缺少租户维度', pass: true },
  { vol: '卷 28 遥测/许可', required: '租户级同意与席位', miss: '遥测载荷混租户', pass: true },
  { vol: '卷 18/08 插件/技能', required: '安装与配置按租户；市场缓存分区', miss: '全局插件配置被单租户修改', pass: false },
];
const redlines = [
  '任何查询不得缺少租户条件——持久层强制注入 + 集成测试扫描（无租户条件即测试失败）',
  '跨租户数据移动必须经显式导出/导入流程并留审计；不存在「直接读取」路径',
  '缓存 / 索引 / 对象存储键必须含租户前缀；跨租户命中视为安全事件（SEV2）',
  '共享知识域（如企业统一规范）必须显式声明并在索引中标注「共享」标签',
];
const failed = computed(() => domains.filter((x) => !x.pass));
/** 扫描记录：重新扫描后即时登记（最近扫描时间与结果行） */
const scanning = ref(false);
const scanRuns = ref<{ at: string; passed: number; failed: number }[]>([]);

/** 导出检查报告：逐域清单 + 红线 + 缺陷结论（Markdown 留档） */
function exportReport() {
  const passed = domains.filter((x) => x.pass).length;
  const text = [
    `# 租户化自检报告（${new Date().toLocaleString('zh-CN')}）`,
    `- 检查域：${domains.length}；通过：${passed}；缺陷：${failed.value.length}`,
    `- 结论：${failed.value.length ? '存在缺陷，阻断发布（修复后重扫）' : '全部通过'}`,
    '',
    '## 逐域清单',
    ...domains.map((x) => `- [${x.pass ? '通过' : '缺陷'}] ${x.vol}：${x.required}${x.pass ? '' : `（风险：${x.miss}）`}`),
    '',
    '## 跨租户红线（硬约束）',
    ...redlines.map((r, i) => `${i + 1}. ${r}`),
  ].join('\n');
  const file = downloadText(text, `tenant-selfcheck-${Date.now()}.md`);
  MessagePlugin.success('已生成 ' + file);
}

/** 重新扫描：重跑 14 域隔离核对并登记本次结果（缺陷未修复不会因重扫消失，仍阻断发布） */
function rescan() {
  scanning.value = true;
  MessagePlugin.info('正在重新扫描租户隔离项（14 域）…');
  window.setTimeout(() => {
    const passed = domains.filter((x) => x.pass).length;
    scanRuns.value.unshift({ at: new Date().toISOString(), passed, failed: domains.length - passed });
    scanning.value = false;
    MessagePlugin.success(`重新扫描完成：${domains.length} 域 · 通过 ${passed} · 缺陷 ${domains.length - passed}（缺陷未修复仍阻断发布）`);
  }, 640);
}

onMounted(() => {
  setTimeout(() => { state.value = domains.length ? 'NORMAL' : 'EMPTY'; ui.setViewState({ state: 'NORMAL' }); }, 220);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="租户化自检"
      desc="逐域核对租户隔离（14 域）与跨租户红线；任一缺项即视为租户隔离缺陷，必须修复后才能发布。"
      volume="卷 24"
      manifest="N-15"
      cli="oc tenant selfcheck --strict --json"
      :status="[{ label: '红线：跨租户零泄漏', theme: 'danger' }]"
    >
      <template #actions>
        <Button size="small" variant="outline" @click="exportReport">导出检查报告</Button>
        <Button size="small" theme="primary" :loading="scanning" @click="rescan">重新扫描</Button>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="尚未执行自检"
      empty-desc="未执行自检时无法确认租户隔离完整性；建议在每次合并前与发布前各执行一次。"
      empty-action="执行自检"
      example-task="oc tenant selfcheck --strict --fail-on-missing-tenant"
      what="租户化自检失败"
      why="扫描未通过：存在缺少租户条件的查询（缓存键 / 聚合表维度缺失）"
      how="可重试；该结果会阻断发布（存在未修复违规时不得宣告完成）"
      trace-id="trace-tenant-check-77a1"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="检查域" :value="domains.length" unit="个" :target="14" target-kind="min" icon="check" />
        <StatCard label="通过" :value="domains.filter((x) => x.pass).length" unit="个" />
        <StatCard label="缺陷" :value="failed.length" unit="个" :target="0" target-kind="max" icon="error" hint="缺项即隔离缺陷（阻断发布）" />
        <StatCard label="租户" :value="d.tenantName" format="raw" icon="sitemap" hint="本自检仅覆盖当前租户数据面" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">逐域租户化清单（14 域）</div>
        <Table :data="domains" row-key="vol" size="small">
          <template #vol="{ row }"><b style="font-size: 12px">{{ row.vol }}</b></template>
          <template #pass="{ row }">
            <Tag size="small" :theme="row.pass ? 'success' : 'danger'" variant="light-outline">{{ row.pass ? '通过' : '缺陷' }}</Tag>
          </template>
          <template #miss="{ row }">
            <span :class="row.pass ? 'oc-muted' : ''" style="font-size: 12px">{{ row.miss }}</span>
          </template>
        </Table>
        <div v-for="f in failed" :key="f.vol" class="oc-state__hint" style="margin-top: 4px">
          缺陷 {{ f.vol }}：{{ f.miss }} → 修复：为相关键 / 维度补租户前缀，并把该场景纳入集成测试扫描（无租户条件即失败）。
        </div>
        <div v-for="s in scanRuns" :key="s.at" class="oc-state__hint" style="margin-top: 4px">
          最近扫描 {{ new Date(s.at).toLocaleString('zh-CN') }}：通过 {{ s.passed }} · 缺陷 {{ s.failed }}（缺陷项需修复后重扫，重扫不会自动消除缺陷）。
        </div>
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">跨租户红线（硬约束）</div>
        <div class="oc-stack">
          <div v-for="(r, i) in redlines" :key="r" class="oc-flex" style="gap: 6px">
            <Tag size="small" theme="danger" variant="light-outline">红线 {{ i + 1 }}</Tag>
            <span class="oc-muted" style="font-size: 12px">{{ r }}</span>
          </div>
        </div>
        <div class="oc-flex" style="gap: 6px; margin-top: 8px">
          <Tag size="small" variant="outline">拒绝优先</Tag>
          <Tag size="small" variant="outline">强制项不可放宽</Tag>
          <Tag size="small" variant="outline">审计不可篡改</Tag>
          <Tag size="small" variant="outline">导出需脱敏</Tag>
        </div>
        <CopyableId id="trace-tenant-0912" label="复制 traceId" />
      </div>
    </StateShell>
  </div>
</template>
