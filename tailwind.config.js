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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}
