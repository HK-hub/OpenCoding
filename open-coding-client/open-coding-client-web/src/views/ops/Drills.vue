<script setup lang="ts">
/**
 * 故障演练（G5-04）：九类演练表（频率 / 成功判据 / RTO / RPO），
 * 最近演练报告（时间线 / 动作 / 偏差 / 改进项），发起演练需说明环境与影响面。
 * 溯源：卷 32 / BUILD-MANIFEST G5-04
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Popconfirm, Table, Tag, Timeline, TimelineItem } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import CliHint from '@/components/common/CliHint.vue';
import { enterpriseData } from '@/mock/data/enterprise';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const d = enterpriseData;
const state = ref<'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR'>('LOADING');
/** 默认选中未通过的演练（负样本：磁盘打满 RTO 22min > 判据 15min） */
const pickedId = ref(d.drills.find((x) => !x.passed)?.id ?? d.drills[0]?.id ?? 'dr-01');
const planned = ref('');

const drill = computed(() => d.drills.find((x) => x.id === pickedId.value) ?? d.drills[0]);
const columns = [
  { colKey: 'name', title: '演练项', width: 176 },
  { colKey: 'frequency', title: '频率', width: 84 },
  { colKey: 'successCriteria', title: '成功判据', width: 240 },
  { colKey: 'rto', title: 'RTO / RPO', width: 108 },
  { colKey: 'lastRunAt', title: '最近演练', width: 120 },
  { colKey: 'passed', title: '结论', width: 92 },
];

/** 报告时间线：按「准备 → 注入 → 观察 → 恢复 → 复盘」五段推导，偏差显式标注 */
const report = computed(() => {
  const x = drill.value;
  const base = new Date(x.lastRunAt).getTime();
  const at = (offsetMin: number) => new Date(base + offsetMin * 60000).toLocaleString('zh-CN');
  const deviation = x.passed
    ? `偏差可控：RTO ${x.rtoMinutes}min / RPO ${x.rpoMinutes}min，均在判据内；发现 ${x.findings} 项观察项`
    : `超判据：实际 RTO ${x.rtoMinutes}min 超出承诺，发现 ${x.findings} 项偏差（含归档并发不足与保护写入判定缺失）`;
  return {
    steps: [
      { at: at(0), stage: '准备', text: '冻结变更窗口 + 通知值班；确认回滚路径与备份可用' },
      { at: at(2), stage: '注入', text: x.script },
      { at: at(6), stage: '观察', text: `监控关键 SLI 与告警触发；RTO ${x.rtoMinutes}min，RPO ${x.rpoMinutes}min` },
      { at: at(12), stage: '恢复', text: '按 Runbook 恢复并复核成功判据；未闭环项写入交接单' },
      { at: at(20), stage: '复盘', text: deviation },
    ],
    deviation,
  };
});

function launch(): void {
  planned.value = `${new Date(Date.now() + 86400000).toLocaleDateString('zh-CN')} 02:00–05:00（生产低峰窗口）`;
  MessagePlugin.success(`已发起演练「${drill.value.name}」，计划窗口：${planned.value}`);
}

onMounted(() => {
  window.setTimeout(() => {
    state.value = d.drills.length ? 'NORMAL' : 'EMPTY';
    ui.setViewState({ state: 'NORMAL' });
  }, 240);
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="故障演练"
      desc="九类演练：数据库主从切换 / 进程被杀恢复 / 网络分区（模型端点）/ 磁盘打满 / 沙箱崩溃 / 更新失败回滚 / 恢复演练（备份）/ 安全桌面演练 / 容量水位演练。"
      volume="卷 32"
      manifest="G5-04"
      cli="oc drill list --with-report --last 1"
      :status="[{ label: '未通过项禁止关闭改进项', theme: 'warning' }]"
    >
      <template #actions>
        <Popconfirm
          theme="warning"
          content="发起演练：默认安排在生产低峰（02:00–05:00）；破坏性演练（进程被杀 / 磁盘打满 / 沙箱崩溃）改在预发执行。影响面：演练期间该环境可能短暂不可用；可逆：演练不修改业务数据，可随时中止。"
          @confirm="launch"
        >
          <Button size="small" theme="primary">发起演练</Button>
        </Popconfirm>
      </template>
    </PageHeader>

    <StateShell
      :state="state"
      empty-title="本季度没有演练计划"
      empty-desc="未演练的故障路径不得作为唯一处置依据；请至少覆盖数据库切换、进程恢复与磁盘水位三类。"
      empty-action="生成季度演练计划"
      example-task="在预发演练「主从切换 + 归档并发不足」的组合场景"
      what="演练记录加载失败"
      why="演练编排服务不可达，端上不以计划文件代替实际记录（避免误判已演练）"
      how="可重试；当前窗口的演练如需继续，请联系值班用 CLI 记录结果"
      trace-id="trace-drill-3ab7f2"
      @retry="state = 'LOADING'"
    >
      <div class="oc-grid oc-grid--4">
        <StatCard label="演练项" :value="d.drills.length" unit="类" format="raw" icon="sound" hint="覆盖九类故障路径" />
        <StatCard label="本次窗口已通过" :value="d.drills.filter((x) => x.passed).length" unit="类" format="raw" icon="check" />
        <StatCard label="未通过（待改进）" :value="d.drills.filter((x) => !x.passed).length" unit="类" format="raw" icon="error" :lower-is-better="true" hint="未通过项必须有可验证改进项" />
        <StatCard label="收集到的偏差" :value="d.drills.reduce((a, b) => a + b.findings, 0)" unit="项" format="raw" icon="flag" :lower-is-better="true" />
      </div>

      <div class="oc-card" style="margin-top: 12px">
        <div class="oc-card__title">九类演练（点击行查看最近报告）</div>
        <Table :data="d.drills" :columns="columns" row-key="id" size="small" hover @row-click="(ctx: { row: unknown }) => (pickedId = (ctx.row as { id: string }).id)">
          <template #name="{ row }">
            <Tag size="small" :theme="row.id === pickedId ? 'primary' : 'default'" variant="light-outline">{{ row.name }}</Tag>
          </template>
          <template #rto="{ row }"><span class="oc-mono">{{ row.rtoMinutes }} / {{ row.rpoMinutes }} min</span></template>
          <template #lastRunAt="{ row }">{{ new Date(row.lastRunAt).toLocaleDateString('zh-CN') }}</template>
          <template #passed="{ row }">
            <Tag size="small" :theme="row.passed ? 'success' : 'danger'" variant="light-outline">{{ row.passed ? '通过' : '未通过' }}</Tag>
          </template>
        </Table>
      </div>

      <div class="oc-grid oc-grid--2" style="margin-top: 12px">
        <div class="oc-card">
          <div class="oc-card__title">最近演练报告 · {{ drill.name }}</div>
          <Timeline>
            <TimelineItem v-for="s in report.steps" :key="s.at + s.stage" :label="s.at" :dot-color="s.stage === '复盘' && !drill.passed ? 'var(--oc-sev-warn)' : 'var(--td-brand-color)'">
              <b>{{ s.stage }}</b>
              <div class="oc-muted" style="font-size: 12px">{{ s.text }}</div>
            </TimelineItem>
          </Timeline>
          <CliHint :command="`oc drill report --id ${drill.id} --json`" label="复制报告命令" />
          <div v-if="planned" class="oc-state__hint">已发起：{{ drill.name }} · 计划窗口 {{ planned }}（破坏性演练改在预发执行）</div>
        </div>

        <div class="oc-stack">
          <div class="oc-card">
            <div class="oc-card__title">动作与偏差</div>
            <InfoGrid
              :columns="1"
              :items="[
                { key: 'script', label: '演练脚本', value: drill.script, block: true },
                { key: 'criteria', label: '成功判据', value: drill.successCriteria },
                { key: 'dev', label: '偏差', value: report.deviation, tag: drill.passed ? { text: '判据内', theme: 'success' } : { text: '超出判据', theme: 'danger' } },
              ]"
            />
          </div>
          <div class="oc-card">
            <div class="oc-card__title">改进项（必须落代码 / 配置 / 测试 / 文档）</div>
            <div v-if="drill.improvements.length" class="oc-stack" style="font-size: 12px">
              <div v-for="(im, i) in drill.improvements" :key="i" class="oc-flex oc-flex--wrap" style="gap: 6px">
                <Tag size="small" :theme="im.landing === '代码' ? 'primary' : im.landing === '配置' ? 'warning' : im.landing === '测试' ? 'success' : 'default'" variant="light-outline">{{ im.landing }}</Tag>
                <span class="oc-grow">{{ im.action }}</span>
                <Tag size="small" :theme="im.closed ? 'success' : 'danger'" variant="outline">{{ im.closed ? '已闭环' : '未闭环' }}</Tag>
                <span class="oc-muted">{{ im.owner }} · 截止 {{ new Date(im.dueAt).toLocaleDateString('zh-CN') }}</span>
              </div>
            </div>
            <div v-else class="oc-muted" style="font-size: 12px">本次演练未产生改进项（合规：无偏差可留空，但不允许写「加强意识」类空话）。</div>
          </div>
        </div>
      </div>
    </StateShell>
  </div>
</template>
