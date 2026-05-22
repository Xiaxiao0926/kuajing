/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        morandi: {
          bg: '#F6F6F6',
          card: '#FFFFFF',
          primary: '#8B9DC3',
          secondary: '#B8A9C9',
          accent: '#D4B8A0',
          text: '#4A4A4A',
          'text-light': '#7A7A7A',
          success: '#A8C5A8',
          warning: '#E3C9A8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 30px rgba(0,0,0,0.1)',
      }
    },
  },
  plugins: [],
}
