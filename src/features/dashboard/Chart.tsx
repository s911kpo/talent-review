import ReactECharts from 'echarts-for-react';

// Categorical slots in fixed order (validated color-blind-safe order, dataviz reference palette).
export const PALETTE = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#6250D6'];
// Status colors are reserved for state (risk, bench) and always appear next to a text label.
export const STATUS = { good: '#0CA30C', warning: '#FAB219', serious: '#EC835A', critical: '#D03B3B', neutral: '#C3C9D5' };
export const RISK_COLORS: Record<string, string> = { Low: STATUS.good, Medium: STATUS.warning, High: STATUS.critical };
export const BENCH_COLORS: Record<string, string> = { strong: STATUS.good, developing: '#2A78D6', thin: STATUS.warning, gap: STATUS.critical };
export const INK = { primary: '#101828', secondary: '#5D6B82', grid: '#E4E8F0', axis: '#C3C9D5' };

export interface ChartClick {
  name?: string;
  seriesName?: string;
  dataIndex?: number;
  data?: unknown;
}

export function Chart({ option, label, height = 260, onClick }: {
  option: Record<string, unknown>; label: string; height?: number; onClick?: (p: ChartClick) => void;
}) {
  return (
    <div role="img" aria-label={label}>
      <ReactECharts
        option={{
          color: PALETTE,
          textStyle: { fontFamily: 'Inter, "Segoe UI", "Noto Sans TC", "Microsoft JhengHei", sans-serif', color: INK.secondary },
          tooltip: { backgroundColor: '#101828', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 }, padding: [6, 10] },
          ...option,
        }}
        style={{ height }}
        notMerge
        onEvents={onClick ? { click: onClick } : undefined}
      />
    </div>
  );
}
