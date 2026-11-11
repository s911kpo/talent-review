/**
 * Design tokens. v2 (2026-11-12): cool neutral canvas, deep navy navigation, one blue for actions,
 * Molex red kept for the brand mark and the active-navigation accent only. See docs/DECISIONS.md.
 * All sizes are rem-based so font scaling applies everywhere.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F4F6FA',
        card: '#FFFFFF',
        subtle: '#F8FAFC',
        ink: '#101828',
        muted: '#5D6B82',
        faint: '#8A94A6',
        line: '#E4E8F0',
        brand: '#C8102E',
        primary: { DEFAULT: '#2A5BD7', hover: '#2149B3', soft: '#EEF3FF', ink: '#1F4CB8' },
        navy: { DEFAULT: '#0E1B33', 2: '#16264A', line: '#22335A', text: '#B9C3D9' },
        'info-bg': '#EAF1FE',
        'info-fg': '#1F4CB8',
        'ok-bg': '#E6F6EE',
        'ok-fg': '#11693F',
        'warn-bg': '#FEF5E3',
        'warn-fg': '#8A5300',
        'risk-bg': '#FDECEC',
        'risk-fg': '#A61B1B',
      },
      borderRadius: { card: '0.875rem' },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 4px 16px rgba(16, 24, 40, 0.04)',
        lift: '0 2px 4px rgba(16, 24, 40, 0.06), 0 12px 32px rgba(16, 24, 40, 0.10)',
      },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', '"Noto Sans TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
