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
          50:  '#f4f5f7',
          100: '#e7e9ed',
          200: '#d2d5db',
          300: '#b3b8c1',
          400: '#8b919d',
          500: '#6b7280',
          600: '#525862',
          700: '#41454e',
          800: '#2c2f36',
          900: '#1f2126',
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
        card: '0 18px 45px -30px rgba(17, 20, 24, 0.26)',
        'card-active': '0 22px 50px -28px rgba(17, 20, 24, 0.36)',
        modal: '0 -24px 70px -26px rgba(12, 14, 17, 0.32)',
        nav: '0 16px 45px -18px rgba(15, 18, 22, 0.32)',
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
