<script setup lang="ts">
/**
 * 演示控制台（仅演示环境）：确定性触发六态与网络语义。
 * - 全局强制六态：影响所有使用 StateShell 的页面（空/加载/错误/离线/权限/超限）
 * - 慢响应：mock 延迟 → 1.5–3s
 * - 断连：离线只读（写操作明确失败）
 * - 故障注入：写操作路径统一返回 INTERNAL_ERROR（验证「失败保留输入 + 重试」）
 * - 重置演示数据：清空 oc.* 业务键并重新载入
 * 说明：所有状态与数据均为本地 Mock，不会连接任何真实系统。
 */
import { computed } from 'vue';
import { Button, Drawer, MessagePlugin, RadioGroup, RadioButton, Switch, Tag, Tooltip } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';
import { downloadJson } from '@/utils/download';
import OcIcon from '@/components/common/OcIcon.vue';

const ui = useUiStore();

const STATES: { value: string; label: string; desc: string }[] = [
  { value: 'NORMAL', label: '正常', desc: '按页面自身数据渲染' },
  { value: 'EMPTY', label: '空数据', desc: '验收「为什么空 + 主行动」' },
  { value: 'LOADING', label: '加载中', desc: '骨架 + 阶段文案（>5s 可取消）' },
  { value: 'ERROR', label: '错误', desc: '三段式 + traceId 可复制 + 重试' },
  { value: 'OFFLINE', label: '离线', desc: '状态条 + 受影响功能禁用 + 倒计时' },
  { value: 'PERMISSION_DENIED', label: '权限不足', desc: '缺哪个权限 + 申请路径' },
  { value: 'EDGE_DATA', label: '边界数据', desc: '折叠 + 分页 + 加载更多' },
];

/** 导出演示复现包：四段（manifest / events / workitems / checksums），真实生成可下载文件 */
function exportReplayPackage() {
  const pkg = {
    manifest: {
      generatedAt: new Date().toISOString(),
      client: 'open-coding-web',
      env: 'demo-mock',
      demoState: ui.demoState ?? 'NORMAL',
      slow: ui.demoSlow,
      offline: ui.demoOffline,
      fault: ui.demoFault,
      connection: ui.connection,
      degradeTier: ui.degradeTier,
    },
    events: ui.telemetry.slice(-50),
    workitems: ui.notifications.slice(0, 20).map((n) => ({ kind: n.kind, level: n.level, title: n.title, channel: n.channel, read: n.read })),
    checksums: {
      events: String(ui.telemetry.length),
      workitems: String(ui.notifications.length),
      algorithm: 'demo-fnv1a（演示用，非安全校验）',
    },
  };
  const file = downloadJson(pkg, `oc-replay-package-${Date.now()}.json`);
  MessagePlugin.success(`已生成复现包并下载：${file}（manifest / events / workitems / checksums）`);
}

const current = computed({
  get: () => ui.demoState ?? 'NORMAL',
  set: (v: string) => ui.setDemoState(v === 'NORMAL' ? null : (v as never)),
});
</script>

<template>
  <div class="oc-demo">
    <Tooltip content="演示控制台：切换六态与网络语义（全 Mock，不改真实资源）" placement="left">
      <button type="button" class="oc-demo__fab" @click="ui.demoConsoleOpen = true">
        <OcIcon name="app" size="16px" />
        <span>演示</span>
        <i v-if="ui.demoState && ui.demoState !== 'NORMAL'" class="oc-demo__dot" />
      </button>
    </Tooltip>

    <Drawer v-model:visible="ui.demoConsoleOpen" placement="right" size="360px" header="演示控制台">
      <div class="oc-stack">
        <div class="oc-card" style="border-color: var(--td-warning-color-3, #ffb98a); background: var(--td-warning-color-1, #fff9f0)">
          <div class="oc-flex" style="gap: 6px">
            <OcIcon name="help" size="14px" />
            <b style="font-size: 13px">演示环境</b>
          </div>
          <div style="font-size: 12px; margin-top: 4px">
            本客户端不连接任何后端与真实资源：模型响应、工具执行、审批、部署、SSH / 文件系统操作均为本地 Mock。
            凭证只出现引用名，不含真实密钥。
          </div>
        </div>

        <div>
          <div class="oc-secondary" style="font-size: 12px; margin-bottom: 6px">全局页面态（覆盖全部页面的六态渲染）</div>
          <RadioGroup v-model="current" size="small" style="display: flex; flex-wrap: wrap; gap: 4px">
            <RadioButton v-for="s in STATES" :key="s.value" :value="s.value">{{ s.label }}</RadioButton>
          </RadioGroup>
          <div class="oc-muted" style="font-size: 11px; margin-top: 4px">
            {{ STATES.find((s) => s.value === current)?.desc }}
          </div>
        </div>

        <div class="oc-divider" />

        <div class="oc-flex--between">
          <div>
            <div style="font-size: 13px">慢响应</div>
            <div class="oc-muted" style="font-size: 11px">所有 mock 请求追加 1.5–3s（验证加载态与慢响应体验）</div>
          </div>
          <Switch :value="ui.demoSlow" @change="() => ui.setDemoSlow(!ui.demoSlow)" />
        </div>

        <div class="oc-flex--between">
          <div>
            <div style="font-size: 13px">断连（离线只读）</div>
            <div class="oc-muted" style="font-size: 11px">状态栏转离线；写操作明确失败并保留草稿</div>
          </div>
          <Switch :value="ui.demoOffline" @change="() => ui.setDemoOffline(!ui.demoOffline)" />
        </div>

        <div class="oc-flex--between">
          <div>
            <div style="font-size: 13px">故障注入</div>
            <div class="oc-muted" style="font-size: 11px">经 mock 写边界的提交统一失败（审批决策/偏好保存等）：验证失败不改数据与重试</div>
          </div>
          <Switch :value="ui.demoFault" @change="() => ui.setDemoFault(!ui.demoFault)" />
        </div>

        <div class="oc-divider" />

        <div class="oc-secondary" style="font-size: 12px">当前语义</div>
        <div class="oc-flex oc-flex--wrap" style="gap: 6px">
          <Tag size="small" variant="outline">连接 {{ ui.connection }}</Tag>
          <Tag size="small" variant="outline">延迟 {{ ui.demoSlow ? '1.5–3s' : '90–280ms' }}</Tag>
          <Tag size="small" variant="outline">强制态 {{ ui.demoState ?? '无' }}</Tag>
          <Tag size="small" variant="outline">渲染档位 {{ ui.degradeTier }}</Tag>
          <Tag size="small" variant="outline">埋点 {{ ui.telemetry.length }} 条</Tag>
        </div>

        <div class="oc-divider" />

        <Button variant="outline" block @click="exportReplayPackage()">
          导出复现包（演示 · JSON）
        </Button>
        <Button theme="danger" variant="outline" block @click="ui.resetDemo()">重置演示数据并重新载入</Button>
        <div class="oc-muted" style="font-size: 11px">
          重置会清空 oc.* 业务键（标签页/通知/埋点/演示开关），保留主题、动效与字号偏好。
        </div>
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.oc-demo__fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--oc-shell-statusbar-h) + 16px);
  z-index: 55;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--td-brand-color-2, #cce0ff);
  background: var(--td-brand-color-light, #eaf1ff);
  color: var(--td-brand-color, #0052d9);
  cursor: pointer;
  font-size: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.oc-demo__fab:hover {
  background: var(--td-brand-color-1, #f2f7ff);
}

.oc-demo__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--oc-sev-warn);
}
</style>
