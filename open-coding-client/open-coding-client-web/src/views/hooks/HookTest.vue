<script setup lang="ts">
/**
 * 钩子试跑（H-04）：给定样例输入 → 判定 / 改写 diff / 耗时（本地试跑，无副作用）。
 * 溯源：卷 17 §4.6 调试体验（oc hooks test <id> --input case.json）+ §4.2 多层求值顺序。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Alert, Button, MessagePlugin, Select, Tag, Textarea } from 'tdesign-vue-next';
import PageHeader from '@/components/common/PageHeader.vue';
import StateShell from '@/components/common/StateShell.vue';
import { usePageState } from '@/components/extension/useExtList';
import DiffView from '@/components/common/DiffView.vue';
import CopyableId from '@/components/common/CopyableId.vue';
import CliHint from '@/components/common/CliHint.vue';
import OcIcon from '@/components/common/OcIcon.vue';
import { extensionData } from '@/mock/data/extension';
import { HOOK_CAP_LABEL, HOOK_RESULT_LABEL, HOOK_RESULT_THEME, SCOPE_LABEL, fmtMs, type TagTheme } from '@/components/extension/useExtList';

type DiffLikeFile = {
  path: string;
  additions: number;
  deletions: number;
  lines: { type: 'add' | 'del' | 'ctx'; oldLine?: number; newLine?: number; text: string }[];
};

const route = useRoute();
const router = useRouter();
const hooks = extensionData.hooks;
const picked = ref(String(route.query.id ?? 'HK-04'));
const hook = computed(() => hooks.find((h) => h.id === picked.value) ?? hooks[0]);
const options = hooks.map((h) => ({ label: `${h.id} · ${h.name}`, value: h.id }));

const samples: Record<string, string> = {
  'HK-04': '{\n  "point": "tool.call.before",\n  "tool": "write_file",\n  "args": { "path": "../../etc/hosts", "content": "127.0.0.1 evil" },\n  "scope": "project"\n}',
  'HK-03': '{\n  "point": "tool.result.before",\n  "tool": "run_command",\n  "result": { "content": "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig" }\n}',
  'HK-02': '{\n  "point": "git.commit.before",\n  "command": "git commit -m \'fix: add deploy key\'",\n  "files": ["deploy/id_rsa"]\n}',
};
const input = ref(samples[picked.value] ?? '{\n  "point": "' + hook.value.point + '",\n  "tool": "edit_file",\n  "args": { "path": "src/main/java/App.java" }\n}');
const running = ref(false);
const done = ref(false);

/** 同一钩子点上的钩子链：按 组织 → 项目 → 用户 → 会话 顺序求值，阻断即终止 */
const chain = computed(() => {
  const order = ['org', 'project', 'user', 'session'];
  return hooks
    .filter((h) => h.point === hook.value.point && h.enabled)
    .sort((a, b) => order.indexOf(a.scope) - order.indexOf(b.scope));
});

const results = computed(() => {
  const out: { id: string; name: string; scope: string; result: 'pass' | 'block' | 'rewrite'; durationMs: number; note: string; diff?: DiffLikeFile }[] = [];
  for (const h of chain.value) {
    const target = h.id === picked.value || h.capability === 'observe';
    const result: 'pass' | 'block' | 'rewrite' = !target ? 'pass' : h.capability === 'block' ? 'block' : h.capability === 'rewrite' ? 'rewrite' : 'pass';
    out.push({
      id: h.id,
      name: h.name,
      scope: h.scope,
      result,
      durationMs: h.stats.circuitDisabled ? 3000 : Math.max(4, Math.round(h.stats.avgLatencyMs * 0.8)),
      note: result === 'block' ? '阻断：后续钩子不再执行（先到先阻断）' : result === 'rewrite' ? '改写通过 Schema 校验 → 重新走权限决策' : '通过：无干预',
      diff: result === 'rewrite' ? {
        path: 'evaluation/rewrite.diff',
        additions: 1,
        deletions: 1,
        lines: [
          { type: 'ctx' as const, oldLine: 1, newLine: 1, text: `// 钩子 ${h.id} · 字段 ${h.rewritableFields[0] ?? 'args.path'}` },
          { type: 'del' as const, oldLine: 2, text: '"path": "../../etc/hosts"' },
          { type: 'add' as const, newLine: 2, text: '"path": "src/main/java/App.java"（收窄到工作区）' },
        ],
      } : undefined,
    });
    if (result === 'block') break;
  }
  return out;
});

const totalMs = computed(() => results.value.reduce((a, r) => a + r.durationMs, 0));

function run() {
  running.value = true;
  done.value = false;
  window.setTimeout(() => {
    running.value = false;
    done.value = true;
    const blocked = results.value.some((r) => r.result === 'block');
    MessagePlugin[blocked ? 'warning' : 'success'](
      blocked ? '试跑完成：钩子链被阻断（后续钩子未执行）' : `试跑完成：${results.value.length} 个钩子求值，总耗时 ${fmtMs(totalMs.value)}`,
    );
  }, 700);
}

function rTheme(v: string): TagTheme {
  return (HOOK_RESULT_THEME as Record<string, TagTheme>)[v] ?? 'default';
}

/** 页面级六态：LOADING → NORMAL/EMPTY；ERROR 经 runtime.faults 故障注入可达（含可复制 traceId） */
const { state: pageState, traceId: pageTraceId, reload: reloadPage } = usePageState('/extension/hooks/test', () => !route.query.id || hooks.some((h) => h.id === route.query.id));
</script>

<template>
  <div class="oc-page">
    <PageHeader
      title="钩子试跑"
      desc="给定样例输入本地求值整条钩子链：判定、改写 diff 与耗时；试跑零副作用（不写事件、不改真实参数）。"
      volume="卷 17" manifest="H-04" :cli="`oc hooks test ${picked} --input case.json`"
      :status="[{ label: '本地试跑（无副作用）', theme: 'success' }, { label: '按作用域顺序求值', theme: 'default' }]"
    >
      <template #actions>
        <Button size="small" variant="text" @click="router.push('/extension/hooks')">返回列表</Button>
        <Button size="small" variant="outline" @click="router.push({ path: '/extension/hooks/editor', query: { id: picked } })">编辑该钩子</Button>
        <Button size="small" theme="primary" :loading="running" @click="run">
          <OcIcon name="terminal" size="12px" /> 试跑
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


    <div class="oc-grid oc-grid--2">
      <div class="oc-card">
        <h3 class="oc-card__title">样例输入</h3>
        <div class="oc-flex oc-flex--wrap" style="gap: 8px; margin-bottom: 8px">
          <Select v-model="picked" size="small" :options="options" style="width: 320px" filterable />
          <Tag size="small" variant="outline" class="oc-mono">{{ hook.point }}</Tag>
          <Tag size="small" variant="outline">{{ SCOPE_LABEL[hook.scope] }}</Tag>
          <Tag size="small" variant="outline">{{ HOOK_CAP_LABEL[hook.capability] }}</Tag>
        </div>
        <Textarea v-model="input" :autosize="{ minRows: 10 }" placeholder="粘贴样例输入（JSON）" />
        <div class="oc-flex" style="gap: 8px; margin-top: 8px">
          <CliHint command="oc hooks test --dry-run --all-points" />
          <span class="oc-muted" style="font-size: 12px">dry-run：只观察不改写（用于影响面评估）</span>
        </div>
      </div>

      <div class="oc-card">
        <h3 class="oc-card__title">
          求值结果
          <Tag v-if="done" size="small" :theme="results.some((r) => r.result === 'block') ? 'danger' : 'success'" variant="light-outline">
            {{ results.some((r) => r.result === 'block') ? '阻断' : '通过' }} · 总耗时 {{ fmtMs(totalMs) }}
          </Tag>
        </h3>
        <Alert
          v-if="!done"
          theme="info"
          message="等待试跑"
          description="将按 组织 → 项目 → 用户 → 会话 顺序求值该点上的全部启用钩子；任一阻断即终止（后续钩子不执行）。"
        />
        <div v-else class="oc-stack" style="gap: 8px">
          <div v-for="r in results" :key="r.id" class="oc-card" style="padding: 10px 12px">
            <div class="oc-flex--between oc-flex--wrap" style="gap: 6px">
              <div class="oc-flex" style="gap: 6px">
                <span class="oc-mono oc-muted" style="font-size: 11px">{{ r.id }}</span>
                <b style="font-size: 13px">{{ r.name }}</b>
                <Tag size="small" variant="outline">{{ r.scope }}</Tag>
              </div>
              <div class="oc-flex" style="gap: 6px">
                <Tag size="small" :theme="rTheme(r.result)" variant="light-outline">{{ HOOK_RESULT_LABEL[r.result] }}</Tag>
                <span class="oc-mono" style="font-size: 12px">{{ fmtMs(r.durationMs) }}</span>
              </div>
            </div>
            <div class="oc-secondary" style="font-size: 12px; margin-top: 4px">{{ r.note }}</div>
            <div v-if="r.diff" style="margin-top: 8px">
              <DiffView :files="[r.diff]" />
            </div>
          </div>
          <div class="oc-flex" style="gap: 8px">
            <CopyableId id="trace-hook-test-4c81" label="试跑 traceId" :short="16" />
            <span class="oc-muted" style="font-size: 12px">试跑结果可用于评审留痕（不产生 hook.executed 事件）</span>
          </div>
        </div>
      </div>
    </div>
    </StateShell>
  </div>
</template>
