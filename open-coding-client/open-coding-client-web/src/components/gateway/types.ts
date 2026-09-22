/**
 * 模型网关 / 提示词 / 上下文 / 成本 域共享类型与小工具。
 * 仅本域子组件使用；六态取值与 StateShell 判别联合保持一致。
 */

export type PageState = 'LOADING' | 'NORMAL' | 'EMPTY' | 'ERROR' | 'EDGE_DATA' | 'PERMISSION_DENIED';

/** 演示态切换项（自审用：逐页可切换六态） */
export const PAGE_STATE_OPTIONS: { label: string; value: PageState }[] = [
  { label: '正常', value: 'NORMAL' },
  { label: '加载中', value: 'LOADING' },
  { label: '空数据', value: 'EMPTY' },
  { label: '错误', value: 'ERROR' },
  { label: '边界数据', value: 'EDGE_DATA' },
  { label: '无权限', value: 'PERMISSION_DENIED' },
];

/** 三维能力态排序权重（矩阵排序用：不支持越靠后越显眼） */
export const CAPABILITY_ORDER: Record<'supported' | 'degraded' | 'unsupported', number> = {
  supported: 0,
  degraded: 1,
  unsupported: 2,
};

/** 百分比 → 水位主题（低于告警、告警、严重） */
export function waterTheme(pct: number, warn = 80, critical = 95): 'success' | 'warning' | 'danger' {
  if (pct >= critical) return 'danger';
  if (pct >= warn) return 'warning';
  return 'success';
}

/** 金额格式化（统一 4 位小数，与 StatCard/OcChart 口径一致） */
export function fmtCost(v: number): string {
  return v < 0.01 && v > 0 ? '<$0.01' : `$${v.toFixed(4)}`;
}

/** 大额金额（看板口径：千分位 + 2 位小数） */
export function fmtUsd(v: number): string {
  return `$${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** token 数量（k / M） */
export function fmtToken(v: number): string {
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

/** 字节（KB / MB） */
export function fmtBytes(v: number): string {
  return v >= 1_048_576 ? `${(v / 1_048_576).toFixed(2)} MB` : `${(v / 1024).toFixed(1)} KB`;
}
