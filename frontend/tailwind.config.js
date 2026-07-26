import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#243491',
          hover: '#1b276e',
          light: '#f0f3ff',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}
