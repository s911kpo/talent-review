import ReactECharts from 'echarts-for-react';

// Color-blind-safe categorical palette; risk colors follow SPEC 12.
export const PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00'];
export const RISK_COLORS: Record<string, string> = { Low: '#2E8B57', Medium: '#D9A01B', High: '#B3261E' };
export const BENCH_COLORS: Record<string, string> = { strong: '#2E8B57', developing: '#0072B2', thin: '#D9A01B', gap: '#B3261E' };

export interface ChartClick {
  name?: string;
  seriesName?: string;
  dataIndex?: number;
  data?: unknown;
}

export function Chart({ option, label, height = 300, onClick }: {
  option: Record<string, unknown>; label: string; height?: number; onClick?: (p: ChartClick) => void;
}) {
  return (
    <div role="img" aria-label={label}>
      <ReactECharts
        option={{ color: PALETTE, textStyle: { fontFamily: '"Noto Sans TC", Inter, sans-serif' }, ...option }}
        style={{ height }}
        notMerge
        onEvents={onClick ? { click: onClick } : undefined}
      />
    </div>
  );
}
