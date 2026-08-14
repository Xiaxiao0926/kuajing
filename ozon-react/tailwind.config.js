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
        // T5-3：Morandi 变量名保留但数值 remap 到 Enterprise Neutral + Blue Accent（视觉切换不改组件）
        morandi: {
          bg: '#F7F8FA',
          card: '#FFFFFF',
          primary: '#315EFB',
          secondary: '#667085',
          accent: '#D7DBE2',
          text: '#17202A',
          'text-light': '#667085',
          success: '#138A5B',
          warning: '#B7791F',
        },
        workspace: {
          bg: '#F7F8FA',
          surface: '#FFFFFF',
          'surface-subtle': '#FAFBFC',
          border: '#E5E7EB',
          'border-strong': '#D7DBE2',
          text: '#17202A',
          'text-secondary': '#667085',
          'text-tertiary': '#98A2B3',
          primary: '#315EFB',
          'primary-soft': '#EEF3FF',
          success: '#138A5B',
          'success-soft': '#ECFDF3',
          warning: '#B7791F',
          'warning-soft': '#FFF8E7',
          danger: '#D92D20',
          'danger-soft': '#FEF3F2',
          info: '#2563EB',
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
