/** @type {import('tailwindcss').Config} */
export default {
  // T5-1：工具类统一 scope 到 React root（压过 WP 主题样式）；preflight 关闭后由 index.css 提供同作用域 reset
  important: '.fyzsxnb-kuajing-root',
  corePlugins: {
    preflight: false,
  },
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
        },
        workspace: {
          bg: '#F6F7F9',
          surface: '#FFFFFF',
          border: '#E5E7EB',
          text: '#18202B',
          'text-secondary': '#667085',
          primary: '#315EFB',
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
        },
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
