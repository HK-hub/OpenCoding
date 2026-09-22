import type { OcRoute } from '../types';

/** Git 与 Worktree 域路由（卷 21；BUILD-MANIFEST I-01…I-13） */
export default [
  {
    path: '/git/worktrees',
    name: 'git-worktrees',
    component: () => import('@/views/git/WorktreeList.vue'),
    meta: { title: 'Worktree 列表', group: '平台与工程', groupOrder: 9, order: 34, icon: 'git', desc: '任务/分支/状态/大小/创建与清理时间 + 打开/清理', surface: 'registry', volume: '卷 21', manifest: 'I-01' },
  },
  {
    path: '/git/worktree-create',
    name: 'git-worktree-create',
    component: () => import('@/views/git/WorktreeCreate.vue'),
    meta: { title: 'Worktree 创建编排', group: '平台与工程', groupOrder: 9, order: 35, icon: 'git', desc: '写范围重叠判断 → 原地或创建 + 分支命名 oc/<task-id>-slug', surface: 'wizard', volume: '卷 21', manifest: 'I-02' },
  },
  {
    path: '/git/branches',
    name: 'git-branches',
    component: () => import('@/views/git/BranchManager.vue'),
    meta: { title: '分支管理', group: '平台与工程', groupOrder: 9, order: 36, icon: 'git', desc: '每任务一分支 + 主分支保护 + 栈式分支（可选）', surface: 'registry', volume: '卷 21', manifest: 'I-03' },
  },
  {
    path: '/git/commits',
    name: 'git-commits',
    component: () => import('@/views/git/CommitHistory.vue'),
    meta: { title: '提交记录与追溯', group: '平台与工程', groupOrder: 9, order: 37, icon: 'git', desc: '结构化尾注（会话/任务/团队/模型/角色/审批）+ 文件数', surface: 'registry', volume: '卷 21', manifest: 'I-04' },
  },
  {
    path: '/git/pre-commit-scan',
    name: 'git-pre-commit-scan',
    component: () => import('@/views/git/PreCommitScan.vue'),
    meta: { title: '提交前扫描', group: '平台与工程', groupOrder: 9, order: 38, icon: 'git', desc: '密钥/大文件/敏感路径/依赖变更 + 阻断 + 修复建议 + 结果缓存', surface: 'registry', volume: '卷 21', manifest: 'I-05' },
  },
  {
    path: '/git/merge-queue',
    name: 'git-merge-queue',
    component: () => import('@/views/git/MergeQueue.vue'),
    meta: { title: '合并队列', group: '平台与工程', groupOrder: 9, order: 39, icon: 'git', desc: '队列深度 + 串行化 + 租约 + 预检结果', surface: 'task', volume: '卷 21', manifest: 'I-06' },
  },
  {
    path: '/git/merge-detail',
    name: 'git-merge-detail',
    component: () => import('@/views/git/MergeDetail.vue'),
    meta: { title: '合并详情与预检报告', group: '平台与工程', groupOrder: 9, order: 40, icon: 'git', desc: '拉取基线→重放→预检→合并/退回 + 报告', surface: 'task', volume: '卷 21', manifest: 'I-07' },
  },
  {
    path: '/git/conflicts',
    name: 'git-conflicts',
    component: () => import('@/views/git/ConflictResolver.vue'),
    meta: { title: '冲突解决', group: '平台与工程', groupOrder: 9, order: 41, icon: 'git', desc: '三方合并 + 语义分析 + AI 建议 + 人工确认 + 结论入库（不静默丢改动）', surface: 'task', volume: '卷 21', manifest: 'I-08、K-06' },
  },
  {
    path: '/git/danger-guard',
    name: 'git-danger-guard',
    component: () => import('@/views/git/DangerGuard.vue'),
    meta: { title: '危险操作护栏', group: '平台与工程', groupOrder: 9, order: 42, icon: 'git', desc: '7 类危险操作 + 丢失提交清单 + 自动临时引用 oc/backup/<ts>', surface: 'approval', volume: '卷 21', manifest: 'I-09' },
  },
  {
    path: '/git/undo',
    name: 'git-undo',
    component: () => import('@/views/git/UndoLog.vue'),
    meta: { title: '操作日志与撤销', group: '平台与工程', groupOrder: 9, order: 43, icon: 'git', desc: 'oc git undo + 临时引用恢复 + 日志保留 30 天', surface: 'registry', volume: '卷 21', manifest: 'I-10' },
  },
  {
    path: '/git/platforms',
    name: 'git-platforms',
    component: () => import('@/views/git/PlatformIntegration.vue'),
    meta: { title: '代码平台集成', group: '平台与工程', groupOrder: 9, order: 44, icon: 'git', desc: 'GitHub/GitLab/Gitea/内网 + 凭据引用 + 企业禁用', surface: 'settings', volume: '卷 21', manifest: 'I-11' },
  },
  {
    path: '/git/reviews',
    name: 'git-reviews',
    component: () => import('@/views/git/ReviewFlow.vue'),
    meta: { title: '审查流', group: '平台与工程', groupOrder: 9, order: 45, icon: 'git', desc: '三层审查（自审/团队/人类）+ 评论闭环 + 意见回流为任务', surface: 'approval', volume: '卷 21', manifest: 'I-12' },
  },
  {
    path: '/git/large-repo',
    name: 'git-large-repo',
    component: () => import('@/views/git/LargeRepo.vue'),
    meta: { title: '大仓性能', group: '平台与工程', groupOrder: 9, order: 46, icon: 'git', desc: '部分克隆/稀疏检出/commit-graph/LFS + 首次准备进度', surface: 'settings', volume: '卷 21', manifest: 'I-13' },
  },
] as OcRoute[];
