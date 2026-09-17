/**
 * scripts/keywordsSearchService.cjs
 * 俄罗斯市场 300,001 搜索词全量检索微服务模块
 * 支持多维过滤（关键词模糊匹配、品类下钻、意图聚类、蓝海/暴涨榜单）
 * 内存单例缓存，零损耗毫秒级响应，杜绝浏览器主线程卡顿
 */
const fs = require('fs');
const path = require('path');

let cachedKeywords = null;
let isIndexing = false;

function parseCsvLine(line) {
  const res = [];
  let curr = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      res.push(curr);
      curr = '';
    } else {
      curr += ch;
    }
  }
  res.push(curr);
  return res;
}

function resolveKeywordsCsvPath() {
  const candidates = [
    process.env.WB_KEYWORDS_CSV,
    process.env.WB_ANALYSIS_OUTPUT_DIR && path.join(process.env.WB_ANALYSIS_OUTPUT_DIR, 'searches_all_cleaned.csv'),
    path.resolve(__dirname, '../../FYZSXNB/市场分析wb/analysis_output/searches_all_cleaned.csv'),
    path.resolve(__dirname, '../市场分析/searches_all_cleaned.csv'),
    'D:/FYZSXNB/市场分析wb/analysis_output/searches_all_cleaned.csv',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadKeywordsIndex() {
  if (cachedKeywords) return cachedKeywords;
  if (isIndexing) return [];

  const csvPath = resolveKeywordsCsvPath();
  if (!csvPath) {
    console.warn('[KeywordsSearchService] 未找到 300,001 关键词清洗底表 (searches_all_cleaned.csv)');
    return [];
  }

  isIndexing = true;
  console.log(`[KeywordsSearchService] 正在预热载入 300,001 搜索词索引: ${csvPath}`);
  const startTime = Date.now();

  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split('\n');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    const p = parseCsvLine(l);
    if (p.length >= 23) {
      const query = p[0];
      const searchVol = parseInt(p[1], 10) || 0;
      const goodsCount = parseInt(p[18], 10) || 0;
      const growthNum = parseFloat(p[20]) || 0;
      const dsi = parseFloat(p[22]) || 0;
      const lowerQuery = query.toLowerCase();

      // 意图聚类规则
      let intent = '场景词';
      if (lowerQuery.includes('мм') || lowerQuery.includes('12v') || lowerQuery.includes('220v') || lowerQuery.includes('180') || lowerQuery.includes('100') || lowerQuery.includes('w')) {
        intent = '规格词';
      } else if (lowerQuery.includes('stihl') || lowerQuery.includes('bosch') || lowerQuery.includes('makita') || lowerQuery.includes('samsung') || lowerQuery.includes('xiaomi') || lowerQuery.includes('iphone')) {
        intent = '机型词';
      } else if (growthNum > 50) {
        intent = '爆发词';
      }

      rows.push({
        rank: i,
        query,
        queryLower: lowerQuery,
        category: p[5] || '',
        categoryLower: (p[5] || '').toLowerCase(),
        search_vol: searchVol,
        goods_count: goodsCount,
        cart_rate: p[10] ? `${p[10]}%` : '0%',
        order_cvr: p[14] ? `${p[14]}%` : '0%',
        click_cvr: p[21] ? `${Math.round(parseFloat(p[21]) || 0)}%` : '0%',
        growth: p[20] ? `${Math.round(growthNum * 10) / 10}%` : '0%',
        growthNum,
        dsi: Math.round(dsi * 10) / 10,
        intent,
        isBlueOcean: dsi >= 1.5,
        isHighGrowth: growthNum > 20,
      });
    }
  }

  cachedKeywords = rows;
  isIndexing = false;
  console.log(`[KeywordsSearchService] 300,001 关键词索引完成，耗时 ${Date.now() - startTime}ms，有效总数: ${rows.length}`);
  return cachedKeywords;
}

function searchKeywords({
  q = '',
  category = 'ALL',
  intent = 'ALL',
  type = 'ALL',
  sortBy = 'search_vol',
  sortDir = 'desc',
  page = 1,
  pageSize = 50,
} = {}) {
  const all = loadKeywordsIndex();
  if (!all.length) {
    return { total: 0, filteredCount: 0, page: 1, pageSize: 50, totalPages: 0, items: [] };
  }

  const queryStr = (q || '').trim().toLowerCase();
  const catFilter = category !== 'ALL' ? (category || '').trim().toLowerCase() : null;
  const intentFilter = intent !== 'ALL' ? intent : null;

  // 1. 全量过滤
  const filtered = all.filter((item) => {
    if (queryStr && !item.queryLower.includes(queryStr) && !item.categoryLower.includes(queryStr)) {
      return false;
    }
    if (catFilter && item.categoryLower !== catFilter) {
      return false;
    }
    if (intentFilter && item.intent !== intentFilter) {
      return false;
    }
    if (type === 'BLUE_OCEAN' && !item.isBlueOcean) {
      return false;
    }
    if (type === 'HIGH_GROWTH' && !item.isHighGrowth) {
      return false;
    }
    return true;
  });

  // 2. 排序
  if (sortBy) {
    filtered.sort((a, b) => {
      let va = a[sortBy];
      let vb = b[sortBy];
      if (sortBy === 'growth') {
        va = a.growthNum;
        vb = b.growthNum;
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? (va - vb) : (vb - va);
    });
  }

  // 3. 分页切片
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 50));
  const totalPages = Math.ceil(filtered.length / size) || 1;
  const start = (p - 1) * size;
  const items = filtered.slice(start, start + size);

  return {
    total: all.length,
    filteredCount: filtered.length,
    page: p,
    pageSize: size,
    totalPages,
    items,
  };
}

module.exports = {
  loadKeywordsIndex,
  searchKeywords,
  resolveKeywordsCsvPath,
};
