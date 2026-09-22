/**
 * Mock 运行时：统一模拟网络请求语义。
 * - 人为延迟（可配置）
 * - cursor 分页
 * - 错误注入（可按域开关，用于演示 ERROR 态）
 * - 六态数据（EMPTY / LOADING / ERROR / OFFLINE / PERMISSION_DENIED / EDGE_DATA）
 */

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface Query {
  cursor?: string | null;
  size?: number;
  keyword?: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
}

export interface MockError extends Error {
  code: string;
  traceId: string;
  retryable: boolean;
  recovery: string;
}

/** 全域错误码（对齐 impl/00-contracts/ERROR-CODE-CATALOG 的高频子集） */
export const ERROR_TEXT: Record<string, { text: string; retryable: boolean; recovery: string }> = {
  INVALID_ARGUMENT: { text: '请求参数不合法；字段取值超出允许范围；按提示收敛后重试。', retryable: false, recovery: 'FIX_INPUT' },
  NOT_FOUND: { text: '指定对象不存在；编号未命中或已清理；请从列表重选。', retryable: false, recovery: 'FIX_INPUT' },
  CONFLICT: { text: '内容已变更；可能由其他端先行操作；已为你刷新，请在新状态下重试。', retryable: true, recovery: 'RETRY' },
  PERMISSION_DENIED: { text: '该操作被拒绝；命中策略规则；如需放行请修改策略或申请临时授权。', retryable: false, recovery: 'ESCALATE' },
  DEPENDENCY_UNAVAILABLE: { text: '依赖暂不可用；内核连接中断；已自动重连，恢复后自动继续。', retryable: true, recovery: 'RETRY' },
  RATE_LIMITED: { text: '请求过于频繁；命中限流维度；请等待后重试。', retryable: true, recovery: 'RETRY' },
  INTERNAL_ERROR: { text: '系统处理失败；已记录诊断引用；请稍后重试或导出诊断包。', retryable: false, recovery: 'ESCALATE' },
  APPROVAL_EXPIRED: { text: '审批超时已按策略拒绝；超时未响应；可重新发起（不计入用户拒绝）。', retryable: true, recovery: 'RETRY' },
  APPROVAL_ESCALATED: { text: '已升级至上级审批人；超时未响应；可继续等待或查看升级对象。', retryable: true, recovery: 'ESCALATE' },
  APPROVAL_UNAVAILABLE: { text: '无人应答或审批通道不可用，已按安全默认拒绝；通道恢复后可重新发起。', retryable: true, recovery: 'ESCALATE' },
  QUOTA_EXCEEDED: { text: '额度不足；命中配额维度；请申请临时额度或等待周期重置。', retryable: false, recovery: 'ESCALATE' },
  BUDGET_EXCEEDED: { text: '已达预算上限；本次需求超过剩余额度；提额或缩小范围后续跑。', retryable: false, recovery: 'ESCALATE' },
  WORKSPACE_PATH_DENIED: { text: '目标路径超出工作区围栏；该路径被拒绝；请改用区内路径或申请跨区授权。', retryable: false, recovery: 'ESCALATE' },
  GIT_CONFLICT: { text: '合并冲突；目标文件存在内容冲突；请在工作台解决后重新入队。', retryable: false, recovery: 'ESCALATE' },
  SANDBOX_DENIED: { text: '操作超出沙箱边界；已阻断；请改用区内路径或申请白名单。', retryable: false, recovery: 'ESCALATE' },
  DIST_LICENSE_EXPIRED: { text: '许可已过期，当前为只读模式；可继续读取与导出；请续期或导入离线延期包。', retryable: false, recovery: 'CONTACT_ADMIN' },
  CROSS_TENANT_DENIED: { text: '无权访问该资源；该数据属于其他租户；已记录安全审计。', retryable: false, recovery: 'ABORT' },
};

export function makeError(code: keyof typeof ERROR_TEXT | string, detail?: string): MockError {
  const meta = ERROR_TEXT[code] ?? { text: '操作失败；原因未知；请重试或导出诊断包。', retryable: false, recovery: 'ESCALATE' };
  const err = new Error(detail ? `${meta.text}（${detail}）` : meta.text) as MockError;
  err.code = code;
  err.traceId = `trace-${Math.random().toString(16).slice(2, 10)}`;
  err.retryable = meta.retryable;
  err.recovery = meta.recovery;
  return err;
}

export interface RuntimeConfig {
  /** 模拟网络延迟区间（毫秒） */
  latency: [number, number];
  /** 全局离线开关（模拟 OFFLINE 态） */
  offline: boolean;
  /** 故障注入：命中的 path 前缀将以指定错误码失败 */
  faults: Record<string, string>;
  /** 慢响应演示：在一切请求之上追加 1.5–3s（显式 delay 的请求同样受影响） */
  slow: boolean;
  /** 写故障演示：全部写路径统一失败为该错误码（优先于前缀匹配） */
  writeFault: string | null;
  /** 是否离线只读（离线时禁止写操作） */
  readonlyOffline: boolean;
}

export const runtime: RuntimeConfig = {
  latency: [90, 280],
  offline: false,
  faults: {},
  slow: false,
  writeFault: null,
  readonlyOffline: true,
};

/** 慢响应演示的附加延迟区间（毫秒）：仅此一处注入，页面不感知 */
export const SLOW_EXTRA_MS: [number, number] = [1500, 3000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 统一请求入口：所有 mock API 都经此包装，保证一致的延迟/错误/离线语义 */
export async function request<T>(path: string, producer: () => T, opts: { write?: boolean; delay?: number } = {}): Promise<T> {
  const [lo, hi] = runtime.latency;
  const base = opts.delay ?? Math.round(lo + Math.random() * (hi - lo));
  // 慢响应演示：显式 delay 的请求同样追加，避免各调用方各自绕过注入点
  const delay = runtime.slow
    ? base + Math.round(SLOW_EXTRA_MS[0] + Math.random() * (SLOW_EXTRA_MS[1] - SLOW_EXTRA_MS[0]))
    : base;
  await wait(delay);

  if (runtime.offline) {
    if (opts.write && runtime.readonlyOffline) {
      throw makeError('DEPENDENCY_UNAVAILABLE', `${path} 离线态只读`);
    }
    throw makeError('DEPENDENCY_UNAVAILABLE', path);
  }

  if (opts.write && runtime.writeFault) throw makeError(runtime.writeFault, path);

  for (const prefix of Object.keys(runtime.faults)) {
    if (path.startsWith(prefix)) throw makeError(runtime.faults[prefix], path);
  }

  return producer();
}

/** 同步取数（首屏骨架用，不经过延迟） */
export function sync<T>(producer: () => T): T {
  return producer();
}

/** cursor 分页：cursor 编码为已消费条数 */
export function paginate<T>(all: readonly T[], q: Query = {}): Page<T> {
  const size = q.size ?? 20;
  const offset = q.cursor ? Number(q.cursor) : 0;
  const matched = q.keyword
    ? all.filter((it) => JSON.stringify(it).toLowerCase().includes(String(q.keyword).toLowerCase()))
    : all;
  const items = matched.slice(offset, offset + size);
  const next = offset + size < matched.length ? String(offset + size) : null;
  return { items, nextCursor: next, total: matched.length };
}

/** 取列表并应用 filters（值相等匹配；数组字段按包含匹配） */
export function filterList<T>(all: readonly T[], filters: Query['filters'] = {}): T[] {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return [...all];
  return all.filter((item) => {
    const rec = item as Record<string, unknown>;
    return entries.every(([k, v]) => {
      const cur = rec[k];
      if (Array.isArray(cur)) return cur.includes(v);
      return cur === v;
    });
  });
}

/** 模拟写操作：返回写入后的对象，并推送一条事件 */
export async function mutate<T>(path: string, producer: () => T, delay = 220): Promise<T> {
  return request(path, producer, { write: true, delay });
}
