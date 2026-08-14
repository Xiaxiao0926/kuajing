/**
 * workspace/WorkspacePageErrorBoundary.jsx — 页面级错误边界（P0：永不白屏）
 * 只包页面内容：懒加载失败 / 渲染异常 / 初始化异常都会进入可见错误态，
 * 而不是让整个 Workspace 白屏。生产输出 error.message，开发额外输出 stack。
 */
import { Component } from 'react'

export default class WorkspacePageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // 不吞错误：Console 保留完整堆栈
    console.error('[workspace-page-error]', error, info?.componentStack || '')
  }

  render() {
    const { pageLabel, children } = this.props
    const { error } = this.state
    if (error) {
      const message = error?.message || String(error)
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8">
          <h3 className="text-lg font-semibold text-rose-700">{pageLabel || '页面'}加载失败</h3>
          <p className="mt-2 break-all font-mono text-sm text-rose-600">{message}</p>
          {import.meta.env.DEV && error?.stack && (
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-white p-3 text-xs text-rose-500">{error.stack}</pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            重新加载页面
          </button>
        </div>
      )
    }
    return children
  }
}
