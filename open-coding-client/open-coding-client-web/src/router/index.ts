import { createRouter, createWebHashHistory } from 'vue-router';
import type { OcRoute, OcRouteMeta } from './types';

/**
 * 路由装配。
 * 各域路由模块位于 `src/router/modules/*.ts`，默认导出 OcRoute[]，
 * 由本文件自动收集并构建导航树 —— 新增域只需新增一个模块文件。
 */
const modules = import.meta.glob<{ default: OcRoute[] }>('./modules/*.ts', { eager: true });

export const domainRoutes: OcRoute[] = Object.values(modules)
  .flatMap((m) => m.default ?? [])
  .sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));

const shellRoutes: OcRoute[] = [
  {
    path: '/',
    component: () => import('@/layouts/WorkbenchLayout.vue'),
    children: [
      { path: '', redirect: '/session' },
      ...domainRoutes,
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/common/NotFound.vue'),
        meta: { title: '页面不存在', hidden: true },
      },
    ],
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/onboarding/OnboardingWizard.vue'),
    meta: { title: '首次运行向导', hidden: true, surface: 'wizard' },
  },
  {
    path: '/share/:token',
    name: 'share-view',
    component: () => import('@/views/share/ShareView.vue'),
    meta: { title: '只读分享视图', hidden: true, surface: 'share' },
  },
  {
    path: '/boot',
    name: 'boot',
    component: () => import('@/views/common/BootPage.vue'),
    meta: { title: '启动诊断', hidden: true },
  },
];

export interface NavItem {
  title: string;
  path: string;
  icon: string;
  desc?: string;
  experimental?: boolean;
  surface?: string;
}

export interface NavGroup {
  name: string;
  order: number;
  items: NavItem[];
}

/** 由路由表派生导航分组（单源，避免菜单与路由漂移） */
export function buildNav(): NavGroup[] {
  const map = new Map<string, NavGroup>();
  domainRoutes.forEach((r) => {
    const meta = (r.meta ?? {}) as unknown as OcRouteMeta;
    if (meta.hidden || !meta.group) return;
    if (!map.has(meta.group)) {
      map.set(meta.group, { name: meta.group, order: meta.groupOrder ?? 99, items: [] });
    }
    map.get(meta.group)!.items.push({
      title: meta.title,
      path: r.path,
      icon: meta.icon ?? 'app',
      desc: meta.desc,
      experimental: meta.experimental,
      surface: meta.surface,
    });
  });
  return [...map.values()].sort((a, b) => a.order - b.order);
}

/** 命令面板数据源：所有可见页面 + 常用动作 */
export function buildCommands(): { id: string; title: string; group: string; keywords: string; path: string; run: () => void }[] {
  const cmds = domainRoutes
    .filter((r) => !((r.meta ?? {}) as OcRouteMeta).hidden)
    .map((r) => {
      const meta = (r.meta ?? {}) as unknown as OcRouteMeta;
      return {
        id: `go:${r.path}`,
        title: meta.title,
        group: meta.group ?? '页面',
        keywords: `${meta.title} ${meta.desc ?? ''} ${r.path}`,
        path: r.path,
        run: () => {
          window.location.hash = `#${r.path}`;
        },
      };
    });
  return cmds;
}

export const router = createRouter({
  history: createWebHashHistory(),
  routes: shellRoutes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const meta = to.meta as unknown as OcRouteMeta | undefined;
  document.title = meta?.title ? `${meta.title} · OpenCoding Harness` : 'OpenCoding Harness';
});

export default router;
