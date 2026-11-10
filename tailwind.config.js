/** Design tokens from SPEC section 12. All sizes are rem-based so font scaling applies everywhere. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAF8F5',
        card: '#FFFFFF',
        ink: '#1F2328',
        muted: '#5B616B',
        line: '#E6E1DA',
        brand: '#C8102E',
        'info-bg': '#E8F1FB',
        'info-fg': '#1D4E89',
        'ok-bg': '#E7F4EC',
        'ok-fg': '#1E6B3A',
        'warn-bg': '#FDF3E1',
        'warn-fg': '#8A5A00',
        'risk-bg': '#FBE9E9',
        'risk-fg': '#9B1C1C',
      },
      borderRadius: { card: '0.625rem' },
      boxShadow: { card: '0 1px 3px rgba(31, 35, 40, 0.06)' },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
