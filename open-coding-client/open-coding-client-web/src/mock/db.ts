/**
 * mock 数据库门面。
 * - 汇总核心共享数据（会话/上下文/成本/授权记忆/搜索语料）
 * - 各域数据模块可被页面直接 import（`@/mock/data/<domain>`），
 *   本文件只做跨域聚合与统一检索，避免巨型单文件。
 */
import { rng, Rng } from './rng';
import { buildSessionData, type SessionData } from './data/session';
import { buildSearchCorpus, type SearchHit } from './data/search-corpus';
import { request, type Query } from './runtime';

export interface Db extends SessionData {
  searchCorpus: SearchHit[];
  buildTime: string;
}

const sessionData = buildSessionData(new Rng(20260921));
const corpus = buildSearchCorpus(new Rng(7));

export const db: Db = {
  ...sessionData,
  searchCorpus: corpus,
  buildTime: new Date().toISOString(),
};

export type { SearchHit };

/** 统一搜索：按来源过滤 + 关键词匹配（模拟前置权限过滤：restricted 命中会被标注） */
export async function searchAll(keyword: string, source?: string): Promise<SearchHit[]> {
  return request('/api/v1/search', () => {
    const kw = keyword.toLowerCase();
    return db.searchCorpus
      .filter((h) => (!source || h.source === source))
      .filter((h) => `${h.title}${h.snippet}${h.source}`.toLowerCase().includes(kw))
      .slice(0, 60);
  }, { delay: 120 });
}

/** 通用列表查询：配合各域数据模块使用 */
export function listOf<T>(all: readonly T[]) {
  return async (q: Query = {}) => {
    const { filterList, paginate } = await import('./runtime');
    return request('/api/v1/list', () => paginate(filterList(all, q.filters), q), { delay: 160 });
  };
}

export { rng };
