import type { OcRoute } from '../types';

/** 工作区域路由（卷 20；BUILD-MANIFEST O-01…O-12） */
export default [
  {
    path: '/workspace/list',
    name: 'workspace-list',
    component: () => import('@/views/workspace/WorkspaceList.vue'),
    meta: { title: '工作区列表', group: '平台与工程', groupOrder: 9, order: 22, icon: 'folder', desc: '四类后端（local/ssh/container/cloud）+ 状态 + 绑定项目 + 配额', surface: 'registry', volume: '卷 20', manifest: 'O-01' },
  },
  {
    path: '/workspace/create',
    name: 'workspace-create',
    component: () => import('@/views/workspace/WorkspaceCreate.vue'),
    meta: { title: '创建工作区向导', group: '平台与工程', groupOrder: 9, order: 23, icon: 'folder', desc: '类型 → 后端参数 → 绑定与写范围 → 配额与能力确认', surface: 'wizard', volume: '卷 20', manifest: 'O-02' },
  },
  {
    path: '/workspace/detail',
    name: 'workspace-detail',
    component: () => import('@/views/workspace/WorkspaceDetail.vue'),
    meta: { title: '工作区详情', group: '平台与工程', groupOrder: 9, order: 24, icon: 'folder', desc: '概览 / 能力矩阵（4×9）/ 环境档案 / 命令终端 / 文件树', surface: 'registry', volume: '卷 20', manifest: 'O-03' },
  },
  {
    path: '/workspace/env-diff',
    name: 'workspace-env-diff',
    component: () => import('@/views/workspace/EnvDiff.vue'),
    meta: { title: '环境差异', group: '平台与工程', groupOrder: 9, order: 25, icon: 'folder', desc: '探测结果 vs .oc/env.yaml + 差异报告 + 一键准备', surface: 'settings', volume: '卷 20', manifest: 'O-04' },
  },
  {
    path: '/workspace/terminal',
    name: 'workspace-terminal',
    component: () => import('@/views/workspace/CommandTerminal.vue'),
    meta: { title: '命令终端', group: '平台与工程', groupOrder: 9, order: 26, icon: 'folder', desc: '三模式（oneshot/pty/background）+ stdin/resize/信号 + 后台句柄', surface: 'tool', volume: '卷 20', manifest: 'O-05' },
  },
  {
    path: '/workspace/files',
    name: 'workspace-files',
    component: () => import('@/views/workspace/FileBrowser.vue'),
    meta: { title: '文件树与编辑器', group: '平台与工程', groupOrder: 9, order: 27, icon: 'folder', desc: '分页目录 + 忽略规则 + 行/字节范围读 + 编码探测 + 原子写 + 变更监听', surface: 'tool', volume: '卷 20', manifest: 'O-06' },
  },
  {
    path: '/workspace/snapshots',
    name: 'workspace-snapshots',
    component: () => import('@/views/workspace/WorkspaceSnapshots.vue'),
    meta: { title: '工作区快照', group: '平台与工程', groupOrder: 9, order: 28, icon: 'folder', desc: '内容寻址增量 + 去重率 + 引用计数 + 恢复（全量/单文件/目录）', surface: 'registry', volume: '卷 20', manifest: 'O-07' },
  },
  {
    path: '/workspace/connections',
    name: 'workspace-connections',
    component: () => import('@/views/workspace/ConnectionProfiles.vue'),
    meta: { title: '连接配置管理', group: '平台与工程', groupOrder: 9, order: 29, icon: 'folder', desc: '主机/镜像/端点 + 跳板 + 凭证引用 + 超时重试 + 标签', surface: 'settings', volume: '卷 20', manifest: 'O-08' },
  },
  {
    path: '/workspace/connection-health',
    name: 'workspace-connection-health',
    component: () => import('@/views/workspace/ConnectionHealth.vue'),
    meta: { title: '连接健康', group: '平台与工程', groupOrder: 9, order: 30, icon: 'folder', desc: '心跳 30s + 断线重连（退避上限 5）+ 多路复用 + 重认证', surface: 'settings', volume: '卷 20', manifest: 'O-09' },
  },
  {
    path: '/workspace/quota',
    name: 'workspace-quota',
    component: () => import('@/views/workspace/WorkspaceQuota.vue'),
    meta: { title: '配额与资源监控', group: '平台与工程', groupOrder: 9, order: 31, icon: 'folder', desc: '磁盘/CPU/内存/网络/inode + 超阈值告警 + 暂停执行', surface: 'cost', volume: '卷 20', manifest: 'O-10' },
  },
  {
    path: '/workspace/bindings',
    name: 'workspace-bindings',
    component: () => import('@/views/workspace/MultiWorkspaceBinding.vue'),
    meta: { title: '多工作区绑定', group: '平台与工程', groupOrder: 9, order: 32, icon: 'folder', desc: '主体 + 工作区 + 角色（主/关联）+ 写范围 + 跨区授权', surface: 'settings', volume: '卷 20', manifest: 'O-11' },
  },
  {
    path: '/workspace/command-audit',
    name: 'workspace-command-audit',
    component: () => import('@/views/workspace/CommandAudit.vue'),
    meta: { title: '命令审计日志', group: '平台与工程', groupOrder: 9, order: 33, icon: 'folder', desc: '目标主机/用户/命令/资源/退出码（脱敏）', surface: 'settings', volume: '卷 20', manifest: 'O-12', permission: 'audit.read' },
  },
] as OcRoute[];
