import type { RouteRecordRaw } from 'vue-router';

/** 界面族（对齐 impl/30 §9.6，用于六态矩阵与埋点） */
export type SurfaceCode =
  | 'session' | 'approval' | 'tool' | 'task' | 'cost' | 'registry'
  | 'settings' | 'wizard' | 'share' | 'automation' | 'intel';

export interface OcRouteMeta {
  /** 菜单标题 */
  title: string;
  /** 导航分组名（同组聚合） */
  group?: string;
  /** 分组排序（小者靠前） */
  groupOrder?: number;
  /** 组内排序 */
  order?: number;
  /** 图标语义名（OcIcon 的 name） */
  icon?: string;
  /** 一句话说明（页头副标题/导航 tooltip） */
  desc?: string;
  /** 六态矩阵归属界面族 */
  surface?: SurfaceCode;
  /** 不在导航中展示（详情页/覆盖层） */
  hidden?: boolean;
  /** 需要权限点；缺失时页面进入 PERMISSION_DENIED 态 */
  permission?: string;
  /** Harness 卷号，用于自审溯源 */
  volume?: string;
  /** 实验特性：显示「实验」徽标 */
  experimental?: boolean;
  /** 实现任务书行号引用（BUILD-MANIFEST 编号） */
  manifest?: string;
}

export type OcRoute = RouteRecordRaw & { meta?: OcRouteMeta };
