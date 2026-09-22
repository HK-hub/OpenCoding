import type { OcRoute } from '../types';

/** 提示词系统路由（卷 04） */
export default [
  {
    path: '/prompt/assets',
    name: 'prompt-assets',
    component: () => import('@/views/prompt/AssetLibrary.vue'),
    meta: { title: '提示词资产库', group: '模型与提示词', groupOrder: 8, order: 21, icon: 'file', desc: '五类资产（片段/模板/策略/角色/模式）+ 搜索过滤 + 引用数', surface: 'registry', volume: '卷 04', manifest: 'M-16' },
  },
  {
    path: '/prompt/assembly',
    name: 'prompt-assembly',
    component: () => import('@/views/prompt/AssemblyPreview.vue'),
    meta: { title: '组装预览', group: '模型与提示词', groupOrder: 8, order: 22, icon: 'layers', desc: '逐段来源 + 变量注入值 + 制品哈希与确定性说明', surface: 'registry', volume: '卷 04', manifest: 'M-18' },
  },
  {
    path: '/prompt/versions',
    name: 'prompt-versions',
    component: () => import('@/views/prompt/VersionRelease.vue'),
    meta: { title: '版本与发布', group: '模型与提示词', groupOrder: 8, order: 23, icon: 'history', desc: '版本历史 + 制品哈希 + 评测记录 + 发布/回滚', surface: 'registry', volume: '卷 04', manifest: 'M-19' },
  },
  {
    path: '/prompt/gray',
    name: 'prompt-gray',
    component: () => import('@/views/prompt/GrayPanel.vue'),
    meta: { title: '提示词灰度', group: '模型与提示词', groupOrder: 8, order: 24, icon: 'flag', desc: '稳定分桶 + arm 指标 + 门控阈值 + 自动回滚记录', surface: 'registry', volume: '卷 04', manifest: 'M-20' },
  },
  {
    path: '/prompt/override',
    name: 'prompt-override',
    component: () => import('@/views/prompt/OverrideTree.vue'),
    meta: { title: '覆盖与继承', group: '模型与提示词', groupOrder: 8, order: 25, icon: 'sitemap', desc: 'L0–L4 层级树 + 「为什么这条生效」解析链 + 不可覆盖清单', surface: 'registry', volume: '卷 04', manifest: 'M-21' },
  },
  {
    path: '/prompt/guardrails',
    name: 'prompt-guardrails',
    component: () => import('@/views/prompt/GuardrailPanel.vue'),
    meta: { title: '安全护栏', group: '模型与提示词', groupOrder: 8, order: 26, icon: 'secured', desc: '四类护栏（越权/注入/泄密/语言）+ 固定注入位置 + 不可覆盖', surface: 'registry', volume: '卷 04', manifest: 'M-22' },
  },
  {
    path: '/prompt/languages',
    name: 'prompt-languages',
    component: () => import('@/views/prompt/LanguageVariants.vue'),
    meta: { title: '多语言变体', group: '模型与提示词', groupOrder: 8, order: 27, icon: 'browse', desc: '语言 Tab + 回退链 zh-CN → en-US → 默认（与 UI 语言解耦）', surface: 'registry', volume: '卷 04', manifest: 'M-23' },
  },
  {
    path: '/prompt/assets/:id',
    name: 'prompt-asset-editor',
    component: () => import('@/views/prompt/AssetEditor.vue'),
    meta: { title: '资产编辑器', group: '模型与提示词', groupOrder: 8, order: 28, icon: 'edit', hidden: true, surface: 'registry', volume: '卷 04', manifest: 'M-17' },
  },
] as OcRoute[];
