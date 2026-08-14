# 技术架构文档 - Ozon Hair Dryer Market Analytics

## 1. 技术栈

- **框架**: React 18 + Vite
- **样式**: Tailwind CSS 3.4
- **图表**: Recharts + Plotly.js
- **数据处理**: Papa Parse (CSV) + XLSX
- **PDF 生成**: jsPDF
- **词云**: react-wordcloud
- **状态管理**: React hooks (useState, useEffect)

---

## 2. 项目结构

```
ozon-react/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.jsx
│   │   │   └── MainContent.jsx
│   │   ├── Dashboard/
│   │   │   ├── KPICards.jsx
│   │   │   ├── BrandChart.jsx
│   │   │   ├── PriceChart.jsx
│   │   │   ├── GrowthChart.jsx
│   │   │   ├── WordCloud.jsx
│   │   │   ├── BubbleChart.jsx
│   │   │   ├── FeatureChart.jsx
│   │   │   ├── FBOChart.jsx
│   │   │   └── SEOAnalysis.jsx
│   │   ├── DataTable/
│   │   │   └── SearchableTable.jsx
│   │   └── Common/
│   │       ├── FileUploader.jsx
│   │       └── DownloadButton.jsx
│   ├── utils/
│   │   ├── dataProcessor.js
│   │   ├── chartConfigs.js
│   │   ├── seoAnalyzer.js
│   │   └── pdfGenerator.js
│   ├── styles/
│   │   └── index.css
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── postcss.config.js
```

---

## 3. 数据流

```
用户上传文件
    ↓
FileUploader (解析 .xlsx/.xls/.html)
    ↓
dataProcessor (清洗数据)
    ↓
App.jsx (全局状态: data, kpis)
    ↓
各组件渲染图表
```

---

## 4. 组件交互

| 组件 | 接收数据 | 输出 |
|------|----------|------|
| FileUploader | File | data (JSON) |
| KPICards | kpis | - |
| BrandChart | brandData | - |
| PriceChart | priceData | - |
| GrowthChart | growthData | - |
| SEOAnalysis | data | seoReport (CSV) |
| SearchableTable | data | filteredData |

---

## 5. 配色方案

```css
/* Tailwind 颜色配置 */
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
}
```

---

## 6. API 接口 (如有后端)

```
POST /api/upload
  - 接收: multipart/form-data
  - 返回: { data: [...], columns: [...] }

GET /api/kpis
  - 返回: { totalMarketSize, avgPrice, topBrand, avgGrowth }

GET /api/brand-distribution
  - 返回: [{ brand, count, share }]

GET /api/price-distribution
  - 返回: [{ range, count, percentage }]

GET /api/seo-analysis
  - 返回: [{ title, score, suggestions }]
```

---

## 7. 性能优化

- 图表使用 `React.memo` 缓存
- 大数据表虚拟滚动 (react-window)
- 图片/静态资源 CDN 加速
- 代码分割 (lazy loading)
