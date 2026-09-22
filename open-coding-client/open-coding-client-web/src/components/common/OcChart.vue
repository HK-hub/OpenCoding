<script setup lang="ts">
/**
 * 轻量 SVG 图表集合（零第三方依赖，随 TDesign 主题变量着色）。
 * 支持：line / area / bar / stacked-bar / donut / radar / heatmap / gauge / waterfall / sparkline / funnel。
 * 统一遵守：色盲安全配色、悬浮提示、空数据占位、减少动效。
 */
import { computed, ref } from 'vue';

export interface ChartPoint {
  x: string;
  y: number;
}

export interface ChartSeries {
  name: string;
  points: ChartPoint[];
  color?: string;
}

const PALETTE = ['#0052d9', '#2ba471', '#e37318', '#8e5ee5', '#d54941', '#0f8b8d', '#b15c00', '#6b7c93'];

const props = withDefaults(
  defineProps<{
    type: 'line' | 'area' | 'bar' | 'stacked-bar' | 'donut' | 'radar' | 'heatmap' | 'gauge' | 'waterfall' | 'sparkline' | 'funnel';
    series?: ChartSeries[];
    /** donut/gauge/radar/heatmap 使用 */
    values?: { name: string; value: number }[];
    height?: number;
    /** 数值格式化（成本 4 位小数 / token k|M / 百分比） */
    format?: 'number' | 'cost' | 'token' | 'percent';
    /** 阈值线（如水位 80%） */
    threshold?: { value: number; label: string; kind?: 'max' | 'min' };
    /** heatmap：行标签 */
    rows?: string[];
    columns?: string[];
    /** 热力图矩阵（与 rows×columns 对应） */
    matrix?: number[][];
    unit?: string;
    ariaLabel?: string;
  }>(),
  {
    series: () => [],
    values: () => [],
    height: 220,
    format: 'number',
    unit: '',
    threshold: undefined,
    rows: () => [],
    columns: () => [],
    matrix: () => [],
    ariaLabel: '图表',
  },
);

const hover = ref<{ label: string; value: string; x: number; y: number } | null>(null);

function fmt(v: number): string {
  switch (props.format) {
    case 'cost':
      return v < 0.01 && v > 0 ? '<$0.01' : `$${v.toFixed(4)}`;
    case 'token':
      return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
    case 'percent':
      return `${v.toFixed(1)}%`;
    default:
      return v.toLocaleString('zh-CN');
  }
}

const W = 640;
const H = computed(() => props.height);
const PAD = { l: 44, r: 12, t: 14, b: 26 };

/** ---------- 折线 / 面积 / 柱状 ---------- */
const cartesian = computed(() => {
  const all = props.series.flatMap((s) => s.points.map((p) => p.y));
  const max = Math.max(1, ...all, props.threshold?.value ?? 0);
  const min = Math.min(0, ...all);
  const labels = props.series[0]?.points.map((p) => p.x) ?? [];
  const innerW = W - PAD.l - PAD.r;
  const innerH = H.value - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - min) / (max - min || 1)) * innerH;
  const paths = props.series.map((s, si) => {
    const pts = s.points.map((p, i) => `${x(i)},${y(p.y)}`);
    const d = pts.length ? `M${pts.join('L')}` : '';
    const area = pts.length ? `${d}L${x(s.points.length - 1)},${y(min)}L${x(0)},${y(min)}Z` : '';
    return { name: s.name, d, area, color: s.color ?? PALETTE[si % PALETTE.length], points: pts };
  });
  const bars = props.series.map((s, si) => ({
    name: s.name,
    color: s.color ?? PALETTE[si % PALETTE.length],
    rects: s.points.map((p, i) => {
      const bw = Math.max(2, innerW / Math.max(1, s.points.length) / (props.series.length * 1.4));
      const cx = PAD.l + (i / Math.max(1, s.points.length - 1 || 1)) * innerW;
      return { x: cx - bw / 2 + si * (bw + 1), y: y(p.y), w: bw, h: Math.max(1, y(min) - y(p.y)), label: p.x, value: p.y };
    }),
  }));
  const stacked = props.series.length
    ? labels.map((lb, i) => {
        let acc = 0;
        const segs = props.series.map((s, si) => {
          const v = s.points[i]?.y ?? 0;
          const h = ((v / (max - min || 1)) * innerH);
          const seg = { y: PAD.t + innerH - acc - h, h, color: PALETTE[si % PALETTE.length], name: s.name, value: v, label: lb };
          acc += h;
          return seg;
        });
        const bw = Math.max(3, (innerW / Math.max(1, labels.length)) * 0.6);
        const cx = PAD.l + (i / Math.max(1, labels.length - 1 || 1)) * innerW;
        return { x: cx - bw / 2, w: bw, segs, label: lb };
      })
    : [];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ v: min + (max - min) * t, y: y(min + (max - min) * t) }));
  return { max, min, labels, x, y, paths, bars, stacked, ticks, innerW, innerH };
});

/** ---------- 环形 / 水表 / 漏斗 ---------- */
const donut = computed(() => {
  const total = props.values.reduce((a, b) => a + b.value, 0) || 1;
  let acc = -Math.PI / 2;
  const r = 70;
  const cx = 100;
  const cy = 100;
  return props.values.map((v, i) => {
    const ang = (v.value / total) * Math.PI * 2;
    const start = acc;
    const end = acc + ang;
    acc = end;
    const large = ang > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    return {
      name: v.name,
      value: v.value,
      pct: (v.value / total) * 100,
      color: PALETTE[i % PALETTE.length],
      d: `M${x1},${y1}A${r},${r} 0 ${large} 1 ${x2},${y2}`,
    };
  });
});

const gauge = computed(() => {
  const v = props.values[0]?.value ?? 0;
  const target = props.threshold?.value ?? 100;
  const pct = Math.min(100, (v / (target || 1)) * 100);
  const ang = -180 + (pct / 100) * 180;
  const r = 70;
  const rad = (ang * Math.PI) / 180;
  return {
    pct,
    color: props.threshold?.kind === 'max'
      ? (v <= target ? '#2ba471' : '#d54941')
      : (v >= target ? '#2ba471' : '#e37318'),
    end: { x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) },
    label: props.values[0]?.name ?? '当前值',
  };
});

const radar = computed(() => {
  const n = props.values.length || 1;
  const cx = 110;
  const cy = 105;
  const r = 74;
  const axis = props.values.map((v, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { ...v, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), lx: cx + (r + 18) * Math.cos(a), ly: cy + (r + 18) * Math.sin(a) };
  });
  const d = axis.map((p, i) => {
    const norm = Math.min(1, p.value / 100);
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return `${i === 0 ? 'M' : 'L'}${cx + r * norm * Math.cos(a)},${cy + r * norm * Math.sin(a)}`;
  }).join('') + 'Z';
  return { axis, d, cx, cy, r };
});

const heat = computed(() => {
  const flat = props.matrix.flat();
  const max = Math.max(1, ...flat);
  return props.matrix.map((row, ri) =>
    row.map((v, ci) => ({
      v,
      ri,
      ci,
      color: `rgba(0, 82, 217, ${0.08 + (v / max) * 0.72})`,
    })),
  );
});

const waterfall = computed(() => {
  const vals = props.values;
  const total = vals.reduce((a, b) => a + b.value, 0);
  let acc = 0;
  const innerW = W - PAD.l - PAD.r;
  const barW = innerW / Math.max(1, vals.length) - 8;
  return vals.map((v, i) => {
    const isTotal = i === vals.length - 1;
    const start = acc;
    acc += v.value;
    const top = Math.max(start, acc);
    return {
      x: PAD.l + i * (barW + 8) + 4,
      y: total ? PAD.t + (1 - top / total) * (H.value - PAD.t - PAD.b) : 0,
      h: total ? Math.max(2, (Math.abs(v.value) / total) * (H.value - PAD.t - PAD.b)) : 2,
      name: v.name,
      value: v.value,
      color: isTotal ? '#0052d9' : v.value >= 0 ? '#2ba471' : '#d54941',
    };
  });
});

const funnel = computed(() => {
  const vals = props.values;
  const max = Math.max(1, ...vals.map((v) => v.value));
  const innerW = W - PAD.l - PAD.r;
  return vals.map((v, i) => {
    const w = (v.value / max) * innerW;
    const h = (H.value - PAD.t - PAD.b) / Math.max(1, vals.length) - 6;
    return { ...v, x: PAD.l + (innerW - w) / 2, y: PAD.t + i * (h + 6), w, h, color: PALETTE[i % PALETTE.length] };
  });
});

/** 图例项：环图/柱状通用，模板直接消费避免复杂推导 */
const legendItems = computed<{ name: string; color?: string }[]>(() => {
  if (props.type === 'donut') return props.values.map((v, i) => ({ name: v.name, color: donut.value[i]?.color }));
  return props.series.map((sv, i) => ({ name: sv.name, color: sv.color ?? PALETTE[i % PALETTE.length] }));
});

const empty = computed(() => {
  if (props.type === 'donut' || props.type === 'radar' || props.type === 'gauge' || props.type === 'waterfall' || props.type === 'funnel') {
    return props.values.length === 0;
  }
  if (props.type === 'heatmap') return props.matrix.length === 0;
  return props.series.length === 0 || props.series.every((s) => s.points.length === 0);
});

function showTip(label: string, value: number, evt: MouseEvent) {
  const target = evt.currentTarget as SVGElement;
  const box = (target.ownerSVGElement?.parentElement as HTMLElement)?.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  hover.value = {
    label,
    value: fmt(value) + (props.unit ? ` ${props.unit}` : ''),
    x: rect.left - (box?.left ?? 0) + rect.width / 2,
    y: rect.top - (box?.top ?? 0) - 6,
  };
}
</script>

<template>
  <div class="oc-chart" :aria-label="ariaLabel" role="img">
    <div v-if="empty" class="oc-chart__empty">暂无数据（采集延迟通常在 1 分钟内）</div>

    <svg v-else :viewBox="`0 0 ${W} ${height}`" :height="height" preserveAspectRatio="none" class="oc-chart__svg">
      <!-- 折线 / 面积 -->
      <template v-if="type === 'line' || type === 'area' || type === 'sparkline'">
        <g v-for="t in (type === 'sparkline' ? [] : cartesian.ticks)" :key="t.v">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="t.y" :y2="t.y" stroke="var(--oc-border)" stroke-dasharray="3 3" />
          <text :x="PAD.l - 6" :y="t.y + 4" text-anchor="end" font-size="10" fill="var(--td-text-color-placeholder)">
            {{ fmt(t.v) }}
          </text>
        </g>
        <line
          v-if="threshold"
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="cartesian.y(threshold.value)"
          :y2="cartesian.y(threshold.value)"
          stroke="var(--oc-sev-warn)"
          stroke-dasharray="4 4"
        />
        <text
          v-if="threshold"
          :x="W - PAD.r"
          :y="cartesian.y(threshold.value) - 4"
          text-anchor="end"
          font-size="10"
          fill="var(--oc-sev-warn)"
        >
          {{ threshold.label }}
        </text>
        <template v-for="(p, i) in cartesian.paths" :key="p.name">
          <path v-if="type !== 'sparkline'" :d="p.area" :fill="p.color" opacity="0.1" />
          <path :d="p.d" fill="none" :stroke="p.color" stroke-width="1.8" />
          <circle
            v-for="(pt, pi) in p.points"
            :key="pi"
            :cx="pt.split(',')[0]"
            :cy="pt.split(',')[1]"
            r="3"
            :fill="p.color"
            @mouseenter="showTip(cartesian.labels[pi], series[i].points[pi].y, $event)"
            @mouseleave="hover = null"
          />
        </template>
      </template>

      <!-- 柱状 -->
      <template v-else-if="type === 'bar'">
        <g v-for="t in cartesian.ticks" :key="t.v">
          <line :x1="PAD.l" :x2="W - PAD.r" :y1="t.y" :y2="t.y" stroke="var(--oc-border)" stroke-dasharray="3 3" />
          <text :x="PAD.l - 6" :y="t.y + 4" text-anchor="end" font-size="10" fill="var(--td-text-color-placeholder)">{{ fmt(t.v) }}</text>
        </g>
        <template v-for="b in cartesian.bars" :key="b.name">
          <rect
            v-for="(r, ri) in b.rects"
            :key="ri"
            :x="r.x"
            :y="r.y"
            :width="r.w"
            :height="r.h"
            :fill="b.color"
            rx="2"
            opacity="0.9"
            @mouseenter="showTip(r.label, r.value, $event)"
            @mouseleave="hover = null"
          />
        </template>
      </template>

      <!-- 堆叠柱 -->
      <template v-else-if="type === 'stacked-bar'">
        <rect
          v-for="(col, ci) in cartesian.stacked"
          :key="ci"
          :x="col.x"
          :y="PAD.t"
          :width="col.w"
          :height="height - PAD.t - PAD.b"
          fill="transparent"
        />
        <template v-for="(col, ci) in cartesian.stacked" :key="`s${ci}`">
          <rect
            v-for="(seg, si) in col.segs"
            :key="si"
            :x="col.x"
            :y="seg.y"
            :width="col.w"
            :height="Math.max(0, seg.h)"
            :fill="seg.color"
            opacity="0.9"
            @mouseenter="showTip(`${col.label} · ${seg.name}`, seg.value, $event)"
            @mouseleave="hover = null"
          />
        </template>
      </template>

      <!-- 环形 -->
      <g v-else-if="type === 'donut'" :transform="`translate(${(W - 200) / 2}, 0)`">
        <circle cx="100" cy="100" r="70" fill="none" stroke="var(--oc-border)" stroke-width="22" />
        <path
          v-for="(d, i) in donut"
          :key="i"
          :d="d.d"
          :stroke="d.color"
          stroke-width="22"
          fill="none"
          @mouseenter="showTip(d.name, d.value, $event)"
          @mouseleave="hover = null"
        />
        <text x="100" y="98" text-anchor="middle" font-size="12" fill="var(--td-text-color-secondary)">合计</text>
        <text x="100" y="118" text-anchor="middle" font-size="16" font-weight="600" fill="var(--td-text-color-primary)">
          {{ fmt(values.reduce((a, b) => a + b.value, 0)) }}
        </text>
      </g>

      <!-- 水表 -->
      <g v-else-if="type === 'gauge'" :transform="`translate(${(W - 200) / 2}, 20)`">
        <path d="M30,100 A70,70 0 0 1 170,100" fill="none" stroke="var(--oc-border)" stroke-width="14" />
        <path
          :d="`M30,100 A70,70 0 0 1 ${gauge.end.x},${gauge.end.y}`"
          :stroke="gauge.color"
          stroke-width="14"
          fill="none"
        />
        <text x="100" y="92" text-anchor="middle" font-size="20" font-weight="600" fill="var(--td-text-color-primary)">
          {{ gauge.pct.toFixed(0) }}%
        </text>
        <text x="100" y="112" text-anchor="middle" font-size="11" fill="var(--td-text-color-secondary)">{{ gauge.label }}</text>
      </g>

      <!-- 雷达 -->
      <g v-else-if="type === 'radar'" :transform="`translate(${(W - 220) / 2}, 0)`">
        <polygon
          v-for="lvl in [0.25, 0.5, 0.75, 1]"
          :key="lvl"
          :points="radar.axis.map((_, i) => {
            const a = -Math.PI / 2 + (i / radar.axis.length) * Math.PI * 2;
            return `${radar.cx + radar.r * lvl * Math.cos(a)},${radar.cy + radar.r * lvl * Math.sin(a)}`;
          }).join(' ')"
          fill="none"
          stroke="var(--oc-border)"
        />
        <line
          v-for="(p, i) in radar.axis"
          :key="`a${i}`"
          :x1="radar.cx"
          :y1="radar.cy"
          :x2="p.x"
          :y2="p.y"
          stroke="var(--oc-border)"
        />
        <path :d="radar.d" fill="rgba(0,82,217,0.18)" stroke="#0052d9" stroke-width="1.6" />
        <text
          v-for="(p, i) in radar.axis"
          :key="`l${i}`"
          :x="p.lx"
          :y="p.ly"
          text-anchor="middle"
          font-size="10"
          fill="var(--td-text-color-secondary)"
        >
          {{ p.name }} {{ p.value }}
        </text>
      </g>

      <!-- 热力图 -->
      <g v-else-if="type === 'heatmap'">
        <template v-for="(row, ri) in heat" :key="ri">
          <rect
            v-for="cell in row"
            :key="`${ri}-${cell.ci}`"
            :x="60 + cell.ci * ((W - 80) / Math.max(1, columns.length))"
            :y="PAD.t + ri * ((height - PAD.t - PAD.b) / Math.max(1, rows.length))"
            :width="(W - 80) / Math.max(1, columns.length) - 2"
            :height="(height - PAD.t - PAD.b) / Math.max(1, rows.length) - 2"
            :fill="cell.color"
            rx="2"
            @mouseenter="showTip(`${rows[ri]} · ${columns[cell.ci]}`, cell.v, $event)"
            @mouseleave="hover = null"
          />
          <text x="52" :y="PAD.t + ri * ((height - PAD.t - PAD.b) / Math.max(1, rows.length)) + 14" text-anchor="end" font-size="10" fill="var(--td-text-color-secondary)">
            {{ rows[ri] }}
          </text>
        </template>
      </g>

      <!-- 瀑布 -->
      <template v-else-if="type === 'waterfall'">
        <rect
          v-for="(b, i) in waterfall"
          :key="i"
          :x="b.x"
          :y="b.y"
          :width="40"
          :height="b.h"
          :fill="b.color"
          rx="2"
          @mouseenter="showTip(b.name, b.value, $event)"
          @mouseleave="hover = null"
        />
        <text
          v-for="(b, i) in waterfall"
          :key="`t${i}`"
          :x="b.x + 20"
          :y="height - 8"
          text-anchor="middle"
          font-size="10"
          fill="var(--td-text-color-secondary)"
        >
          {{ b.name }}
        </text>
      </template>

      <!-- 漏斗 -->
      <template v-else-if="type === 'funnel'">
        <rect
          v-for="(s, i) in funnel"
          :key="i"
          :x="s.x"
          :y="s.y"
          :width="s.w"
          :height="s.h"
          :fill="s.color"
          rx="3"
          opacity="0.9"
          @mouseenter="showTip(s.name, s.value, $event)"
          @mouseleave="hover = null"
        />
        <text
          v-for="(s, i) in funnel"
          :key="`f${i}`"
          :x="PAD.l + 6"
          :y="s.y + s.h / 2 + 4"
          font-size="11"
          fill="var(--td-text-color-primary)"
        >
          {{ s.name }} · {{ fmt(s.value) }}
        </text>
      </template>
    </svg>

    <!-- 图例 -->
    <div v-if="!empty && legendItems.length > 1" class="oc-chart__legend">
      <span v-for="(s, i) in legendItems" :key="s.name" class="oc-flex" style="gap: 4px">
        <i :style="{ background: s.color ?? PALETTE[i % PALETTE.length] }" class="oc-chart__dot" />
        {{ s.name }}
      </span>
    </div>
    <div v-else-if="!empty && type === 'funnel'" class="oc-chart__legend">
      <span v-for="(v, i) in values" :key="v.name" class="oc-flex" style="gap: 4px">
        <i :style="{ background: PALETTE[i % PALETTE.length] }" class="oc-chart__dot" />
        {{ v.name }}
      </span>
    </div>

    <div v-if="hover" class="oc-chart__tip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
      <div class="oc-muted" style="font-size: 11px">{{ hover.label }}</div>
      <div style="font-weight: 600">{{ hover.value }}</div>
    </div>
  </div>
</template>

<style scoped>
.oc-chart {
  position: relative;
  width: 100%;
}

.oc-chart__svg {
  width: 100%;
  display: block;
  shape-rendering: geometricPrecision;
}

.oc-chart__empty {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder, #8f8f8f);
  font-size: 12px;
  border: 1px dashed var(--oc-border);
  border-radius: 4px;
}

.oc-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--td-text-color-secondary, #666);
  margin-top: 6px;
}

.oc-chart__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.oc-chart__tip {
  position: absolute;
  transform: translate(-50%, -100%);
  background: var(--td-bg-color-container, #fff);
  border: 1px solid var(--oc-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
  z-index: 5;
}
</style>
