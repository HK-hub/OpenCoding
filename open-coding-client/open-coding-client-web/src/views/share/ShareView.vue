<script setup lang="ts">
/**
 * 只读分享视图（分享/跟随端）。
 * 服务端二次投影：成本细节与工具参数在投影层已剥离，端上拿不到即不可能泄露。
 */
import { computed } from 'vue';
import { Button, MessagePlugin, Tag } from 'tdesign-vue-next';
import { useRoute } from 'vue-router';
import OcIcon from '@/components/common/OcIcon.vue';
import { downloadJson } from '@/utils/download';

const route = useRoute();
const token = computed(() => String(route.params.token ?? ''));

/** 投影结果：只含结论与证据引用，不含成本细节与工具参数 */
const projection = {
  title: '为 payment-core 增加幂等重试并补齐单测',
  owner: '沈亦舟',
  createdAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
  expiresAt: new Date(Date.now() + 6 * 24 * 3600_000).toISOString(),
  conclusion: [
    '幂等保证：持久层唯一约束 + 冲突时回读首次结果，同 key 只生效一次。',
    '重试策略：指数退避 1s / 2s / 4s，仅对可重试错误触发，最多 3 次。',
    '单测补齐：新增 12 例（并发重复提交、退避间隔、时钟回拨边界）。',
    '公开 API 未变更（内部重载实现）。',
  ],
  evidence: [
    'L1 静态：tsc/eslint 通过',
    'L2 可执行：mvn -pl payment-core test → 128 passed',
    '引用：repo://payment-core/src/main/java/.../PaymentServiceImpl.java#L88-L126@7f4c1a2',
  ],
  unverified: ['移动端并发场景未覆盖（缺少真机环境）'],
};

/** 下载投影快照：导出本页展示的二次投影内容（不含成本细节与工具参数） */
function downloadSnapshot() {
  const file = downloadJson(
    { token: token.value, projection, note: '只读分享投影（已剥离成本细节与工具参数），不含会话原文' },
    `share-projection-${token.value.slice(0, 8) || 'token'}.json`,
  );
  MessagePlugin.success('已生成 ' + file);
}
</script>

<template>
  <div class="share">
    <header class="share__head">
      <div class="oc-flex" style="gap: 8px">
        <span class="share__logo">OC</span>
        <div>
          <div style="font-weight: 600">{{ projection.title }}</div>
          <div class="oc-muted" style="font-size: 12px">
            只读分享 · 分享人 {{ projection.owner }} · 链接有效期至 {{ new Date(projection.expiresAt).toLocaleDateString('zh-CN') }}
          </div>
        </div>
      </div>
      <div class="oc-flex" style="gap: 6px">
        <Tag variant="outline" size="small">只读</Tag>
        <Tag variant="outline" size="small">已剥离成本细节</Tag>
        <Tag variant="outline" size="small">令牌 {{ token.slice(0, 8) }}…</Tag>
      </div>
    </header>

    <main class="share__body">
      <section class="oc-card">
        <h2 class="oc-card__title">结论</h2>
        <ul class="share__list">
          <li v-for="c in projection.conclusion" :key="c">{{ c }}</li>
        </ul>
      </section>
      <section class="oc-card">
        <h2 class="oc-card__title">证据引用</h2>
        <div class="oc-stack" style="gap: 6px">
          <div v-for="e in projection.evidence" :key="e" class="oc-flex" style="gap: 6px">
            <OcIcon name="link" size="14px" />
            <span class="oc-mono" style="font-size: 12px">{{ e }}</span>
          </div>
        </div>
      </section>
      <section class="oc-card">
        <h2 class="oc-card__title">未验证项（显式标注）</h2>
        <div class="oc-stack" style="gap: 4px">
          <div v-for="u in projection.unverified" :key="u" class="oc-flex" style="gap: 6px">
            <OcIcon name="error" size="14px" color="var(--oc-sev-warn)" />
            <span>{{ u }}</span>
          </div>
        </div>
      </section>
      <div class="oc-flex" style="gap: 8px; align-items: center">
        <Button variant="outline" @click="downloadSnapshot">下载投影快照</Button>
        <span class="oc-muted" style="font-size: 12px">链接已过期或无效？对外统一返回同一提示，不会是「会话是否存在」的探测入口</span>
      </div>
    </main>
  </div>
</template>

<style scoped>
.share {
  min-height: 100%;
  background: var(--oc-bg-page);
  display: flex;
  flex-direction: column;
}

.share__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  background: var(--oc-bg-container);
  border-bottom: 1px solid var(--oc-border);
}

.share__logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: linear-gradient(135deg, #0052d9, #2ba471);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.share__body {
  flex: 1;
  width: 880px;
  max-width: 94vw;
  margin: 16px auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.share__list {
  margin: 0;
  padding-left: 18px;
  line-height: 22px;
}
</style>
