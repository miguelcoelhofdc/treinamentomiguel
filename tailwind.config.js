/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#edf7f5',
          100: '#d0edea',
          200: '#a6dbd5',
          300: '#72c4ba',
          400: '#45a89d',
          500: '#2E7D6E',
          600: '#256459',
          700: '#1d4f47',
          800: '#163c37',
          900: '#0f2a27',
        },
        success: { DEFAULT: '#22c55e', light: '#dcfce7', dark: '#16a34a' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#d97706' },
        danger:  { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#dc2626' },
        muted:   { DEFAULT: '#94a3b8', bg: '#f1f5f9' },
        surface: { DEFAULT: '#ffffff', raised: '#f8fafc' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
      boxShadow: {
        card:          '0 1px 3px rgba(0,0,0,0.08)',
        'card-active': '0 4px 12px rgba(0,0,0,0.12)',
        modal:         '0 20px 60px rgba(0,0,0,0.20)',
        nav:           '0 -1px 0 rgba(0,0,0,0.06)',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
    },
  },
  plugins: [],
}
