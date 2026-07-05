/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/admin/**/*.{html,js,jsx}',
    './src/miniapp/**/*.{html,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces (Professional Light) ───────────────────────────
        canvas: '#f1f5f9',
        surface: '#ffffff',
        'surface-hover': '#f8fafc',
        'surface-muted': '#f8fafc',
        'surface-input': '#ffffff',
        'surface-glass': 'rgba(255, 255, 255, 0.85)',
        // ── Text ────────────────────────────────────────────────────
        ink: '#0f172a',
        'ink-soft': '#334155',
        muted: '#64748b',
        'muted-light': '#94a3b8',
        'muted-2': '#cbd5e1',
        // ── Lines / borders ─────────────────────────────────────────
        border: '#e2e8f0',
        'border-light': '#f1f5f9',
        line: '#e2e8f0',
        // ── Brand / accent (Professional Indigo) ────────────────────
        primary: '#4f46e5',
        'primary-600': '#4338ca',
        'primary-700': '#3730a3',
        'primary-tint': '#eef2ff',
        brand: '#4f46e5',
        'brand-soft': '#818cf8',
        'brand-ink': '#4338ca',
        // ── Status colors ──────────────────────────────────────────
        success: '#10b981',
        'success-soft': '#d1fae5',
        warning: '#f59e0b',
        'warning-soft': '#fef3c7',
        danger: '#ef4444',
        'danger-soft': '#fee2e2',
        info: '#0ea5e9',
        'info-soft': '#e0f2fe',
        // ── Data viz palette ────────────────────────────────────────
        'accent-blue': '#3b82f6',
        'accent-indigo': '#4f46e5',
        'accent-purple': '#8b5cf6',
        'accent-cyan': '#06b6d4',
        'accent-emerald': '#10b981',
        'accent-amber': '#f59e0b',
        'accent-rose': '#ef4444',
      },
      animation: {
        'toast-in': 'toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'modal-in': 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.25s ease',
        'spin-slow': 'spin 0.6s linear infinite',
        'fade-in': 'fadeIn 0.2s ease',
        'count-up': 'countUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        toastIn: {
          from: { transform: 'translateX(100%) translateY(-10px)', opacity: '0' },
          to: { transform: 'translateX(0) translateY(0)', opacity: '1' },
        },
        modalIn: {
          from: { transform: 'scale(0.96) translateY(16px)', opacity: '0' },
          to: { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        countUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'card-lg': '0 16px 48px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.04)',
        pop: '0 20px 60px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.06)',
        'focus-ring': '0 0 0 3px rgba(79, 70, 229, 0.25)',
        'sidebar': '4px 0 20px rgba(0, 0, 0, 0.06)',
        'elevated': '0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
