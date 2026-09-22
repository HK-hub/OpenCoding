<script setup lang="ts">
/**
 * 输入区（基于 TDesign ChatSender 封装）：
 * - @ 引用（文件 / 符号 / 知识 / 记忆）
 * - 多模态附件（拖拽 / 粘贴 / 媒体库）
 * - slash 命令面板
 * - 发送前成本预估与预算水位
 * - 中断（Esc 安全点）/ 插话 steer / 队列策略
 */
import { computed, ref, watch } from 'vue';
import { Button, MessagePlugin, Popup, RadioGroup, RadioButton, Tag } from 'tdesign-vue-next';
import { ChatSender } from '@tdesign-vue-next/chat';
import { useSessionStore } from '@/stores/session';
import { db } from '@/mock/db';
import OcIcon from '@/components/common/OcIcon.vue';

export interface Attachment {
  key: string;
  name: string;
  size: number;
}

const store = useSessionStore();
const value = ref('');
const refs = ref<string[]>([]);
const attachments = ref<Attachment[]>([]);
const showSlash = ref(false);
const showEstimate = ref(false);

/**
 * ChatSender 只在 Textarea 的 change（失焦）时同步内部值，
 * 导致「输入后直接按 Enter / 点发送」拿不到文本；这里监听原生 input
 * 把实时文本回写到 v-model，发送键与快捷键才能立即生效。
 */
const textareaProps = {
  autosize: { minRows: 2, maxRows: 8 },
  onInput: (e: Event) => {
    const el = e.target as HTMLTextAreaElement;
    if (el?.tagName === 'TEXTAREA') value.value = el.value;
  },
};

const SLASH = [
  { cmd: '/plan', desc: '进入计划模式（只允许分析与计划工具）' },
  { cmd: '/review', desc: '对当前变更发起三层审查' },
  { cmd: '/test', desc: '生成并运行测试（生成即运行，不通过即丢弃）' },
  { cmd: '/cost', desc: '查看本会话成本与上下文占用' },
  { cmd: '/skills', desc: '打开技能库并建议匹配技能' },
  { cmd: '/mcp', desc: '查看 MCP 服务器状态' },
  { cmd: '/export', desc: '导出会话复现包' },
  { cmd: '/doctor', desc: '运行诊断' },
];

const REF_SOURCES = [
  { key: 'file', label: '工作区文件', sample: '@src/main/java/.../PaymentServiceImpl.java' },
  { key: 'symbol', label: '符号', sample: '@symbol:IdempotencyGuard' },
  { key: 'knowledge', label: '知识库', sample: '@kb:支付链路幂等设计' },
  { key: 'memory', label: '记忆', sample: '@memory:commit-lang' },
];

const estimate = computed(() => {
  const base = 1_800;
  const perRef = 620;
  const perAtt = 1_450;
  const tokens = base + refs.value.length * perRef + attachments.value.length * perAtt;
  return { tokens, cost: tokens * 0.0000042 * 1.6, ttfb: 0.9 };
});

const budget = computed(() => {
  const used = db.sessionCost.total;
  const total = db.sessionCost.budget;
  return { used, total, pct: (used / total) * 100 };
});

function onSend(text: string) {
  if (!text.trim()) {
    MessagePlugin.warning('请输入内容或使用 / 命令');
    return;
  }
  store.send(text, attachments.value.map((a) => a.name));
  value.value = '';
  refs.value = [];
  attachments.value = [];
}

function pickRef(src: (typeof REF_SOURCES)[number]) {
  refs.value.push(src.sample);
  value.value = `${value.value}${value.value.endsWith(' ') || !value.value ? '' : ' '}${src.sample} `;
}

function onFileSelect(payload: { files: FileList; name: string }) {
  const f = payload.files?.[0];
  if (f) attachments.value.push({ key: `${Date.now()}`, name: f.name, size: f.size });
}

/** 编辑重发：从会话流载入历史消息内容 */
watch(
  () => store.editTarget,
  (t) => {
    if (t) value.value = t.text;
  },
);
</script>

<template>
  <div class="oc-composer">
    <!-- 编辑重发提示：原分支保留，便于双分支 diff -->
    <div v-if="store.editTarget" class="oc-flex--between" style="margin-bottom: 6px">
      <span class="oc-flex" style="gap: 6px; font-size: 12px">
        <OcIcon name="edit" size="13px" />
        正在编辑历史消息（重发后原分支保留，可对比双分支差异）
      </span>
      <Button size="small" variant="text" @click="store.cancelEdit()">取消编辑</Button>
    </div>

    <!-- 引用与附件 chips -->
    <div v-if="refs.length || attachments.length" class="oc-flex oc-flex--wrap" style="gap: 6px; margin-bottom: 6px">
      <Tag v-for="r in refs" :key="r" closable size="small" variant="light-outline" @close="refs = refs.filter((x) => x !== r)">
        <OcIcon name="link" size="11px" /> {{ r }}
      </Tag>
      <Tag
        v-for="a in attachments"
        :key="a.key"
        closable
        size="small"
        theme="primary"
        variant="light-outline"
        @close="attachments = attachments.filter((x) => x.key !== a.key)"
      >
        <OcIcon name="file" size="11px" /> {{ a.name }} · {{ (a.size / 1024).toFixed(0) }}KB
      </Tag>
    </div>

    <ChatSender
      v-model="value"
      :loading="store.streaming"
      :placeholder="store.streaming ? '执行中…可继续输入；按 Enter 将按队列策略处理' : '描述你的任务；⌘/Ctrl+Enter 发送，Esc 安全点中断，Tab 切换输入模式'"
      :textarea-props="textareaProps"
      @send="onSend"
      @stop="store.interrupt()"
      @file-select="onFileSelect"
    >
      <template #footer-prefix>
        <div class="oc-flex" style="gap: 4px; flex-wrap: wrap">
          <Popup trigger="click" placement="top-left" :visible="showSlash" @visible-change="(v: boolean) => (showSlash = v)">
            <Button size="small" variant="text"><OcIcon name="root" size="14px" /> / 命令</Button>
            <template #content>
              <div class="oc-stack" style="min-width: 300px">
                <button v-for="s in SLASH" :key="s.cmd" type="button" class="oc-slash" @click="value = `${value}${s.cmd} `; showSlash = false">
                  <b class="oc-mono">{{ s.cmd }}</b>
                  <span class="oc-secondary" style="font-size: 12px">{{ s.desc }}</span>
                </button>
              </div>
            </template>
          </Popup>

          <Popup trigger="click" placement="top-left">
            <Button size="small" variant="text"><OcIcon name="link" size="14px" /> @ 引用</Button>
            <template #content>
              <div class="oc-stack" style="min-width: 280px">
                <button v-for="s in REF_SOURCES" :key="s.key" type="button" class="oc-slash" @click="pickRef(s)">
                  <b>{{ s.label }}</b>
                  <span class="oc-muted oc-mono" style="font-size: 11px">{{ s.sample }}</span>
                </button>
              </div>
            </template>
          </Popup>

          <Button size="small" variant="text" @click="() => MessagePlugin.info('已打开媒体库：图片 / PDF / 表格 / 音视频（能力门控：无 vision 能力的模型将隐藏图片入口）')">
            <OcIcon name="image" size="14px" /> 多模态
          </Button>

          <Popup v-model:visible="showEstimate" trigger="hover" placement="top-left">
            <Button size="small" variant="text"><OcIcon name="discount" size="14px" /> 预估</Button>
            <template #content>
              <div class="oc-stack" style="min-width: 260px; font-size: 12px">
                <div><b>发送前预估（成本前置可见）</b></div>
                <div>预计输入：{{ estimate.tokens.toLocaleString('zh-CN') }} tokens</div>
                <div>预计成本：${{ estimate.cost.toFixed(4) }}</div>
                <div>预计首字节：{{ estimate.ttfb }}s（历史同类任务中位数）</div>
                <div class="oc-muted">实际以服务端计量为准，误差 ≤1%；超预算将中断并保留已完成部分。</div>
              </div>
            </template>
          </Popup>
        </div>
      </template>

      <template #suffix>
        <div class="oc-flex" style="gap: 6px">
          <RadioGroup v-model="store.queuePolicy" size="small" variant="default-filled">
            <RadioButton value="queue">排队</RadioButton>
            <RadioButton value="interrupt">打断</RadioButton>
            <RadioButton value="coalesce">合并</RadioButton>
          </RadioGroup>
          <Tag v-if="store.queued" size="small" theme="warning" variant="light-outline">队列 {{ store.queued }}</Tag>
          <Tag size="small" variant="outline">预算 {{ budget.pct.toFixed(0) }}%</Tag>
          <!-- 发送键：ChatSender 默认发送键被本插槽覆盖，这里补回可点击的发送入口 -->
          <Button
            size="small"
            theme="primary"
            :disabled="!value.trim()"
            :loading="store.streaming"
            @click="onSend(value)"
          >
            发送
          </Button>
        </div>
      </template>
    </ChatSender>

    <div class="oc-flex--between" style="margin-top: 6px">
      <div class="oc-flex oc-muted" style="gap: 8px; font-size: 11px">
        <span>单飞 + 队列：同时只允许一个轮次执行</span>
        <span>·</span>
        <span>Esc 中断在安全点生效（≤1s 响应）</span>
        <span>·</span>
        <span>失败不会静默：降级与裁剪一律显式提示</span>
      </div>
      <Button v-if="store.streaming" size="small" theme="danger" variant="outline" @click="store.interrupt()">停止并暂停</Button>
    </div>
  </div>
</template>

<style scoped>
.oc-composer {
  border-top: 1px solid var(--oc-border);
  padding: 10px 12px 12px;
  background: var(--oc-bg-container);
}

.oc-slash {
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}

.oc-slash:hover {
  background: var(--td-bg-color-container-hover, #f3f3f3);
}
</style>
