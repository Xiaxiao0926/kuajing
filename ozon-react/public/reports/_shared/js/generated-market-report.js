(function renderGeneratedMarketReport() {
  const data = window.REPORT_DATA
  const echarts = window.echarts
  const chartIds = ['chart-types', 'chart-bands', 'chart-brands', 'chart-sellers']

  if (!data || !echarts) {
    chartIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) element.innerHTML = '<div class="empty-chart">图表资源未加载，请刷新页面。</div>'
    })
    return
  }

  const palette = ['#174a67', '#16877d', '#b9792b', '#b84943', '#6c7183', '#648f73', '#8f6e5b', '#51778a', '#9b7c32', '#775f83']
  const compactRub = (value) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
    return String(Math.round(value))
  }
  const tooltipRub = (value) => `${Math.round(value).toLocaleString('zh-CN')} ₽`
  const baseText = { color: '#4f5f6b', fontFamily: 'InstrumentSans, Microsoft YaHei, sans-serif' }
  const instances = []

  function create(id, option) {
    const element = document.getElementById(id)
    if (!element) return
    const instance = echarts.init(element)
    instance.setOption(option)
    instances.push(instance)
  }

  const typeItems = data.topTypes.slice().reverse()
  create('chart-types', {
    color: [palette[0]],
    grid: { left: 18, right: 58, top: 16, bottom: 28, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (items) => `${items[0].name}<br>销售额：${tooltipRub(items[0].value)}<br>样本份额：${typeItems[items[0].dataIndex].share}%` },
    xAxis: { type: 'value', axisLabel: { ...baseText, formatter: compactRub }, splitLine: { lineStyle: { color: '#e7ebee' } } },
    yAxis: { type: 'category', data: typeItems.map((item) => item.name), axisLabel: { ...baseText, width: 150, overflow: 'truncate' }, axisTick: { show: false }, axisLine: { show: false } },
    series: [{ type: 'bar', data: typeItems.map((item) => item.revenue), barMaxWidth: 22, label: { show: true, position: 'right', color: '#4f5f6b', formatter: ({ value }) => compactRub(value) } }],
  })

  create('chart-bands', {
    color: [palette[1], palette[2]],
    grid: { left: 18, right: 16, top: 42, bottom: 58, containLabel: true },
    legend: { top: 2, textStyle: baseText },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: data.priceBands.map((item) => item.label), axisLabel: { ...baseText, rotate: 28 }, axisTick: { alignWithLabel: true } },
    yAxis: [
      { type: 'value', name: '销售额', axisLabel: { ...baseText, formatter: compactRub }, splitLine: { lineStyle: { color: '#e7ebee' } } },
      { type: 'value', name: '记录数', axisLabel: baseText, splitLine: { show: false } },
    ],
    series: [
      { name: '销售额(₽)', type: 'bar', data: data.priceBands.map((item) => item.revenue), barMaxWidth: 28 },
      { name: '记录数', type: 'line', yAxisIndex: 1, data: data.priceBands.map((item) => item.rows), symbolSize: 7 },
    ],
  })

  create('chart-brands', {
    color: palette,
    tooltip: { trigger: 'item', formatter: ({ name, value, percent }) => `${name}<br>${tooltipRub(value)}<br>图中占比 ${percent}%` },
    legend: { type: 'scroll', orient: 'horizontal', bottom: 0, textStyle: baseText },
    series: [{ type: 'pie', radius: ['36%', '65%'], center: ['50%', '43%'], avoidLabelOverlap: true, itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { color: '#4f5f6b', formatter: '{b}\n{d}%' }, data: data.topBrands.map((item) => ({ name: item.name, value: item.revenue })) }],
  })

  const sellerItems = data.topSellers.slice().reverse()
  create('chart-sellers', {
    color: [palette[3]],
    grid: { left: 18, right: 58, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (items) => `${items[0].name}<br>销售额：${tooltipRub(items[0].value)}` },
    xAxis: { type: 'value', axisLabel: { ...baseText, formatter: compactRub }, splitLine: { lineStyle: { color: '#e7ebee' } } },
    yAxis: { type: 'category', data: sellerItems.map((item) => item.name), axisLabel: { ...baseText, width: 180, overflow: 'truncate' }, axisTick: { show: false }, axisLine: { show: false } },
    series: [{ type: 'bar', data: sellerItems.map((item) => item.revenue), barMaxWidth: 22, label: { show: true, position: 'right', color: '#4f5f6b', formatter: ({ value }) => compactRub(value) } }],
  })

  let resizeTimer
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => instances.forEach((instance) => instance.resize()), 120)
  })
})()
