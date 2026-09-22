<script setup lang="ts">
/**
 * 键位帮助（? 打开）：六层键位表 + 鼠标等价说明 + 冲突提示。
 * 未知键位直接报错而非静默（卷 22 §4.5）。
 */
import { Dialog, Table, Tag } from 'tdesign-vue-next';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const LAYERS = [
  {
    layer: '全局',
    keys: [
      { key: 'Ctrl/Cmd+K', action: '命令面板（覆盖全部命令）', mouse: '顶栏放大镜' },
      { key: 'Ctrl/Cmd+Enter', action: '发送消息 / 提交审批', mouse: '输入框发送按钮' },
      { key: 'Esc', action: '安全点中断（审批卡内为收起，不产生决策）', mouse: '停止按钮' },
      { key: 'Ctrl/Cmd+.', action: '停止并暂停', mouse: '暂停按钮' },
      { key: '?', action: '键位帮助', mouse: '顶栏 ? 按钮' },
    ],
  },
  {
    layer: '导航',
    keys: [
      { key: 'Alt+↑ / Alt+↓', action: '切换会话标签', mouse: '标签栏点击' },
      { key: 'Ctrl/Cmd+1..9', action: '面板直达（标签顺序）', mouse: '标签栏点击' },
      { key: 'Ctrl/Cmd+Shift+A', action: '待审批列表', mouse: '状态栏「待审批」' },
      { key: 'Ctrl/Cmd+Shift+F', action: '统一搜索', mouse: '顶栏搜索框' },
    ],
  },
  {
    layer: '会话',
    keys: [
      { key: '↑', action: '编辑上一条发送内容', mouse: '消息「编辑」' },
      { key: 'Tab', action: '切换输入模式（文本 / 多模态 / @ 引用）', mouse: '输入框工具条' },
      { key: 'Shift+Enter', action: '换行', mouse: '—' },
    ],
  },
  {
    layer: '审批',
    keys: [
      { key: 'A', action: '批准本次（ALLOW_ONCE）', mouse: '风险卡「仅本次」' },
      { key: 'S', action: '批准并授予范围（二次确认）', mouse: '范围 chips + 批准' },
      { key: 'R', action: '拒绝本次（可填理由）', mouse: '拒绝按钮' },
      { key: 'Shift+R', action: '拒绝并终止（级联终结同会话待审批）', mouse: '拒绝并终止' },
      { key: 'D', action: '查看 diff', mouse: '预览区展开' },
      { key: 'Tab', action: '字段间移动（可到达范围 chips）', mouse: '—' },
    ],
  },
  {
    layer: '列表 / 看板',
    keys: [
      { key: 'J / K', action: '上下移动', mouse: '滚动' },
      { key: 'Enter', action: '打开详情', mouse: '行点击' },
      { key: 'X', action: '选择当前项', mouse: '复选框' },
      { key: 'Shift+X', action: '批量选择', mouse: '表头全选' },
    ],
  },
  {
    layer: '无障碍',
    keys: [
      { key: 'Tab', action: '全流程可达（无鼠标可完成：新建会话 → 提问 → 审批 → 查看 diff → 提交）', mouse: '—' },
      { key: 'Ctrl/Cmd+Shift+P', action: '跳读屏公告区', mouse: '—' },
      { key: 'Alt+Shift+F', action: '切换读屏专用布局（单流 + 段落级播报）', mouse: '设置 · 无障碍' },
    ],
  },
];
</script>

<template>
  <Dialog v-model:visible="ui.shortcutHelpOpen" header="键位帮助" width="860px" :footer="false" top="6vh">
    <div class="oc-stack" style="max-height: 70vh; overflow: auto">
      <div class="oc-secondary" style="font-size: 12px">
        六层键位：全局 / 导航 / 会话 / 审批 / 列表看板 / 无障碍。所有鼠标操作均有等价键盘路径；自定义键位冲突必须可见并保留生效者。
      </div>
      <Table
        v-for="l in LAYERS"
        :key="l.layer"
        :data="l.keys"
        size="small"
        :pagination="undefined"
        row-key="key"
        :columns="[
          { colKey: 'key', title: l.layer, width: 160, cell: 'key' },
          { colKey: 'action', title: '行为' },
          { colKey: 'mouse', title: '鼠标等价', width: 180 },
        ]"
      >
        <template #key="{ row }"><Tag variant="outline" size="small" class="oc-mono">{{ row.key }}</Tag></template>
      </Table>
      <div class="oc-flex" style="gap: 8px">
        <Tag theme="warning" variant="light-outline" size="small">未知键位直接报错（不静默忽略）</Tag>
        <Tag theme="primary" variant="light-outline" size="small">键位可定制：设置 · 键位</Tag>
      </div>
    </div>
  </Dialog>
</template>
