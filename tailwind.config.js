/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'hsl(var(--color-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--color-surface) / <alpha-value>)',
          raised: 'hsl(var(--color-surface-raised) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'hsl(var(--color-ink) / <alpha-value>)',
          soft: 'hsl(var(--color-ink-soft) / <alpha-value>)',
          muted: 'hsl(var(--color-ink-muted) / <alpha-value>)',
        },
        line: 'hsl(var(--color-line) / <alpha-value>)',
        accent: {
          DEFAULT: 'hsl(var(--color-accent) / <alpha-value>)',
          strong: 'hsl(var(--color-accent-strong) / <alpha-value>)',
          soft: 'hsl(var(--color-accent-soft) / <alpha-value>)',
        },
        primary: {
          50:  '#eef5f1',
          100: '#dcebe4',
          200: '#bdd7c9',
          300: '#94bca5',
          400: '#6ca084',
          500: '#4f886d',
          600: '#376f56',
          700: '#2d5946',
          800: '#26483a',
          900: '#213c31',
        },
        success: { DEFAULT: '#22c55e', light: '#dcfce7', dark: '#16a34a' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#d97706' },
        danger:  { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#dc2626' },
      },
      fontFamily: {
        sans: ['Outfit Variable', 'Outfit', 'Avenir Next', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
      boxShadow: {
        card: '0 18px 45px -30px rgba(31, 57, 46, 0.28)',
        'card-active': '0 22px 50px -28px rgba(31, 74, 55, 0.38)',
        modal: '0 -24px 70px -26px rgba(15, 28, 23, 0.34)',
        nav: '0 16px 45px -18px rgba(22, 43, 34, 0.34)',
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        lg: '18px',
        xl: '24px',
      },
    },
  },
  plugins: [],
}
