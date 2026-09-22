<script setup lang="ts">
/**
 * I-05 提交前扫描。
 * 四类命中：密钥模式、大文件、敏感路径、依赖清单变更（+ 证书文件）；命中即阻断并给修复建议；
 * 结果按 blob 哈希缓存，避免重复扫描拖慢提交。
 * 溯源：卷 21 D-GIT-10/§4.4；BUILD-MANIFEST I-05。
 */
import { computed, onMounted, ref } from 'vue';
import { Button, MessagePlugin, Option, Select, Table, Tag } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import StatCard from '@/components/common/StatCard.vue';
import InfoGrid from '@/components/common/InfoGrid.vue';
import JsonBlock from '@/components/common/JsonBlock.vue';
import CliHint from '@/components/common/CliHint.vue';
import { platformData } from '@/mock/data/platform';
import type { ScanHit } from '@/mock/data/platform';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const demo = ref<'NORMAL' | 'EMPTY' | 'LOADING' | 'ERROR'>('LOADING');
const patternFilter = ref('');
const active = ref<ScanHit>(platformData.git.scanHits[0]);
const rescanning = ref(false);

const hits = computed(() => platformData.git.scanHits);
const rows = computed(() => (patternFilter.value ? hits.value.filter((h) => h.patternType === patternFilter.value) : hits.value));
const blockedCount = computed(() => hits.value.filter((h) => h.blocked).length);
const cacheHits = computed(() => hits.value.filter((h) => h.cached).length);

const columns = [
  { colKey: 'patternType', title: '命中类型', width: 160, cell: 'type' },
  { colKey: 'path', title: '路径', width: 260, cell: 'path' },
  { colKey: 'blobHash', title: 'blob 哈希', width: 140, cell: 'hash' },
  { colKey: 'blocked', title: '是否阻断', width: 120, cell: 'blocked' },
  { colKey: 'suggestion', title: '修复建议', ellipsis: true },
  { colKey: 'op', title: '操作', width: 96, cell: 'op' },
];

function rescan() {
  rescanning.value = true;
  window.setTimeout(() => {
    rescanning.value = false;
    MessagePlugin.success(`增量扫描完成：命中 ${hits.value.length} 项（缓存命中 ${cacheHits.value} 项，按 blob 哈希跳过重扫）`);
  }, 800);
}

onMounted(() => {
  window.setTimeout(() => (demo.value = hits.value.length ? 'NORMAL' : 'EMPTY'), 240);
  ui.setViewState({ state: 'NORMAL' });
});
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="提交前扫描"
      desc="增量扫描四类风险（密钥模式 / 大文件 / 敏感路径 / 依赖清单变更，另含证书文件）；命中即阻断提交并给修复建议；结果按 blob 哈希缓存。"
      volume="卷 21" manifest="I-05" cli="oc git scan --staged --incremental && oc git commit --message '<msg>'"
      :status="[{ label: `${blockedCount} 项阻断`, theme: blockedCount ? 'danger' : 'success' }, { label: `缓存命中 ${cacheHits}`, theme: 'default' }]"
    >
      <template #actions>
        <Select v-model="demo" size="small" style="width: 120px" aria-label="状态演示" :options="[
          { value: 'NORMAL', label: '正常' }, { value: 'EMPTY', label: '空数据' }, { value: 'ERROR', label: '错误' },
        ]" />
        <Select v-model="patternFilter" size="small" style="width: 180px" clearable placeholder="命中类型" aria-label="命中类型">
          <Option value="" label="全部类型" />
          <Option value="密钥模式" label="密钥模式" />
          <Option value="大文件" label="大文件" />
          <Option value="敏感路径" label="敏感路径" />
          <Option value="依赖清单变更" label="依赖清单变更" />
          <Option value="证书文件" label="证书文件" />
        </Select>
        <Button size="small" theme="primary" variant="outline" :disabled="rescanning" @click="rescan">
          {{ rescanning ? '扫描中' : '重新扫描' }}
        </Button>
      </template>
    </PageHeader>

    <div class="oc-grid oc-grid--4">
      <StatCard label="命中总数" :value="hits.length" icon="bug" hint="含误报（可加白名单并缓存）" />
      <StatCard label="阻断提交" :value="blockedCount" icon="secured" hint="阻断即拒绝提交，不静默放行" />
      <StatCard label="大文件阈值" :value="100" unit="MB" icon="file" hint="> 100MB 阻断；可配置为 LFS" />
      <StatCard label="扫描缓存命中" :value="(cacheHits / hits.length) * 100" format="percent" icon="loading" hint="按 blob 哈希缓存，二次提交更快" />
    </div>

    <StateShell
      :state="demo" stage="正在增量扫描暂存区（密钥/大文件/敏感路径/依赖清单）…"
      empty-title="暂存区没有风险命中" empty-desc="本次暂存内容未命中任何规则；可安全提交。当前规则库版本：企业私仓 v12。"
      empty-action="查看规则库" example-task="在 config/ 放一个假 AK 文件，验证提交被阻断并给出修复建议"
      what="提交前扫描失败" why="扫描规则库加载失败（企业私仓不可达），无法确认增量结果"
      how="按安全默认阻断提交（fail-closed），可重试或改用本地内置规则扫描" trace-id="trace-d44e55cc"
      @retry="demo = 'NORMAL'" @empty-action="demo = 'NORMAL'"
    >
      <Table :data="rows" :columns="columns" row-key="id" size="small" :pagination="undefined">
        <template #type="{ row }">
          <Tag :theme="row.patternType === '密钥模式' || row.patternType === '证书文件' ? 'danger' : row.patternType === '大文件' ? 'warning' : 'primary'" size="small" variant="light-outline">
            {{ row.patternType }}
          </Tag>
        </template>
        <template #path="{ row }"><span class="oc-mono oc-truncate">{{ row.path }}</span></template>
        <template #hash="{ row }"><span class="oc-mono">{{ row.blobHash }}</span></template>
        <template #blocked="{ row }">
          <Tag :theme="row.blocked ? 'danger' : 'warning'" size="small" variant="light-outline">{{ row.blocked ? '已阻断' : '仅告警' }}</Tag>
        </template>
        <template #op="{ row }">
          <Button size="small" variant="text" @click="active = row as ScanHit">详情</Button>
        </template>
      </Table>
    </StateShell>

    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">
          命中详情：{{ active.path }}
          <CliHint command="oc git scan explain --blob <hash> --rule <ruleId>" />
        </h3>
        <InfoGrid :columns="1" :items="[
          { key: 'type', label: '命中类型', value: active.patternType },
          { key: 'path', label: '路径', value: active.path, mono: true },
          { key: 'hash', label: 'blob 哈希', value: active.blobHash, mono: true },
          { key: 'blocked', label: '处置', value: active.blocked ? '阻断提交（必须修复或加入白名单）' : '仅告警（企业可改为阻断）', tag: { text: active.blocked ? '已阻断' : '仅告警', theme: active.blocked ? 'danger' : 'warning' } },
          { key: 'fix', label: '修复建议', value: active.suggestion },
          { key: 'cache', label: '结果缓存', value: active.cached ? '命中缓存（同 blob 不重复扫描）→ 修复后哈希变化会重新扫描' : '未命中缓存（首次扫描）' },
        ]" />
      </div>
      <div class="oc-card">
        <h3 class="oc-card__title">提交被阻断后的处理路径</h3>
        <JsonBlock
          :mask="false" label="阻断与放行"
          :value="{
            failClosed: true,
            paths: [
              '修复：移除密钥并改用引用式（secret://），或改用 LFS / artifact:// 外置大文件',
              '移除暂存：git restore --staged <path>（不影响工作区改动）',
              '白名单：仅对确认误报（需高权限，记录理由与到期时间）',
            ],
            neverSilent: '扫描不可用或超时一律按安全默认拒绝提交（fail-closed），不静默放行',
          }"
        />
        <div class="oc-flex oc-flex--wrap" style="margin-top: 8px">
          <Tag theme="warning" variant="light-outline" size="small">依赖清单变更：命中 CVE 时给升级建议，不阻断但要求显式确认</Tag>
        </div>
      </div>
    </div>
  </div>
</template>
