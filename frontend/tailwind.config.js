/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          925: '#0f1117',
          950: '#0a0d13',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}
