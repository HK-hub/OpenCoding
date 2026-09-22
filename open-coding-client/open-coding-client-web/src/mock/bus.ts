/**
 * 实时通道模拟：事件总线 + 流式帧生成。
 * 对应 harness 双通道设计——durable（带 seq 可重放）与 live（不落库、可丢）。
 */

export interface StreamFrame<T = unknown> {
  kind: 'durable' | 'live';
  channel: string;
  seq: number;
  ts: string;
  type: string;
  payload: T;
}

type Listener = (frame: StreamFrame<any>) => void;

class MockBus {
  private listeners = new Map<string, Set<Listener>>();

  private seqs = new Map<string, number>();

  private timers = new Set<number>();

  /** 订阅频道，返回取消订阅函数 */
  subscribe(channel: string, fn: Listener): () => void {
    if (!this.listeners.has(channel)) this.listeners.set(channel, new Set());
    this.listeners.get(channel)!.add(fn);
    return () => this.listeners.get(channel)?.delete(fn);
  }

  nextSeq(channel: string): number {
    const cur = (this.seqs.get(channel) ?? 0) + 1;
    this.seqs.set(channel, cur);
    return cur;
  }

  emit<T>(channel: string, type: string, payload: T, kind: 'durable' | 'live' = 'durable'): void {
    const frame: StreamFrame<T> = {
      kind,
      channel,
      seq: this.nextSeq(channel),
      ts: new Date().toISOString(),
      type,
      payload,
    };
    this.listeners.get(channel)?.forEach((fn) => fn(frame));
  }

  /** 周期性推送（返回停止函数） */
  interval(channel: string, type: string, producer: () => unknown, ms: number, kind: 'durable' | 'live' = 'live'): () => void {
    const id = window.setInterval(() => this.emit(channel, type, producer(), kind), ms);
    this.timers.add(id);
    return () => {
      window.clearInterval(id);
      this.timers.delete(id);
    };
  }

  clear(): void {
    this.timers.forEach((id) => window.clearInterval(id));
    this.timers.clear();
    this.listeners.clear();
  }
}

export const bus = new MockBus();

/** 流式文本切分：把一段回答切成逐块增量，用于模拟 SSE token 流 */
export function chunkText(text: string, r: () => number, size = 6): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const n = size + Math.floor(r() * size);
    out.push(text.slice(i, i + n));
    i += n;
  }
  return out;
}

/** 模拟流式响应：按块回调，支持中断 */
export async function streamText(
  text: string,
  onChunk: (chunk: string, done: boolean) => void,
  opts: { chunkDelayMs?: number; seed?: () => number } = {},
): Promise<void> {
  const r = opts.seed ?? (() => Math.random());
  const chunks = chunkText(text, r);
  const delay = opts.chunkDelayMs ?? 22;
  for (let i = 0; i < chunks.length; i += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    onChunk(chunks[i], i === chunks.length - 1);
  }
}

/** 可中断任务句柄 */
export function ctrl() {
  let aborted = false;
  return {
    get aborted() {
      return aborted;
    },
    abort() {
      aborted = true;
    },
  };
}
