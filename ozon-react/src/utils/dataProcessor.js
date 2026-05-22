import * as XLSX from 'xlsx';

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          reject(new Error('文件数据为空'));
          return;
        }
        
        const headers = jsonData[0].map(h => String(h).trim());
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''));
        
        const parsedData = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj;
        });
        
        resolve({ data: parsedData, columns: headers });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export function cleanData(data) {
  if (!data || !Array.isArray(data)) return [];
  
  return data.map(row => {
    const cleaned = { ...row };
    
    Object.keys(cleaned).forEach(key => {
      const lowerKey = key.toLowerCase();
      
      if (lowerKey.includes('价格') || lowerKey.includes('price') || lowerKey.includes('销售额') || lowerKey.includes('销量')) {
        if (typeof cleaned[key] === 'string') {
          const num = cleaned[key].replace(/[^\d.]/g, '');
          cleaned[key] = num ? parseFloat(num) : null;
        }
      }
      
      if (lowerKey.includes('环比') || lowerKey.includes('增长') || lowerKey.includes('growth')) {
        if (typeof cleaned[key] === 'string') {
          const num = cleaned[key].replace('%', '').trim();
          cleaned[key] = num ? parseFloat(num) : null;
        }
      }
      
      if (lowerKey.includes('品牌') || lowerKey.includes('brand')) {
        if (cleaned[key] === '/' || cleaned[key] === '' || !cleaned[key]) {
          cleaned[key] = 'Unbranded/Generic';
        }
      }
    });
    
    return cleaned;
  });
}

export function addPriceCategory(data) {
  const priceKeys = ['价格(₽)', '价格', 'Price', 'price', '价格(卢布)'];
  
  return data.map(row => {
    const newRow = { ...row };
    let price = null;
    
    for (const key of priceKeys) {
      if (row[key] !== undefined && row[key] !== null) {
        price = parseFloat(row[key]);
        break;
      }
    }
    
    if (price !== null && !isNaN(price)) {
      if (price < 2000) {
        newRow['价格区间'] = '性价比';
      } else if (price <= 10000) {
        newRow['价格区间'] = '中端';
      } else {
        newRow['价格区间'] = '高端';
      }
    } else {
      newRow['价格区间'] = '未知';
    }
    
    return newRow;
  });
}

export function calculateKPIs(data) {
  if (!data || data.length === 0) return null;
  
  const kpis = {
    totalProducts: data.length,
  };
  
  const priceKeys = ['价格(₽)', '价格', 'Price', 'price'];
  const salesKeys = ['月销售额(₽)', '销售额(₽)', '销售额', 'Sales'];
  const qtyKeys = ['月销量', '销量', 'Quantity'];
  const brandKeys = ['品牌', 'Brand', 'brand'];
  const growthKeys = ['月销量环比(%)', '增长率', 'Growth'];
  const ratingKeys = ['评分', 'rating', 'Rating'];
  
  let priceCol = priceKeys.find(k => data[0]?.[k] !== undefined);
  let salesCol = salesKeys.find(k => data[0]?.[k] !== undefined);
  let qtyCol = qtyKeys.find(k => data[0]?.[k] !== undefined);
  let brandCol = brandKeys.find(k => data[0]?.[k] !== undefined);
  let growthCol = growthKeys.find(k => data[0]?.[k] !== undefined);
  let ratingCol = ratingKeys.find(k => data[0]?.[k] !== undefined);
  
  let prices = []
  let qtys = []
  let totalRevenue = 0
  let totalQty = 0
  let totalSales = 0
  
  data.forEach(row => {
    const price = priceCol ? parseFloat(String(row[priceCol]).replace(/[^\d.]/g, '')) || 0 : 0
    const qty = qtyCol ? parseFloat(String(row[qtyCol]).replace(/[^\d.]/g, '')) || 0 : 0
    const sales = salesCol ? parseFloat(String(row[salesCol]).replace(/[^\d.]/g, '')) || (price * qty) : (price * qty)
    
    if (price > 0) prices.push(price)
    if (qty > 0) qtys.push(qty)
    
    totalRevenue += price * qty
    totalQty += qty
    totalSales += sales
  })
  
  if (salesCol || totalRevenue > 0) {
    kpis.totalMarketSize = totalSales || totalRevenue
  }
  
  if (prices.length > 0) {
    kpis.minPrice = Math.min(...prices)
    kpis.maxPrice = Math.max(...prices)
    kpis.medianPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
  }
  
  kpis.avgUnitPrice = totalQty > 0 ? Math.round(totalRevenue / totalQty) : (prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0)
  kpis.totalQty = totalQty
  kpis.avgQty = qtys.length > 0 ? Math.round(totalQty / qtys.length) : 0
  
  if (brandCol) {
    const brandCounts = {}
    const brandSales = {}
    data.forEach(row => {
      const brand = row[brandCol] || 'Unknown'
      const qty = qtyCol ? parseFloat(String(row[qtyCol]).replace(/[^\d.]/g, '')) || 0 : 0
      const price = priceCol ? parseFloat(String(row[priceCol]).replace(/[^\d.]/g, '')) || 0 : 0
      brandCounts[brand] = (brandCounts[brand] || 0) + 1
      brandSales[brand] = (brandSales[brand] || 0) + (price * qty)
    })
    const topBrandByQty = Object.entries(brandCounts).sort((a, b) => b[1] - a[1])[0]
    const topBrandBySales = Object.entries(brandSales).sort((a, b) => b[1] - a[1])[0]
    kpis.topBrand = topBrandByQty ? topBrandByQty[0] : 'N/A'
    kpis.topBrandBySales = topBrandBySales ? topBrandBySales[0] : 'N/A'
    kpis.totalBrands = Object.keys(brandCounts).length
  } else {
    kpis.topBrand = 'N/A'
    kpis.topBrandBySales = 'N/A'
    kpis.totalBrands = 0
  }
  
  if (growthCol) {
    const growths = data.map(r => parseFloat(String(r[growthCol]).replace(/[^\d.-]/g, ''))).filter(g => !isNaN(g))
    kpis.avgGrowth = growths.length > 0 
      ? Math.round(growths.reduce((a, b) => a + b, 0) / growths.length * 10) / 10 
      : 0
    const positiveGrowth = growths.filter(g => g > 0).length
    kpis.growthPositiveRate = growths.length > 0 ? Math.round(positiveGrowth / growths.length * 100) : 0
  }
  
  if (ratingCol) {
    const ratings = data.map(r => parseFloat(String(r[ratingCol]).replace(/[^\d.]/g, ''))).filter(r => !isNaN(r) && r > 0)
    kpis.avgRating = ratings.length > 0 ? (Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10) : 0
    const highRating = ratings.filter(r => r >= 4.5).length
    kpis.highRatingRate = ratings.length > 0 ? Math.round(highRating / ratings.length * 100) : 0
  }
  
  return kpis;
}

export function getBrandDistribution(data) {
  const brandKeys = ['品牌', 'Brand', 'brand'];
  const brandCol = brandKeys.find(k => data[0]?.[k] !== undefined);
  
  if (!brandCol) return [];
  
  const brandCounts = {};
  data.forEach(row => {
    const brand = row[brandCol] || 'Unknown';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  });
  
  const total = data.length;
  return Object.entries(brandCounts)
    .map(([brand, count]) => ({
      brand,
      count,
      share: Math.round(count / total * 100 * 100) / 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export function getPriceDistribution(data) {
  const priceKeys = ['价格(₽)', '价格', 'Price', 'price'];
  const priceCol = priceKeys.find(k => data[0]?.[k] !== undefined);
  
  if (!priceCol) return [];
  
  const ranges = [
    { label: '0-2K', min: 0, max: 2000, count: 0 },
    { label: '2K-5K', min: 2000, max: 5000, count: 0 },
    { label: '5K-10K', min: 5000, max: 10000, count: 0 },
    { label: '10K-20K', min: 10000, max: 20000, count: 0 },
    { label: '20K-50K', min: 20000, max: 50000, count: 0 },
    { label: '50K+', min: 50000, max: Infinity, count: 0 },
  ];
  
  data.forEach(row => {
    const price = parseFloat(row[priceCol]);
    if (!isNaN(price)) {
      const range = ranges.find(r => price >= r.min && price < r.max);
      if (range) range.count++;
    }
  });
  
  const total = data.length;
  return ranges
    .filter(r => r.count > 0)
    .map(r => ({
      range: r.label,
      count: r.count,
      percentage: Math.round(r.count / total * 100 * 100) / 100
    }));
}

export function getConcentration(data) {
  const brandDist = getBrandDistribution(data);
  if (brandDist.length === 0) return null;
  
  const cr3 = brandDist.slice(0, 3).reduce((sum, b) => sum + b.share, 0);
  const cr5 = brandDist.slice(0, 5).reduce((sum, b) => sum + b.share, 0);
  
  return {
    brandStats: brandDist,
    cr3: Math.round(cr3 * 100) / 100,
    cr5: Math.round(cr5 * 100) / 100
  };
}
