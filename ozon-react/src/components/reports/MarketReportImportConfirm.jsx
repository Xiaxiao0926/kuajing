export default function MarketReportImportConfirm({
  draft,
  publishing,
  onDateInputChange,
  onDateUnknownChange,
  onConfirm,
  onCancel,
}) {
  if (!draft) return null

  const {
    file,
    fileType,
    byteLength,
    rowCount,
    sourceSha256,
    expectedSourceBackupName,
    prefilledFilenameDate,
    dateInput,
    dateUnknown,
    validationError,
  } = draft

  const trimmedDate = String(dateInput || '').trim()
  const isUsingFilenameDate = Boolean(!dateUnknown && prefilledFilenameDate && trimmedDate === prefilledFilenameDate)

  return (
    <div
      className="mt-4 rounded-md border border-blue-200 bg-blue-50/70 p-4 text-sm text-morandi-text"
      role="region"
      aria-label="导入报告确认"
      data-testid="market-import-confirm-panel"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">导入前确认 · 留存与采集日核验</p>
          <h2 className="mt-0.5 text-base font-semibold text-morandi-text">
            确认源文件备份与数据采集日期
          </h2>
        </div>
        <span className="inline-flex shrink-0 items-center rounded border border-blue-200 bg-white px-2 py-0.5 text-xs font-medium text-blue-800">
          尚未上传至服务器
        </span>
      </div>

      <dl className="mt-3 grid gap-2 rounded border border-blue-100 bg-white p-3 text-xs sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-gray-400">原始文件</dt>
          <dd className="mt-0.5 truncate font-medium text-morandi-text" title={file.name} data-testid="confirm-original-filename">
            {file.name}（{fileType} · {byteLength.toLocaleString('zh-CN')} B）
          </dd>
        </div>
        <div>
          <dt className="text-gray-400">解析记录数</dt>
          <dd className="mt-0.5 font-medium text-morandi-text" data-testid="confirm-record-count">
            {rowCount.toLocaleString('zh-CN')} 条记录
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-gray-400">内容寻址源备份名</dt>
          <dd className="mt-0.5 truncate font-mono text-[11px] text-slate-700" title={expectedSourceBackupName} data-testid="confirm-source-backup-name">
            {expectedSourceBackupName}（SHA-256: {sourceSha256.slice(0, 12)}…）
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] sm:items-start">
        <div>
          <label htmlFor="market-import-collection-date" className="block text-xs font-semibold text-morandi-text">
            数据采集日期（YYYY-MM-DD）
          </label>
          <input
            id="market-import-collection-date"
            data-testid="import-collection-date-input"
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD，例如 2026-09-08"
            value={dateInput}
            disabled={dateUnknown || publishing}
            onChange={(event) => onDateInputChange(event.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm tabular-nums text-morandi-text focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>

        <div className="pt-0 sm:pt-5">
          <label className="inline-flex cursor-pointer items-start gap-2 text-xs leading-5 text-morandi-text">
            <input
              id="market-import-date-unknown"
              data-testid="import-date-unknown-checkbox"
              type="checkbox"
              checked={dateUnknown}
              disabled={publishing}
              onChange={(event) => onDateUnknownChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <strong className="font-semibold">采集日期未知</strong>
              （不默认填充今日日期；180 天新品与成熟品分组将明确标记为“未评估”，不计为 0 新品）
            </span>
          </label>
          <p className="mt-1 text-xs text-morandi-text-light" data-testid="import-date-origin-hint">
            {dateUnknown
              ? '当前选择：采集日期未知（来源记为 unknown，不评估 180 天上架窗口）。'
              : isUsingFilenameDate
                ? `已从文件名预填有效日历日期 ${prefilledFilenameDate}（确认后来源记为 filename）。`
                : trimmedDate
                  ? `当前填写：${trimmedDate}（确认后来源记为 user，须为真实 YYYY-MM-DD 日历日期）。`
                  : '文件名未提供有效 YYYY-MM-DD 日期；请填写实际采集日期，或勾选“采集日期未知”。'}
          </p>
        </div>
      </div>

      {validationError ? (
        <p
          className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          role="alert"
          data-testid="import-confirm-error"
        >
          {validationError}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="import-confirm-submit"
          onClick={onConfirm}
          disabled={publishing}
          className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          确认导入并发布
        </button>
        <button
          type="button"
          data-testid="import-confirm-cancel"
          onClick={onCancel}
          disabled={publishing}
          className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-morandi-text hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          取消（不上传）
        </button>
      </div>
    </div>
  )
}
