/**
 * 确定性伪随机与生成工具。
 * 全部 mock 数据由固定种子生成，保证每次刷新数据一致（可复现）。
 */

export class Rng {
  private state: number;

  constructor(seed = 20260921) {
    this.state = seed >>> 0;
  }

  /** xorshift32：确定性、无依赖 */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }

  /** [min, max] 整数 */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** [min, max] 浮点，保留 d 位 */
  float(min: number, max: number, d = 2): number {
    const v = this.next() * (max - min) + min;
    const p = 10 ** d;
    return Math.round(v * p) / p;
  }

  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 不重复抽取 n 个 */
  sample<T>(arr: readonly T[], n: number): T[] {
    const pool = [...arr];
    const out: T[] = [];
    const count = Math.min(n, pool.length);
    for (let i = 0; i < count; i += 1) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0]);
    }
    return out;
  }

  /** 加权抽取：weights 与 items 等长 */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i += 1) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** 按概率从主值/备选中取，weights=[主,备...] */
  maybe<T>(primary: T, ...alternatives: T[]): T {
    return this.weighted([primary, ...alternatives], [6, ...alternatives.map(() => 1)]);
  }

  id(prefix: string, n = 6): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < n; i += 1) s += alphabet[Math.floor(this.next() * alphabet.length)];
    return `${prefix}-${s}`;
  }

  /** UUIDv7 形态（时间序前缀 + 随机尾巴） */
  uuid(seq = 0): string {
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    const rnd = () => `${hex(this.int(0, 255))}${hex(this.int(0, 255))}`;
    const ts = (1758412800000 + seq * 137).toString(16);
    return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
  }

  /** 相对当前时间往前 minutes 分钟，返回 ISO 字符串 */
  ago(minutes: number): string {
    return new Date(Date.now() - minutes * 60_000).toISOString();
  }

  agoHours(h: number): string {
    return this.ago(h * 60);
  }

  agoDays(d: number): string {
    return this.ago(d * 60 * 24);
  }

  future(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toISOString();
  }
}

export const rng = new Rng(20260921);

/** 生成递增的序号计数器 */
export function counter(start = 1) {
  let n = start;
  return () => n++;
}

/** 取模分组，用于稳定分桶（灰度/哈希） */
export function bucketOf(key: string, buckets: number): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % buckets;
}

/** 生成时间序列（用于图表） */
export function series(
  r: Rng,
  points: number,
  base: number,
  variance = 0.2,
  stepMinutes = 60,
): { ts: string; value: number }[] {
  const out: { ts: string; value: number }[] = [];
  let v = base;
  for (let i = points - 1; i >= 0; i -= 1) {
    v = Math.max(0, v * (1 + (r.next() - 0.5) * variance));
    out.push({ ts: r.ago(i * stepMinutes), value: Math.round(v * 100) / 100 });
  }
  return out;
}

/** 中文姓名池 */
export const NAMES = [
  '沈亦舟', '林晚照', '顾清和', '周砚青', '陆知微', '江月白', '许怀山', '苏慕言',
  '陈鹿鸣', '韩秋水', '方岑溪', '叶听澜', '程向晚', '唐见微', '秦越人', '温如故',
  '柏一川', '贺清尘', '施予安', '樊若谷',
] as const;

/** 仓库/项目名池 */
export const REPOS = [
  'payment-core', 'identity-gateway', 'data-pipeline', 'web-console', 'mobile-bff',
  'billing-ledger', 'search-index', 'notification-hub', 'asset-service', 'risk-engine',
] as const;

export const BRANCHES = ['main', 'develop', 'release/2.8', 'release/2.9'] as const;

export const ORG_NAME = '云枢科技';
export const TENANT_NAME = '云枢科技（企业版）';
