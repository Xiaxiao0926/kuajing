import { useMemo } from 'react'
import { R, findColumn, parseNum, getPriceBand, buildPriceBands, getSeasonalDataByCategory, extractFeaturesFromNames, buildDictionary } from './dictionary'

/**
 * 市场分析统计计算 hook（从 NewDashboard 逐字抽取，逻辑零改动）
 */
export function useDashboardStats(data) {
  return useMemo(() => {
    if (!data || data.length === 0) return null

    const salesCol = findColumn(data, ['销售额'])
    const qtyCol = findColumn(data, ['销量'])
    const priceCol = findColumn(data, ['平均单价', '价格'])
    const brandCol = findColumn(data, ['品牌'])
    const ratingCol = findColumn(data, ['评分'])
    const shippingCol = findColumn(data, ['发货模式', 'FBO', 'FBS', 'тип_доставки', 'доставка', 'fulfillment', 'Тип доставки', 'FBO FBS'])
    const dateCol = findColumn(data, ['商品卡创建日期', '创建日期'])
    const adCostCol = findColumn(data, ['广告费用'])
    const exposureCol = findColumn(data, ['曝光量'])
    const clickCol = findColumn(data, ['点击率', '浏览次数'])
    const convertCol = findColumn(data, ['转化指数', '订单转化率'])
    const grossCol = findColumn(data, ['预估毛利率'])
    const cartCol = findColumn(data, ['购物车率'])
    const nameCol = findColumn(data, ['商品名称', '产品名称'])
    const potentialCol = findColumn(data, ['潜力指数'])
    const adRatioCol = findColumn(data, ['广告占比'])
    const promoPriceCol = findColumn(data, ['促销前的价格', '促销前价格'])
    const discountCol = findColumn(data, ['促销活动折扣', '折扣'])
    const promoDaysCol = findColumn(data, ['促销活动天数占比', '活动天数占比'])
    const promoDaysCountCol = findColumn(data, ['促销活动天数', '活动天数'])
    const adDaysCol = findColumn(data, ['推广天数占比', '广告天数占比'])
    const adDaysCountCol = findColumn(data, ['推广天数', '广告天数'])
    const categoryCol = findColumn(data, ['类目', '品类', '分类', 'category', 'категория', 'категор'])

    const getProductZhTags = (name, dict) => {
      if (!name) return []
      const lower = name.toLowerCase()
      const tags = []
      Object.entries(dict).forEach(([word, info]) => {
        if (lower.includes(word) && info.zh) tags.push(info.zh)
      })
      const unique = [...new Set(tags)]
      return unique.slice(0, 3)
    }

    const products = data.map(item => {
      const name = item[nameCol] || String(Object.values(item)[1] || '')
      return {
        sales: parseNum(item[salesCol]),
        qty: parseNum(item[qtyCol]),
        price: parseNum(item[priceCol]),
        gross: item[grossCol] != null && item[grossCol] !== '' ? parseNum(item[grossCol]) : null,
        exposure: parseNum(item[exposureCol]),
        clicks: parseNum(item[clickCol]),
        adCost: parseNum(item[adCostCol]),
        cartRate: parseNum(item[cartCol]),
        convert: parseNum(item[convertCol]),
        potential: parseNum(item[potentialCol]),
        adRatio: parseNum(item[adRatioCol]),
        promoPrice: parseNum(item[promoPriceCol]),
        discount: parseNum(item[discountCol]),
        promoDaysRatio: parseNum(item[promoDaysCol]),
        promoDaysCount: parseNum(item[promoDaysCountCol]),
        adDaysRatio: parseNum(item[adDaysCol]),
        adDaysCount: parseNum(item[adDaysCountCol]),
        name,
        brand: item[brandCol] || '未知',
        shipping: (() => {
          const rawShipping = String(item[shippingCol] || '').trim()
          const isValidMode = /^(fbo|fbs|fbofbs|rfbs|ozon|fborfbs)$/i.test(rawShipping)
          if (isValidMode) {
            const lower = rawShipping.toLowerCase()
            if (lower === 'fbofbs') return 'FBO+FBS'
            if (lower === 'rfbs') return 'rFBS'
            if (lower === 'fborfbs') return 'FBO+rFBS'
            return rawShipping.toUpperCase()
          }
          const rawName = name || ''
          const combined = (rawShipping + ' ' + rawName).toLowerCase()
          if (combined.includes('fbo') && combined.includes('fbs')) return 'FBO+FBS'
          if (combined.includes('rfbs')) return 'rFBS'
          if (combined.includes('fbs')) return 'FBS'
          if (combined.includes('fbo')) return 'FBO'
          if (combined.includes('ozon')) return 'OZON'
          return '未知'
        })(),
        rating: parseNum(item[ratingCol]),
        date: item[dateCol] || '',
        category: item[categoryCol] || '未分类'
      }
    })

    const dictionary = buildDictionary(products)
    const marketAvgPrice = products.filter(p => p.price > 0).length > 0
      ? products.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / products.filter(p => p.price > 0).length
      : 0
    const extractedFeatures = extractFeaturesFromNames(products, dictionary, marketAvgPrice)
    products.forEach(p => { p.zhTags = getProductZhTags(p.name, dictionary) })

    const totalSales = products.reduce((s, p) => s + p.sales, 0)
    const totalQty = products.reduce((s, p) => s + p.qty, 0)
    const totalExposure = products.reduce((s, p) => s + p.exposure, 0)
    const totalClicks = products.reduce((s, p) => s + p.clicks, 0)
    const totalAdCost = products.reduce((s, p) => s + p.adCost, 0)
    const grossProducts = products.filter(p => p.gross != null && p.gross > 0)
    const avgGross = grossProducts.length > 0 ? grossProducts.reduce((s, p) => s + p.gross, 0) / grossProducts.length : null
    const avgCartRate = products.reduce((s, p) => s + p.cartRate, 0) / products.length
    const avgPrice = products.filter(p => p.price > 0 && p.qty > 0).length > 0
      ? products.filter(p => p.price > 0 && p.qty > 0).reduce((s, p) => s + p.price * p.qty, 0) / products.filter(p => p.price > 0 && p.qty > 0).reduce((s, p) => s + p.qty, 0)
      : products.filter(p => p.price > 0).length > 0
        ? products.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / products.filter(p => p.price > 0).length
        : 0

    const categoryStats = {}
    products.forEach(p => {
      if (!categoryStats[p.category]) categoryStats[p.category] = { count: 0, qty: 0, sales: 0 }
      categoryStats[p.category].count += 1
      categoryStats[p.category].qty += p.qty
      categoryStats[p.category].sales += p.sales
    })
    const topCategory = Object.entries(categoryStats).sort((a, b) => b[1].sales - a[1].sales)[0]

    const brandStats = {}
    products.forEach(p => {
      if (!brandStats[p.brand]) brandStats[p.brand] = { sales: 0, qty: 0, count: 0, adCost: 0 }
      brandStats[p.brand].sales += p.sales
      brandStats[p.brand].qty += p.qty
      brandStats[p.brand].count += 1
      brandStats[p.brand].adCost += p.adCost
    })
    const topBrands = Object.entries(brandStats)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 10)
      .map(([name, d]) => ({ name, ...d, share: (d.sales / totalSales * 100).toFixed(1) }))

    const shippingStats = {}
    products.forEach(p => {
      const mode = p.shipping || '未知'
      if (!shippingStats[mode]) shippingStats[mode] = { count: 0, sales: 0, qty: 0 }
      shippingStats[mode].count += 1
      shippingStats[mode].sales += p.sales
      shippingStats[mode].qty += p.qty
    })
    const shippingData = Object.entries(shippingStats).map(([name, d]) => ({
      name: name.includes('FBO') && name.includes('FBS') ? 'FBO+FBS' : name.includes('FBO') ? 'FBO仓配' : name.includes('FBS') ? 'FBS自发' : name,
      count: d.count, sales: d.sales, qty: d.qty
    })).filter(d => d.count > 0)

    const fbsFboCompare = [
      { name: 'FBO仓配', qty: 0, sales: 0, count: 0, avgPrice: 0 },
      { name: 'FBS自发', qty: 0, sales: 0, count: 0, avgPrice: 0 },
      { name: 'FBO+FBS', qty: 0, sales: 0, count: 0, avgPrice: 0 },
    ]
    products.forEach(p => {
      const mode = String(p.shipping || '')
      if (mode.includes('FBO') && mode.includes('FBS')) {
        fbsFboCompare[2].qty += p.qty; fbsFboCompare[2].sales += p.sales; fbsFboCompare[2].count += 1
      } else if (mode.includes('FBO')) {
        fbsFboCompare[0].qty += p.qty; fbsFboCompare[0].sales += p.sales; fbsFboCompare[0].count += 1
      } else if (mode.includes('FBS')) {
        fbsFboCompare[1].qty += p.qty; fbsFboCompare[1].sales += p.sales; fbsFboCompare[1].count += 1
      }
    })
    fbsFboCompare.forEach(f => { f.avgPrice = f.qty > 0 ? f.sales / f.qty : 0 })
    const fbsFboChartData = fbsFboCompare.filter(f => f.count > 0)

    const priceBands = buildPriceBands(products)
    const priceRange = {}
    products.forEach(p => {
      const range = getPriceBand(p.price, priceBands)
      if (!priceRange[range]) priceRange[range] = { count: 0, sales: 0, qty: 0, adCost: 0 }
      priceRange[range].count += 1
      priceRange[range].sales += p.sales
      priceRange[range].qty += p.qty
      priceRange[range].adCost += p.adCost
    })
    const priceData = Object.entries(priceRange).map(([name, d]) => ({
      name, count: d.count, sales: d.sales, qty: d.qty, adCost: d.adCost,
      avgAdCost: d.count > 0 ? d.adCost / d.count : 0,
      avgAdRatio: d.sales > 0 ? (d.adCost / d.sales * 100) : 0,
      avgPrice: d.qty > 0 ? d.sales / d.qty : 0
    }))

    const featureData = extractedFeatures

    const priceBandFeatures = {}
    products.forEach(p => {
      const band = getPriceBand(p.price, priceBands)
      if (!priceBandFeatures[band]) priceBandFeatures[band] = {}
      const lower = p.name.toLowerCase()
      Object.entries(dictionary).forEach(([word, info]) => {
        if (lower.includes(word)) {
          if (!priceBandFeatures[band][info.zh]) priceBandFeatures[band][info.zh] = { count: 0, sales: 0, qty: 0, ru: info.ru, en: info.en }
          priceBandFeatures[band][info.zh].count++
          priceBandFeatures[band][info.zh].sales += p.sales
          priceBandFeatures[band][info.zh].qty += p.qty
        }
      })
    })
    const priceBandFeatureData = Object.entries(priceBandFeatures).map(([band, features]) => {
      const bandProducts = products.filter(p => getPriceBand(p.price, priceBands) === band)
      const topFeatures = Object.entries(features)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, d]) => ({ name, ru: d.ru, en: d.en, count: d.count, sales: d.sales, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, penetration: (d.count / bandProducts.length * 100).toFixed(1) }))
      return { band, productCount: bandProducts.length, totalSales: bandProducts.reduce((s, p) => s + p.sales, 0), avgPrice: bandProducts.filter(p => p.qty > 0).reduce((s, p) => s + p.price * p.qty, 0) / bandProducts.filter(p => p.qty > 0).reduce((s, p) => s + p.qty, 0) || 0, features: topFeatures }
    })

    const topProducts = [...products].sort((a, b) => b.qty - a.qty).slice(0, 15)
    const fbsTopProducts = products.filter(p => p.shipping && String(p.shipping).includes('FBS')).sort((a, b) => b.qty - a.qty).slice(0, 15)
    const highPotential = [...products].sort((a, b) => (b.potential || b.qty) - (a.potential || a.qty)).slice(0, 10).map(p => {
      let reason = ''
      if (p.potential > 80) reason = '潜力指数极高'
      else if (p.potential > 60) reason = '潜力指数优秀'
      else if (p.potential > 40) reason = '潜力指数良好'
      else if (p.qty > totalQty / products.length * 2) reason = '销量远超平均'
      else if (p.qty > totalQty / products.length) reason = '销量高于平均'
      else reason = '综合表现良好'
      return { ...p, selectReason: reason }
    })
    
    const vacuumZone = products.filter(p => p.price > avgPrice && p.qty > totalQty / products.length).slice(0, 10).map(p => {
      const priceLevel = p.price > avgPrice * 1.5 ? '超高价格' : p.price > avgPrice * 1.2 ? '高价格' : '高于平均'
      const salesLevel = p.qty > totalQty / products.length * 3 ? '热销' : p.qty > totalQty / products.length * 2 ? '畅销' : '良好销量'
      return { ...p, selectReason: `${priceLevel} + ${salesLevel}` }
    })

    const now = new Date()
    const days180 = 180 * 24 * 60 * 60 * 1000
    const newProducts180 = products.filter(p => {
      if (!p.date) return false
      const d = new Date(p.date)
      if (isNaN(d.getTime())) return false
      return (now - d) <= days180
    }).sort((a, b) => b.qty - a.qty).slice(0, 15)
    const newProductsStats = newProducts180.length > 0 ? {
      count: newProducts180.length,
      totalQty: newProducts180.reduce((s, p) => s + p.qty, 0),
      totalSales: newProducts180.reduce((s, p) => s + p.sales, 0),
      avgPrice: newProducts180.reduce((s, p) => s + p.price, 0) / newProducts180.length,
      topBrands: [...new Set(newProducts180.map(p => p.brand))].slice(0, 5),
      priceBandDist: (() => {
        const bands = {}
        newProducts180.forEach(p => {
          const band = getPriceBand(p.price, priceBands)
          bands[band] = (bands[band] || 0) + 1
        })
        return Object.entries(bands).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
      })(),
    } : null
    // 有广告投入的产品ROI计算
    const adEfficiency = products.filter(p => p.adRatio > 0 && p.sales >= 10000).map(p => {
      const adCostCalc = p.sales * (p.adRatio / 100)
      const adRoi = adCostCalc > 0 ? ((p.sales - adCostCalc) / adCostCalc) : 0
      const salesMultiple = adCostCalc > 0 ? (p.sales / adCostCalc) : 0
      return { ...p, adCostCalc, roi: adRoi, salesMultiple }
    }).sort((a, b) => b.roi - a.roi).slice(0, 10)
    
    // 无广告投入但高销量的产品
    const noAdHighSales = products.filter(p => p.adRatio === 0 && p.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 10)
    
    // 运营策略分析（促销、活动、推广数据）
    const operationStrategy = (() => {
      const withPromo = products.filter(p => p.discount > 0 || p.promoDaysRatio > 0)
      const withAd = products.filter(p => p.adDaysRatio > 0 || p.adRatio > 0)
      const highPromo = products.filter(p => p.discount >= 20)
      const longPromo = products.filter(p => p.promoDaysRatio >= 30)
      const highAd = products.filter(p => p.adDaysRatio >= 50)
      
      // 促销效果分析
      const promoEffect = withPromo.length > 0 ? {
        avgDiscount: withPromo.reduce((s, p) => s + p.discount, 0) / withPromo.length,
        avgPromoDays: withPromo.reduce((s, p) => s + p.promoDaysRatio, 0) / withPromo.length,
        avgSales: withPromo.reduce((s, p) => s + p.qty, 0) / withPromo.length,
        avgPriceDrop: withPromo.filter(p => p.promoPrice > 0).reduce((s, p) => s + (p.promoPrice - p.price) / p.promoPrice * 100, 0) / withPromo.filter(p => p.promoPrice > 0).length || 0
      } : null
      
      // 推广效果分析
      const adEffect = withAd.length > 0 ? {
        avgAdDays: withAd.reduce((s, p) => s + p.adDaysRatio, 0) / withAd.length,
        avgSales: withAd.reduce((s, p) => s + p.qty, 0) / withAd.length,
        avgAdCost: withAd.reduce((s, p) => s + p.adCost, 0) / withAd.length
      } : null
      
      // 最佳实践产品
      const bestPractice = products
        .filter(p => p.qty > totalQty / products.length)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)
        .map(p => ({
          name: p.name.slice(0, 20),
          qty: p.qty,
          discount: p.discount,
          promoDays: p.promoDaysRatio,
          adDays: p.adDaysRatio,
          strategy: p.discount > 20 ? '高折扣促销' : p.promoDaysRatio > 30 ? '长期促销' : p.adDaysRatio > 50 ? '持续推广' : p.adRatio > 0 ? '精准投放' : '自然流量'
        }))
      
      return {
        promoStats: { count: withPromo.length, highDiscount: highPromo.length, longDuration: longPromo.length },
        adStats: { count: withAd.length, highDuration: highAd.length },
        promoEffect,
        adEffect,
        bestPractice,
        insight: withPromo.length > products.length * 0.5 ? '市场促销竞争激烈，建议差异化促销策略' : withAd.length > products.length * 0.5 ? '广告投放普遍，需优化投放效率' : '市场以自然流量为主，有广告红利机会'
      }
    })()
    
    const priceElasticity = products.filter(p => p.price > 0 && p.qty > 0).map(p => ({ price: p.price, qty: p.qty, name: p.name.slice(0, 20), brand: p.brand, sales: p.sales }))

    const priceScatterAnalysis = (() => {
      const sortedByPrice = [...products].sort((a, b) => a.price - b.price)
      const lowPrice = sortedByPrice.slice(0, Math.ceil(products.length * 0.3))
      const midPrice = sortedByPrice.slice(Math.ceil(products.length * 0.3), Math.ceil(products.length * 0.7))
      const highPrice = sortedByPrice.slice(Math.ceil(products.length * 0.7))
      
      const lowPriceAvg = lowPrice.reduce((s, p) => s + p.qty, 0) / lowPrice.length
      const midPriceAvg = midPrice.reduce((s, p) => s + p.qty, 0) / midPrice.length
      const highPriceAvg = highPrice.reduce((s, p) => s + p.qty, 0) / highPrice.length
      
      const highSalesLowComp = products.filter(p => {
        const similarPrice = products.filter(op => Math.abs(op.price - p.price) / p.price < 0.2)
        return p.qty > totalQty / products.length && similarPrice.length < 5
      }).slice(0, 5)
      
      const priceCorrelation = (() => {
        const n = products.length
        const sumX = products.reduce((s, p) => s + p.price, 0)
        const sumY = products.reduce((s, p) => s + p.qty, 0)
        const sumXY = products.reduce((s, p) => s + p.price * p.qty, 0)
        const sumX2 = products.reduce((s, p) => s + p.price * p.price, 0)
        const sumY2 = products.reduce((s, p) => s + p.qty * p.qty, 0)
        const correlation = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
        return isNaN(correlation) ? 0 : correlation
      })()
      
      return {
        lowPrice: { count: lowPrice.length, avgQty: lowPriceAvg, avgPrice: lowPrice.reduce((s, p) => s + p.price, 0) / lowPrice.length },
        midPrice: { count: midPrice.length, avgQty: midPriceAvg, avgPrice: midPrice.reduce((s, p) => s + p.price, 0) / midPrice.length },
        highPrice: { count: highPrice.length, avgQty: highPriceAvg, avgPrice: highPrice.reduce((s, p) => s + p.price, 0) / highPrice.length },
        highSalesLowComp,
        priceCorrelation,
        insight: priceCorrelation < -0.3 ? '价格敏感型市场，低价产品销量优势明显' : priceCorrelation > 0.3 ? '品质导向市场，高价产品也能获得高销量' : '价格与销量关联度不高，差异化竞争空间大'
      }
    })()

    const underservedPrices = []
    ;[500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7000, 10000].forEach(step => {
      const inRange = products.filter(p => p.price >= step - 300 && p.price < step + 300)
      const avgSales = inRange.reduce((s, p) => s + p.qty, 0) / (inRange.length || 1)
      if (inRange.length < 5 && avgSales > 20) underservedPrices.push({ price: step, count: inRange.length, avgSales })
    })

    const hhi = Object.values(brandStats).reduce((s, b) => { const share = (b.sales / totalSales) * 100; return s + share * share }, 0)
    const marketPower = hhi > 2500 ? '高度集中' : hhi > 1500 ? '中度集中' : '竞争型'
    const brandPower = topBrands.map((b, i) => ({ ...b, powerLevel: i === 0 ? '绝对龙头' : i < 3 ? '强势品牌' : i < 6 ? '主流品牌' : '中小品牌', barrierLevel: i < 3 ? '高壁垒' : i < 6 ? '中壁垒' : '低壁垒' }))
    const marketConcentration = topBrands.slice(0, 3).reduce((s, b) => s + parseFloat(b.share), 0)
    const topCatName = topCategory ? topCategory[0] : '未分类'
    const priceLevel = avgPrice * R > 300 ? 'high' : avgPrice * R > 150 ? 'mid' : 'low'
    const topKeywords = extractedFeatures.slice(0, 5).map(f => f.zh)
    const { monthlyData: seasonalData, seasonalAdvice } = getSeasonalDataByCategory(topCatName, Math.round(avgPrice * R), priceLevel, topKeywords)

    const isPillowCategory = /枕|подушк|pillow/i.test(topCatName)
    const sizeMaterialData = (() => {
      if (!isPillowCategory) return null
      const sizeRegex = /(\d{2,3})\s*[хx×]\s*(\d{2,3})(?:\s*[хx×]\s*(\d{2,3}))?/i
      const sizeCmRegex = /(\d{2,3})\s*[хx×]\s*(\d{2,3})\s*см/i
      const SIZE_GROUPS = [
        { label: '60×40', aliases: [[38,58],[39,59],[40,60],[41,61],[42,62],[58,38],[59,39],[60,40],[61,41],[62,42]] },
        { label: '70×50', aliases: [[48,68],[49,69],[50,70],[51,71],[52,72],[68,48],[69,49],[70,50],[71,51],[72,52]] },
        { label: '80×50', aliases: [[48,78],[50,80],[52,82],[78,48],[80,50],[82,52]] },
        { label: '60×60', aliases: [[58,58],[60,60],[62,62]] },
        { label: '70×70', aliases: [[68,68],[70,70],[72,72]] },
        { label: '41×34', aliases: [[32,39],[33,40],[34,41],[35,42],[39,32],[40,33],[41,34],[42,35]] },
        { label: '50×30', aliases: [[28,48],[30,50],[32,52],[48,28],[50,30],[52,32]] },
        { label: '40×40', aliases: [[38,38],[40,40],[42,42]] },
        { label: '80×60', aliases: [[58,78],[60,80],[62,82],[78,58],[80,60],[82,62]] },
        { label: '50×50', aliases: [[48,48],[50,50],[52,52]] },
      ]
      const normalizeSize = (w, h, d) => {
        if (d) {
          const sorted2 = [parseInt(w), parseInt(h)].sort((a, b) => b - a)
          return `${sorted2[0]}×${sorted2[1]}×${parseInt(d)}`
        }
        const a = parseInt(w), b = parseInt(h)
        const sorted = [a, b].sort((x, y) => y - x)
        for (const group of SIZE_GROUPS) {
          for (const alias of group.aliases) {
            const aliasSorted = [...alias].sort((x, y) => y - x)
            if (Math.abs(sorted[0] - aliasSorted[0]) <= 2 && Math.abs(sorted[1] - aliasSorted[1]) <= 2) {
              return group.label
            }
          }
        }
        return `${sorted[0]}×${sorted[1]}`
      }
      const materialKeywords = [
        { keys: ['памятью', 'памят', 'memory'], zh: '记忆棉', en: 'Memory Foam' },
        { keys: ['латекс', 'latex'], zh: '乳胶', en: 'Latex' },
        { keys: ['пух', 'пухом', 'down'], zh: '羽绒', en: 'Down' },
        { keys: ['лебяжь', 'лебяжий'], zh: '鹅绒', en: 'Swan Down' },
        { keys: ['силиконизированн', 'силикон'], zh: '硅化纤维', en: 'Siliconized Fiber' },
        { keys: ['холлофайбер', 'холлофайб'], zh: '中空纤维', en: 'Hollofayber' },
        { keys: ['микрофибр', 'microfiber'], zh: '超细纤维', en: 'Microfiber' },
        { keys: ['овечь', 'овечья', 'шерст'], zh: '羊毛', en: 'Wool' },
        { keys: ['гречнев', 'buckwheat'], zh: '荞麦壳', en: 'Buckwheat' },
        { keys: ['полиуретан', 'пенополиуретан', 'foam'], zh: '聚氨酯海绵', en: 'PU Foam' },
        { keys: ['гелев', 'гелем', 'gel'], zh: '凝胶', en: 'Gel' },
        { keys: ['бамбук', 'bamboo'], zh: '竹纤维', en: 'Bamboo' },
        { keys: ['искусственн', 'искусственног'], zh: '人造纤维', en: 'Artificial Fiber' },
        { keys: ['эвкалипт', 'eucalyptus'], zh: '桉树纤维', en: 'Eucalyptus' },
        { keys: ['кокосов'], zh: '椰棕', en: 'Coconut Coir' },
        { keys: ['хлопк', 'хлопков', 'cotton'], zh: '纯棉', en: 'Cotton' },
        { keys: ['натуральн', 'natural'], zh: '天然材质', en: 'Natural' },
      ]
      const sizeStats = {}
      const materialStats = {}
      const sizeMaterialMatrix = {}
      let noSizeCount = 0
      let noMaterialCount = 0
      products.forEach(p => {
        const name = (p.name || '').toLowerCase()
        let sizeMatch = name.match(sizeCmRegex) || name.match(sizeRegex)
        let sizeLabel = ''
        if (sizeMatch) {
          const w = sizeMatch[1], h = sizeMatch[2], d = sizeMatch[3]
          sizeLabel = normalizeSize(w, h, d)
        }
        if (!sizeLabel) { noSizeCount++; sizeLabel = '未知尺寸' }
        let materialLabel = ''
        for (const mk of materialKeywords) {
          if (mk.keys.some(k => name.includes(k))) { materialLabel = mk.zh; break }
        }
        if (!materialLabel) { noMaterialCount++; materialLabel = '未知材质' }
        if (!sizeStats[sizeLabel]) sizeStats[sizeLabel] = { count: 0, qty: 0, sales: 0 }
        sizeStats[sizeLabel].count++
        sizeStats[sizeLabel].qty += p.qty
        sizeStats[sizeLabel].sales += p.sales
        if (!materialStats[materialLabel]) materialStats[materialLabel] = { count: 0, qty: 0, sales: 0 }
        materialStats[materialLabel].count++
        materialStats[materialLabel].qty += p.qty
        materialStats[materialLabel].sales += p.sales
        const matrixKey = `${sizeLabel}|${materialLabel}`
        if (!sizeMaterialMatrix[matrixKey]) sizeMaterialMatrix[matrixKey] = { count: 0, qty: 0, sales: 0 }
        sizeMaterialMatrix[matrixKey].count++
        sizeMaterialMatrix[matrixKey].qty += p.qty
        sizeMaterialMatrix[matrixKey].sales += p.sales
      })
      const sizeData = Object.entries(sizeStats)
        .filter(([name]) => name !== '未知尺寸')
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, share: (d.count / products.length * 100).toFixed(1) }))
      const materialData = Object.entries(materialStats)
        .filter(([name]) => name !== '未知材质')
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, share: (d.count / products.length * 100).toFixed(1) }))
      const crossData = Object.entries(sizeMaterialMatrix)
        .filter(([key]) => !key.includes('未知尺寸') && !key.includes('未知材质'))
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([key, d]) => {
          const [size, material] = key.split('|')
          return { size, material, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0 }
        })
      const topSize = sizeData[0]?.name || ''
      const topMaterial = materialData[0]?.name || ''
      const sizeCoverage = ((products.length - noSizeCount) / products.length * 100).toFixed(1)
      const materialCoverage = ((products.length - noMaterialCount) / products.length * 100).toFixed(1)
      return { sizeData, materialData, crossData, topSize, topMaterial, sizeCoverage, materialCoverage, noSizeCount, noMaterialCount }
    })()

    const isHairCareCategory = /护发|发膜|喷雾|маска|спрей|hair|волос|美容.*卫生/i.test(topCatName)
    const ingredientData = (() => {
      if (!isHairCareCategory) return null
      const ingredientKeywords = [
        { keys: ['кератин', 'кератином', 'keratin'], zh: '角蛋白', category: '蛋白质' },
        { keys: ['коллаген', 'коллагеном', 'collagen'], zh: '胶原蛋白', category: '蛋白质' },
        { keys: ['протеин', 'протеинов', 'protein'], zh: '蛋白质', category: '蛋白质' },
        { keys: ['аминокислот', 'amino acid'], zh: '氨基酸', category: '蛋白质' },
        { keys: ['шелк', 'silk'], zh: '丝蛋白', category: '蛋白质' },
        { keys: ['ботокс', 'botox'], zh: '头发水光针', category: '护理技术' },
        { keys: ['ламинирован', 'ламинировани', 'lamination'], zh: '角蛋白护理', category: '护理技术' },
        { keys: ['восстанавливающ', 'восстановлен', 'restoring', 'repair'], zh: '修复', category: '功效' },
        { keys: ['увлажняющ', 'увлажнен', 'moisturiz', 'hydrat'], zh: '保湿', category: '功效' },
        { keys: ['питательн', 'nourish'], zh: '滋养', category: '功效' },
        { keys: ['укрепляющ', 'укреплен', 'strengthen'], zh: '强韧', category: '功效' },
        { keys: ['объем', 'volume'], zh: '丰盈', category: '功效' },
        { keys: ['блеск', 'блеском', 'shine', 'gloss'], zh: '光泽', category: '功效' },
        { keys: ['сияни', 'radiance'], zh: '闪耀', category: '功效' },
        { keys: ['шелковист', 'silky'], zh: '丝滑', category: '功效' },
        { keys: ['гладк', 'smooth'], zh: '顺滑', category: '功效' },
        { keys: ['эластичн', 'elastic'], zh: '弹性', category: '功效' },
        { keys: ['послушн', 'manageable'], zh: '柔顺', category: '功效' },
        { keys: ['термозащит', 'heat protect'], zh: '防热损伤', category: '防护' },
        { keys: ['защит', 'protect'], zh: '防护', category: '防护' },
        { keys: ['экстракт', 'extract'], zh: '植物提取', category: '植物成分' },
        { keys: ['имбир', 'ginger'], zh: '生姜', category: '植物成分' },
        { keys: ['алоэ', 'aloe'], zh: '芦荟', category: '植物成分' },
        { keys: ['банан', 'banana'], zh: '香蕉', category: '植物成分' },
        { keys: ['ромашк', 'chamomile'], zh: '洋甘菊', category: '植物成分' },
        { keys: ['крапив', 'nettle'], zh: '荨麻', category: '植物成分' },
        { keys: ['лаванд', 'lavender'], zh: '薰衣草', category: '植物成分' },
        { keys: ['водоросл', 'seaweed', 'algae'], zh: '海藻', category: '植物成分' },
        { keys: ['мандарин', 'mandarin'], zh: '柑橘', category: '植物成分' },
        { keys: ['хмель', 'hops'], zh: '啤酒花', category: '植物成分' },
        { keys: ['полын', 'wormwood'], zh: '艾草', category: '植物成分' },
        { keys: ['масло', 'oil'], zh: '精油', category: '油脂' },
        { keys: ['арганов', 'argan'], zh: '摩洛哥坚果油', category: '油脂' },
        { keys: ['кокосов', 'coconut'], zh: '椰子油', category: '油脂' },
        { keys: ['касторов', 'castor'], zh: '蓖麻油', category: '油脂' },
        { keys: ['миндальн', 'almond'], zh: '杏仁油', category: '油脂' },
        { keys: ['жожоб', 'jojoba'], zh: '荷荷巴油', category: '油脂' },
        { keys: ['макадам', 'macadamia'], zh: '夏威夷果油', category: '油脂' },
        { keys: ['ши', 'shea'], zh: '乳木果油', category: '油脂' },
        { keys: ['репейн', 'burdock'], zh: '牛蒡油', category: '油脂' },
        { keys: ['липидн', 'lipid'], zh: '脂质', category: '脂质' },
        { keys: ['витамин', 'vitamin'], zh: '维生素', category: '维生素' },
        { keys: ['пантенол', 'panthenol'], zh: '泛醇(B5)', category: '维生素' },
        { keys: ['биотин', 'biotin'], zh: '生物素(B7)', category: '维生素' },
        { keys: ['гиалурон', 'hyaluron'], zh: '玻尿酸', category: '保湿剂' },
        { keys: ['гликерин', 'glycerin'], zh: '甘油', category: '保湿剂' },
        { keys: ['морск', 'salt', 'sea'], zh: '海盐', category: '矿物质' },
        { keys: ['соль', 'salt'], zh: '盐', category: '矿物质' },
        { keys: ['серебр', 'silver'], zh: '银离子', category: '矿物质' },
        { keys: ['цинк', 'zinc'], zh: '锌', category: '矿物质' },
        { keys: ['медь', 'copper'], zh: '铜', category: '矿物质' },
        { keys: ['фиолетов', 'purple', 'violet'], zh: '紫色修色', category: '调色' },
        { keys: ['серебрист', 'silver'], zh: '银色修色', category: '调色' },
        { keys: ['поврежден', 'damaged'], zh: '受损发质', category: '适用发质' },
        { keys: ['сух', 'dry'], zh: '干性发质', category: '适用发质' },
        { keys: ['окрашен', 'colored', 'dyed'], zh: '染后发质', category: '适用发质' },
        { keys: ['выпаден', 'hair loss', 'fall'], zh: '脱发', category: '适用发质' },
        { keys: ['кудряв', 'curly'], zh: '卷发', category: '适用发质' },
        { keys: ['порист', 'porous'], zh: '多孔发质', category: '适用发质' },
        { keys: ['обесцвечиван', 'bleach'], zh: '漂后发质', category: '适用发质' },
        { keys: ['осветлен', 'lighten'], zh: '浅色发质', category: '适用发质' },
        { keys: ['секущ', 'split'], zh: '分叉发质', category: '适用发质' },
        { keys: ['ломк', 'brittle'], zh: '易断发质', category: '适用发质' },
        { keys: ['пушащ', 'frizzy'], zh: '毛躁发质', category: '适用发质' },
      ]
      const ingredientStats = {}
      const categoryStats = {}
      const ingredientCoOccurrence = {}
      let productsWithIngredient = 0
      products.forEach(p => {
        const name = (p.name || '').toLowerCase()
        const matchedIngredients = []
        ingredientKeywords.forEach(ik => {
          if (ik.keys.some(k => name.includes(k))) {
            matchedIngredients.push(ik.zh)
            if (!ingredientStats[ik.zh]) ingredientStats[ik.zh] = { zh: ik.zh, category: ik.category, count: 0, sales: 0, qty: 0 }
            ingredientStats[ik.zh].count++
            ingredientStats[ik.zh].sales += p.sales
            ingredientStats[ik.zh].qty += p.qty
            if (!categoryStats[ik.category]) categoryStats[ik.category] = { count: 0, sales: 0, qty: 0 }
            categoryStats[ik.category].count++
            categoryStats[ik.category].sales += p.sales
            categoryStats[ik.category].qty += p.qty
          }
        })
        if (matchedIngredients.length > 0) productsWithIngredient++
        for (let i = 0; i < matchedIngredients.length; i++) {
          for (let j = i + 1; j < matchedIngredients.length; j++) {
            const pair = [matchedIngredients[i], matchedIngredients[j]].sort().join('+')
            if (!ingredientCoOccurrence[pair]) ingredientCoOccurrence[pair] = { count: 0, sales: 0 }
            ingredientCoOccurrence[pair].count++
            ingredientCoOccurrence[pair].sales += p.sales
          }
        }
      })
      const allIngredients = Object.values(ingredientStats)
        .sort((a, b) => b.sales - a.sales)
        .map(d => ({ ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, share: (d.count / products.length * 100).toFixed(1) }))
      const categoryData = Object.entries(categoryStats)
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0 }))
      const topPairs = Object.entries(ingredientCoOccurrence)
        .sort((a, b) => b[1].sales - a[1].sales)
        .slice(0, 10)
        .map(([pair, d]) => ({ pair, count: d.count, sales: d.sales }))
      const coverage = (productsWithIngredient / products.length * 100).toFixed(1)
      const topIngredient = allIngredients[0]?.zh || ''
      const topCategory = categoryData[0]?.name || ''
      const proteinIngredients = allIngredients.filter(d => d.category === '蛋白质')
      const plantIngredients = allIngredients.filter(d => d.category === '植物成分')
      const oilIngredients = allIngredients.filter(d => d.category === '油脂')
      const effectIngredients = allIngredients.filter(d => d.category === '功效')
      const hairTypeIngredients = allIngredients.filter(d => d.category === '适用发质')
      return { allIngredients, categoryData, topPairs, coverage, topIngredient, topCategory, proteinIngredients, plantIngredients, oilIngredients, effectIngredients, hairTypeIngredients }
    })()

    const isHairMaskCategory = isHairCareCategory && /маска|发膜|mask/i.test(topCatName)
    let hairMaskAnalysis = null
    if (isHairMaskCategory) {
      const maskProducts = products.filter(p => {
        const name = (p.name || '').toLowerCase()
        return name.includes('маска') || name.includes('маской') || name.includes('маску') || name.includes('mask')
      })
      if (maskProducts.length >= 3) {
        const getWeight = (name) => {
          const n = (name || '').toLowerCase()
          const m = n.match(/(\d+)\s*(мл|ml|г|g)/)
          if (m) return { value: parseInt(m[1]), unit: m[2].startsWith('м') || m[2] === 'ml' ? 'ml' : 'g' }
          return null
        }
        const getEffect = (name) => {
          const n = (name || '').toLowerCase()
          const effects = []
          if (n.includes('восстанавлива') || n.includes('реставрац') || n.includes('repair')) effects.push('修复')
          if (n.includes('увлажня') || n.includes('hydrat') || n.includes('moistur')) effects.push('保湿')
          if (n.includes('питательн') || n.includes('nourish')) effects.push('滋养')
          if (n.includes('укрепля') || n.includes('strengthen')) effects.push('强韧')
          if (n.includes('блеск') || n.includes('shine') || n.includes('gloss')) effects.push('光泽')
          if (n.includes('объем') || n.includes('volume')) effects.push('丰盈')
          if (n.includes('защит') || n.includes('protect')) effects.push('防护')
          if (n.includes('разглажива') || n.includes('smooth') || n.includes('anti-frizz')) effects.push('顺滑')
          if (n.includes('кератин') || n.includes('keratin')) effects.push('角蛋白')
          if (n.includes('коллаген') || n.includes('collagen')) effects.push('胶原蛋白')
          if (n.includes('масло') || n.includes('oil')) effects.push('精油')
          if (n.includes('керамид') || n.includes('ceramide')) effects.push('神经酰胺')
          if (n.includes('икра') || n.includes('caviar')) effects.push('鱼子酱')
          if (n.includes('шелк') || n.includes('silk')) effects.push('丝蛋白')
          if (n.includes('ботокс') || n.includes('botox')) effects.push('玻尿酸/肉毒')
          if (n.includes('ламинац') || n.includes('lamination')) effects.push('拉直/烫')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) effects.push('染后护理')
          if (n.includes('поврежден') || n.includes('damaged')) effects.push('受损修护')
          return effects.length > 0 ? effects : null
        }
        const getHairType = (name) => {
          const n = (name || '').toLowerCase()
          const types = []
          if (n.includes('сух') || n.includes('dry')) types.push('干性')
          if (n.includes('жирн') || n.includes('oily')) types.push('油性')
          if (n.includes('поврежден') || n.includes('damaged')) types.push('受损')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) types.push('染烫')
          if (n.includes('тонк') || n.includes('fine')) types.push('细软')
          if (n.includes('кудряв') || n.includes('curly')) types.push('卷发')
          if (n.includes('пушащ') || n.includes('frizz')) types.push('毛躁')
          return types.length > 0 ? types : null
        }

        const weightStats = {}
        const effectStats = {}
        const hairTypeStats = {}
        const priceByWeight = {}
        let totalMaskSales = 0
        let totalMaskQty = 0

        maskProducts.forEach(p => {
          const name = (p.name || '').toLowerCase()
          const weight = getWeight(name)
          const effects = getEffect(name)
          const hairTypes = getHairType(name)
          totalMaskSales += p.sales || 0
          totalMaskQty += p.qty || 0

          if (weight) {
            const wKey = `${weight.value}${weight.unit}`
            if (!weightStats[wKey]) weightStats[wKey] = { count: 0, sales: 0, qty: 0, prices: [] }
            weightStats[wKey].count++
            weightStats[wKey].sales += p.sales || 0
            weightStats[wKey].qty += p.qty || 0
            weightStats[wKey].prices.push(p.price || 0)
          }
          if (effects) {
            effects.forEach(e => {
              if (!effectStats[e]) effectStats[e] = { count: 0, sales: 0, qty: 0 }
              effectStats[e].count++
              effectStats[e].sales += p.sales || 0
              effectStats[e].qty += p.qty || 0
            })
          }
          if (hairTypes) {
            hairTypes.forEach(t => {
              if (!hairTypeStats[t]) hairTypeStats[t] = { count: 0, sales: 0, qty: 0 }
              hairTypeStats[t].count++
              hairTypeStats[t].sales += p.sales || 0
              hairTypeStats[t].qty += p.qty || 0
            })
          }
          if (weight && p.price > 0) {
            const bucket = weight.value <= 200 ? '≤200ml/g' : weight.value <= 500 ? '201-500ml/g' : weight.value <= 1000 ? '501-1000ml/g' : '1000ml/g+'
            if (!priceByWeight[bucket]) priceByWeight[bucket] = { prices: [], qty: 0, sales: 0 }
            priceByWeight[bucket].prices.push(p.price)
            priceByWeight[bucket].qty += p.qty || 0
            priceByWeight[bucket].sales += p.sales || 0
          }
        })

        const sortedWeights = Object.entries(weightStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({
            name: key,
            count: d.count,
            sales: d.sales,
            qty: d.qty,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
          }))

        const sortedEffects = Object.entries(effectStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const sortedHairTypes = Object.entries(hairTypeStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const priceByWeightData = Object.entries(priceByWeight)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, d]) => ({
            name: key,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
            qty: d.qty,
            sales: d.sales,
          }))

        const top10Mask = [...maskProducts].sort((a, b) => b.qty - a.qty).slice(0, 10).map(p => {
          const weight = getWeight(p.name || '')
          const effects = getEffect(p.name || '')
          const hairTypes = getHairType(p.name || '')
          return {
            ...p,
            _weight: weight ? `${weight.value}${weight.unit}` : null,
            _effects: effects ? effects.join('、') : null,
            _hairTypes: hairTypes ? hairTypes.join('、') : null,
            _pricePer100ml: weight && p.price > 0 ? (p.price / weight.value * 100).toFixed(1) : null,
          }
        })

        const mask300g = maskProducts.filter(p => {
          const w = getWeight(p.name || '')
          return w && (w.value >= 250 && w.value <= 350)
        })
        const mask300gAvgPrice = mask300g.length > 0 ? mask300g.reduce((s, p) => s + (p.price || 0), 0) / mask300g.length : 0
        const mask300gAvgQty = mask300g.length > 0 ? mask300g.reduce((s, p) => s + (p.qty || 0), 0) / mask300g.length : 0
        const caviarProducts = maskProducts.filter(p => {
          const n = (p.name || '').toLowerCase()
          return n.includes('икра') || n.includes('caviar')
        })
        const caviarAvgPrice = caviarProducts.length > 0 ? caviarProducts.reduce((s, p) => s + (p.price || 0), 0) / caviarProducts.length : 0
        const caviarAvgQty = caviarProducts.length > 0 ? caviarProducts.reduce((s, p) => s + (p.qty || 0), 0) / caviarProducts.length : 0

        const COMPETITOR_MASK = { weight: '350g', priceRUB: 350, brand: '竞品(ikra 350ml)' }
        const OUR_MASK = {
          weight: '300g',
          priceCNY: 9,
          logistics: 15,
          ourPriceRUB: 459,
          features: ['深层滋养受损发丝', '抚平毛躁改善打结', '冲洗后柔顺易梳理', '提升光泽度与丝滑感', '适用于干枯/染烫/毛躁发质', '沙龙级护理体验', '鱼子精华修护配方'],
          positioning: '沙龙级鱼子酱修护发膜',
          targetHairTypes: ['干性', '受损', '染烫', '毛躁'],
          targetEffects: ['滋养', '修复', '顺滑', '光泽'],
        }

        const ourMaskPriceRUB = OUR_MASK.ourPriceRUB
        const maskCalcProfit = (priceRub) => {
          const revenue = priceRub * R
          const ozonFee = priceRub * 0.12 * R
          const adFee = priceRub * 0.10 * R
          const exchangeLoss = priceRub * 0.01 * R
          const afterSalesCost = priceRub * 0.03 * R
          const logistics = OUR_MASK.logistics
          const totalCost = OUR_MASK.priceCNY + ozonFee + adFee + exchangeLoss + afterSalesCost + logistics
          const profit = revenue - totalCost
          const rate = revenue > 0 ? (profit / revenue * 100) : 0
          return { profit, rate, ozonFee: Math.round(priceRub * 0.12), adFee: Math.round(priceRub * 0.10), exchangeLoss: Math.round(priceRub * 0.01), afterSales: Math.round(priceRub * 0.03), logistics, totalCost }
        }

        const profitAtOurPrice = maskCalcProfit(OUR_MASK.ourPriceRUB)
        const profitAtCompetitor = maskCalcProfit(COMPETITOR_MASK.priceRUB)
        const profitAt300gAvg = maskCalcProfit(mask300gAvgPrice)

        const maskTopBrands = {}
        maskProducts.forEach(p => {
          const b = p.brand || '未知品牌'
          if (!maskTopBrands[b]) maskTopBrands[b] = { count: 0, sales: 0, qty: 0 }
          maskTopBrands[b].count++
          maskTopBrands[b].sales += p.sales || 0
          maskTopBrands[b].qty += p.qty || 0
        })
        const sortedMaskBrands = Object.entries(maskTopBrands)
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 10)
          .map(([name, d]) => ({ name, count: d.count, sales: d.sales, qty: d.qty, avgPrice: d.count > 0 ? Math.round(maskProducts.filter(p => (p.brand || '未知品牌') === name).reduce((s, p) => s + (p.price || 0), 0) / d.count) : 0 }))

        hairMaskAnalysis = {
          totalProducts: maskProducts.length,
          totalSales: totalMaskSales,
          totalQty: totalMaskQty,
          weightData: sortedWeights,
          effectData: sortedEffects,
          hairTypeData: sortedHairTypes,
          priceByWeightData,
          top10Products: top10Mask,
          topBrands: sortedMaskBrands,
          mask300gCount: mask300g.length,
          mask300gAvgPrice: Math.round(mask300gAvgPrice),
          mask300gAvgQty: Math.round(mask300gAvgQty),
          caviarCount: caviarProducts.length,
          caviarAvgPrice: Math.round(caviarAvgPrice),
          caviarAvgQty: Math.round(caviarAvgQty),
          competitorMask: COMPETITOR_MASK,
          ourMask: OUR_MASK,
          ourMaskPriceRUB: Math.round(ourMaskPriceRUB),
          profitAtOurPrice,
          profitAtCompetitor,
          profitAt300gAvg,
        }
      }
    }

    const isSprayCategory = isHairCareCategory && /спрей|喷雾|spray|мист|mist|mist|эфирн|эфирное.*масло|арома/i.test(topCatName)
    let sprayAnalysis = null
    if (isSprayCategory) {
      const sprayProducts = products.filter(p => {
        const name = (p.name || '').toLowerCase()
        return name.includes('спрей') || name.includes('spray') || name.includes('мист') || name.includes('mist') || name.includes('эфирное масло') || name.includes('аромамасло') || name.includes('ароматический спрей')
      })
      if (sprayProducts.length >= 3) {
        const getVolume = (name) => {
          const n = (name || '').toLowerCase()
          const m = n.match(/(\d+)\s*(мл|ml)/)
          if (m) return { value: parseInt(m[1]), unit: 'ml' }
          return null
        }
        const getSprayEffect = (name) => {
          const n = (name || '').toLowerCase()
          const effects = []
          if (n.includes('увлажня') || n.includes('hydrat') || n.includes('moistur')) effects.push('保湿')
          if (n.includes('питательн') || n.includes('nourish')) effects.push('滋养')
          if (n.includes('блеск') || n.includes('shine') || n.includes('gloss')) effects.push('光泽')
          if (n.includes('разглажива') || n.includes('smooth') || n.includes('anti-frizz')) effects.push('顺滑')
          if (n.includes('защит') || n.includes('protect')) effects.push('防护')
          if (n.includes('термозащит') || n.includes('heat protect')) effects.push('防热损伤')
          if (n.includes('восстанавлива') || n.includes('repair')) effects.push('修复')
          if (n.includes('укрепля') || n.includes('strengthen')) effects.push('强韧')
          if (n.includes('объем') || n.includes('volume')) effects.push('丰盈')
          if (n.includes('антистатик') || n.includes('antistat')) effects.push('抗静电')
          if (n.includes('легк') || n.includes('расчесыван') || n.includes('easy comb')) effects.push('易梳理')
          if (n.includes('аромат') || n.includes('парфюм') || n.includes('арома')) effects.push('香氛')
          if (n.includes('масло') || n.includes('oil') || n.includes('эфирн')) effects.push('精油')
          if (n.includes('кератин') || n.includes('keratin')) effects.push('角蛋白')
          if (n.includes('коллаген') || n.includes('collagen')) effects.push('胶原蛋白')
          if (n.includes('экстракт') || n.includes('extract')) effects.push('植物提取')
          if (n.includes('икра') || n.includes('caviar')) effects.push('鱼子酱')
          if (n.includes('арганов') || n.includes('арган') || n.includes('argan')) effects.push('摩洛哥坚果油')
          if (n.includes('кокос') || n.includes('coconut')) effects.push('椰子油')
          if (n.includes('макадам') || n.includes('macadamia')) effects.push('澳洲坚果油')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) effects.push('染后护理')
          if (n.includes('поврежден') || n.includes('damaged')) effects.push('受损修护')
          if (n.includes('сияни') || n.includes('radiance') || n.includes('люкс')) effects.push('闪耀/奢华')
          return effects.length > 0 ? effects : null
        }
        const getSprayHairType = (name) => {
          const n = (name || '').toLowerCase()
          const types = []
          if (n.includes('сух') || n.includes('dry')) types.push('干性')
          if (n.includes('жирн') || n.includes('oily')) types.push('油性')
          if (n.includes('поврежден') || n.includes('damaged')) types.push('受损')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) types.push('染烫')
          if (n.includes('тонк') || n.includes('fine')) types.push('细软')
          if (n.includes('кудряв') || n.includes('curly')) types.push('卷发')
          if (n.includes('пушащ') || n.includes('frizz') || n.includes('пух')) types.push('毛躁')
          if (n.includes('тускл') || n.includes('dull')) types.push('暗哑')
          return types.length > 0 ? types : null
        }

        const volumeStats = {}
        const sprayEffectStats = {}
        const sprayHairTypeStats = {}
        const priceByVolume = {}
        let totalSpraySales = 0
        let totalSprayQty = 0

        sprayProducts.forEach(p => {
          const name = (p.name || '').toLowerCase()
          const volume = getVolume(name)
          const effects = getSprayEffect(name)
          const hairTypes = getSprayHairType(name)
          totalSpraySales += p.sales || 0
          totalSprayQty += p.qty || 0

          if (volume) {
            const vKey = `${volume.value}${volume.unit}`
            if (!volumeStats[vKey]) volumeStats[vKey] = { count: 0, sales: 0, qty: 0, prices: [] }
            volumeStats[vKey].count++
            volumeStats[vKey].sales += p.sales || 0
            volumeStats[vKey].qty += p.qty || 0
            volumeStats[vKey].prices.push(p.price || 0)
          }
          if (effects) {
            effects.forEach(e => {
              if (!sprayEffectStats[e]) sprayEffectStats[e] = { count: 0, sales: 0, qty: 0 }
              sprayEffectStats[e].count++
              sprayEffectStats[e].sales += p.sales || 0
              sprayEffectStats[e].qty += p.qty || 0
            })
          }
          if (hairTypes) {
            hairTypes.forEach(t => {
              if (!sprayHairTypeStats[t]) sprayHairTypeStats[t] = { count: 0, sales: 0, qty: 0 }
              sprayHairTypeStats[t].count++
              sprayHairTypeStats[t].sales += p.sales || 0
              sprayHairTypeStats[t].qty += p.qty || 0
            })
          }
          if (volume && p.price > 0) {
            const bucket = volume.value <= 50 ? '≤50ml' : volume.value <= 100 ? '51-100ml' : volume.value <= 150 ? '101-150ml' : volume.value <= 200 ? '151-200ml' : '200ml+'
            if (!priceByVolume[bucket]) priceByVolume[bucket] = { prices: [], qty: 0, sales: 0 }
            priceByVolume[bucket].prices.push(p.price)
            priceByVolume[bucket].qty += p.qty || 0
            priceByVolume[bucket].sales += p.sales || 0
          }
        })

        const sortedVolumes = Object.entries(volumeStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({
            name: key,
            count: d.count,
            sales: d.sales,
            qty: d.qty,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
          }))

        const sortedSprayEffects = Object.entries(sprayEffectStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const sortedSprayHairTypes = Object.entries(sprayHairTypeStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const priceByVolumeData = Object.entries(priceByVolume)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, d]) => ({
            name: key,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
            qty: d.qty,
            sales: d.sales,
          }))

        const top10Spray = [...sprayProducts].sort((a, b) => b.qty - a.qty).slice(0, 10).map(p => {
          const volume = getVolume(p.name || '')
          const effects = getSprayEffect(p.name || '')
          const hairTypes = getSprayHairType(p.name || '')
          return {
            ...p,
            _volume: volume ? `${volume.value}${volume.unit}` : null,
            _effects: effects ? effects.join('、') : null,
            _hairTypes: hairTypes ? hairTypes.join('、') : null,
            _pricePer100ml: volume && p.price > 0 ? (p.price / volume.value * 100).toFixed(1) : null,
          }
        })

        const spray100ml = sprayProducts.filter(p => {
          const v = getVolume(p.name || '')
          return v && (v.value >= 80 && v.value <= 120)
        })
        const spray100mlAvgPrice = spray100ml.length > 0 ? spray100ml.reduce((s, p) => s + (p.price || 0), 0) / spray100ml.length : 0
        const spray100mlAvgQty = spray100ml.length > 0 ? spray100ml.reduce((s, p) => s + (p.qty || 0), 0) / spray100ml.length : 0
        const oilSprayProducts = sprayProducts.filter(p => {
          const n = (p.name || '').toLowerCase()
          return n.includes('масло') || n.includes('oil') || n.includes('эфирн') || n.includes('арганов') || n.includes('кокос')
        })
        const oilSprayAvgPrice = oilSprayProducts.length > 0 ? oilSprayProducts.reduce((s, p) => s + (p.price || 0), 0) / oilSprayProducts.length : 0
        const oilSprayAvgQty = oilSprayProducts.length > 0 ? oilSprayProducts.reduce((s, p) => s + (p.qty || 0), 0) / oilSprayProducts.length : 0

        const COMPETITORS_SPRAY = [
          { id: 1, volume: '50ml', priceRUB: 255, brand: '竞品1', positioning: '重滋润修护型·小容量溢价', ingredients: '环戊硅氧烷、矿物油、二甲基硅酚、阿莫二甲硅油、乳木果脂、夏威夷果油', risks: ['香精过敏原(柠檬烯/芳樟醇/香豆素)', '矿物油降低高端感', '50ml单位价偏高'], strengths: ['手感强立刻顺', '乳木果脂滋润厚重', '适合干枯粗硬漂染发'], score: { gloss: 3, smooth: 5, moisture: 5, light: 1 } },
          { id: 2, volume: '100ml', priceRUB: 393, brand: '竞品2', positioning: '中端主流爆款·走量型', ingredients: 'Dimethicone、Cyclomethicone、Cyclopentasiloxane、Argan Oil、Jojoba、Macadamia、Mineral Oil、CI47000、CI26100', risks: ['色粉CI47000/CI26100被嫌"添加剂多"', '矿物油降低高端感', '缺少功能型活性物'], strengths: ['成熟配方市场接受度高', '坚果油概念易做滋养叙事', '成本控制优秀'], score: { gloss: 3, smooth: 4, moisture: 3, light: 2 } },
          { id: 3, volume: '100ml', priceRUB: 322, brand: '竞品3', positioning: '低价走量·豪华成分表包装', ingredients: '环戊硅氧烷、Dimethiconol、Phenyl Trimethicone、IPM、甜杏仁油、夏威夷果油、葡萄籽油、角鲨烷、荷荷巴油、草莓籽油、摩洛哥坚果油、Bisabolol、牛蒡根/越橘叶/银杏叶提取物', risks: ['植物提取物含量极低(营销型)', '成分复杂稳定性风险', '提取物多合规资料麻烦'], strengths: ['Phenyl Trimethicone高反光光泽感最强', '成分表"看起来豪华"营销强', 'Bisabolol舒缓成分头皮友好'], score: { gloss: 5, smooth: 4, moisture: 2, light: 4 } },
          { id: 4, volume: '100ml', priceRUB: 524, brand: '竞品4', positioning: '高价高端·轻奢沙龙感', ingredients: '环戊硅氧烷、Dimethiconol、IPM、环己硅氧烷(D6)、夏威夷果油、牛油果油、甜杏仁油、BHT', risks: ['BHT争议成分(虽合规)', '香精过敏原多', '定价偏高需品牌支撑'], strengths: ['D5+D6体系顺滑不粘', 'IPM轻薄干爽轻奢感', '牛油果油高端油脂'], score: { gloss: 4, smooth: 5, moisture: 2, light: 5 } },
          { id: 5, volume: '100ml', priceRUB: 497, brand: '竞品5', positioning: '中配方+高售价·品牌溢价', ingredients: 'Dimethicone、Cyclomethicone、Cyclopentasiloxane、Argan Oil、Jojoba、Macadamia、Mineral Oil、CI47000、CI26100', risks: ['与竞品2高度同质化', '矿物油+色粉降低高端感', '无配方创新点'], strengths: ['顺滑+光泽效果稳定', '配方成熟复购稳定', '高端价位品牌溢价空间'], score: { gloss: 3, smooth: 4, moisture: 3, light: 2 } },
        ]
        const OUR_SPRAY = {
          volume: '100ml',
          priceCNY: 12,
          logistics: 18,
          ourPriceRUB: 499,
          ingredients: '棕榈酸乙基己酯、异十二烷、C13-14异链烷烃、山茶花提取物、霍霍巴籽油、聚二甲基硅氧烷醇、油橄榄果油、生育酚乙酸酯、(日用)香精',
          features: ['异十二烷+C13-14异链烷烃·超轻盈基底', '山茶花提取物·天然修护抗氧化', '霍霍巴籽油+橄榄油·双重植物油滋养', '聚二甲基硅氧烷醇·顺滑不粘不塌', '生育酚乙酸酯(维E)·防热损伤', '轻盈不油腻·细软发友好', '无矿物油·无色粉·更干净'],
          positioning: '轻盈不塌·无矿物油·高端修护',
          targetHairTypes: ['干性', '受损', '染烫', '毛躁', '细软'],
          targetEffects: ['顺滑', '光泽', '防热损伤', '轻盈不塌'],
          score: { gloss: 4, smooth: 4, moisture: 3, light: 5 },
          skus: [
            { volume: '50ml', priceCNY: 8, logistics: 15, ourPriceRUB: 299, label: '试用装' },
            { volume: '100ml', priceCNY: 12, logistics: 18, ourPriceRUB: 499, label: '标准装' },
            { volume: '150ml', priceCNY: 14, logistics: 20, ourPriceRUB: 599, label: '正装' },
          ],
        }

        const sprayCalcProfit = (priceRub, costCNY, logisticsCNY) => {
          const revenue = priceRub * R
          const ozonFee = priceRub * 0.12 * R
          const adFee = priceRub * 0.10 * R
          const exchangeLoss = priceRub * 0.01 * R
          const afterSalesCost = priceRub * 0.03 * R
          const totalCost = costCNY + ozonFee + adFee + exchangeLoss + afterSalesCost + logisticsCNY
          const profit = revenue - totalCost
          const rate = revenue > 0 ? (profit / revenue * 100) : 0
          return { profit, rate, ozonFee: Math.round(priceRub * 0.12), adFee: Math.round(priceRub * 0.10), exchangeLoss: Math.round(priceRub * 0.01), afterSales: Math.round(priceRub * 0.03), logistics: logisticsCNY, totalCost }
        }

        const sprayProfitBySku = OUR_SPRAY.skus.map(s => ({
          ...s,
          standard: sprayCalcProfit(s.ourPriceRUB, s.priceCNY, s.logistics),
          express: sprayCalcProfit(s.ourPriceRUB, s.priceCNY, s.logistics + 5),
          economy: sprayCalcProfit(s.ourPriceRUB, s.priceCNY, Math.max(0, s.logistics - 5)),
        }))
        const sprayTopBrands = {}
        sprayProducts.forEach(p => {
          const b = p.brand || '未知品牌'
          if (!sprayTopBrands[b]) sprayTopBrands[b] = { count: 0, sales: 0, qty: 0 }
          sprayTopBrands[b].count++
          sprayTopBrands[b].sales += p.sales || 0
          sprayTopBrands[b].qty += p.qty || 0
        })
        const sortedSprayBrands = Object.entries(sprayTopBrands)
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 10)
          .map(([name, d]) => ({ name, count: d.count, sales: d.sales, qty: d.qty, avgPrice: d.count > 0 ? Math.round(sprayProducts.filter(p => (p.brand || '未知品牌') === name).reduce((s, p) => s + (p.price || 0), 0) / d.count) : 0 }))

        const sprayHhi = Object.values(sprayTopBrands).reduce((s, b) => { const share = (b.sales / totalSpraySales) * 100; return s + share * share }, 0)
        const sprayMarketPower = sprayHhi > 2500 ? '高度集中' : sprayHhi > 1500 ? '中度集中' : '竞争型'
        const sprayMarketConcentration = sortedSprayBrands.slice(0, 3).reduce((s, b) => s + (b.qty / totalSprayQty * 100), 0)
        const sprayMarketConcentrationTop10 = sortedSprayBrands.slice(0, 10).reduce((s, b) => s + (b.qty / totalSprayQty * 100), 0)
        const sprayAvgPrice = sprayProducts.length > 0 ? Math.round(sprayProducts.reduce((s, p) => s + (p.price || 0), 0) / sprayProducts.length) : 0

        const spray150ml = sprayProducts.filter(p => {
          const v = getVolume(p.name || '')
          return v && (v.value >= 120 && v.value <= 200)
        })
        const spray150mlAvgPrice = spray150ml.length > 0 ? spray150ml.reduce((s, p) => s + (p.price || 0), 0) / spray150ml.length : 0
        const spray150mlAvgQty = spray150ml.length > 0 ? spray150ml.reduce((s, p) => s + (p.qty || 0), 0) / spray150ml.length : 0
        const spray50ml = sprayProducts.filter(p => {
          const v = getVolume(p.name || '')
          return v && v.value <= 60
        })
        const spray50mlAvgPrice = spray50ml.length > 0 ? spray50ml.reduce((s, p) => s + (p.price || 0), 0) / spray50ml.length : 0
        const spray50mlAvgQty = spray50ml.length > 0 ? spray50ml.reduce((s, p) => s + (p.qty || 0), 0) / spray50ml.length : 0

        const volumeDistribution = sortedVolumes.map(v => ({
          name: v.name,
          count: v.count,
          qty: v.qty,
          pct: totalSprayQty > 0 ? (v.qty / totalSprayQty * 100).toFixed(1) : 0,
          avgPrice: v.avgPrice,
        }))

        const top10TotalQty = top10Spray.reduce((s, p) => s + (p.qty || 0), 0)
        const top10AvgDailyQty = Math.round(top10TotalQty / 30)
        const top10AvgDailyQtyPerProduct = top10Spray.length > 0 ? Math.round(top10TotalQty / 30 / top10Spray.length) : 0

        const sprayNewProducts180 = sprayProducts.filter(p => {
          if (!p.date) return false
          const d = new Date(p.date)
          if (isNaN(d.getTime())) return false
          return (now - d) <= days180
        }).sort((a, b) => b.qty - a.qty).slice(0, 10)
        const sprayNewProductTotalQty = sprayNewProducts180.reduce((s, p) => s + (p.qty || 0), 0)
        const sprayNewProductAvgDailyQtyPerProduct = sprayNewProducts180.length > 0 ? Math.round(sprayNewProductTotalQty / 30 / sprayNewProducts180.length) : 0

        const newProductEstByNewProduct = Math.max(1, Math.round(sprayNewProductAvgDailyQtyPerProduct * 0.30))
        const newProductEstByTop10 = Math.max(1, Math.round(top10AvgDailyQtyPerProduct * 0.10))
        const newProductEstDailyQty = Math.max(1, Math.round((newProductEstByNewProduct + newProductEstByTop10) / 2))
        const fullSizeStock = 100
        const trialSizeStock = 200
        const fullSizeSellDays = Math.round(fullSizeStock / newProductEstDailyQty)
        const trialSizeSellDays = Math.round(trialSizeStock / newProductEstDailyQty)
        const improvedFullSizeStock = 400
        const improvedFullSizeDomesticStock = 100
        const improvedTrialSizeStock = 200
        const improvedFullSizeSellDays = Math.round(improvedFullSizeStock / newProductEstDailyQty)
        const improvedTrialSizeSellDays = Math.round(improvedTrialSizeStock / newProductEstDailyQty)
        const finalStock150mlOverseas = 400
        const finalStock150mlDomestic = 100
        const finalStock150ml = finalStock150mlOverseas + finalStock150mlDomestic
        const finalStock50mlHairDryer = 400
        const finalStock50mlDomestic = 100
        const finalStock50mlOverseas = 200
        const finalStock50mlTotal = finalStock50mlHairDryer + finalStock50mlDomestic + finalStock50mlOverseas
        const final150mlSellDays = Math.round(finalStock150mlOverseas / newProductEstDailyQty)
        const final50mlSellDays = Math.round(finalStock50mlOverseas / newProductEstDailyQty)
        const productionDays = 25
        const productionDaysMin = 25
        const productionDaysMax = 25
        const reorderPoint = newProductEstDailyQty * productionDays

        const packagingAnalysis = {
          fullSize: { volume: '150ml', stock: fullSizeStock, avgMarketPrice: Math.round(spray150mlAvgPrice), marketProductCount: spray150ml.length, pricePer100ml: OUR_SPRAY.skus[2].ourPriceRUB / 150 * 100 },
          trialSize: { volume: '50ml', stock: trialSizeStock, avgMarketPrice: Math.round(spray50mlAvgPrice), marketProductCount: spray50ml.length, pricePer100ml: OUR_SPRAY.skus[0].ourPriceRUB / 50 * 100 },
          improvedFullSize: { volume: '150ml', stock: improvedFullSizeStock, domesticStock: improvedFullSizeDomesticStock, totalStock: improvedFullSizeStock + improvedFullSizeDomesticStock, sellDays: improvedFullSizeSellDays },
          improvedTrialSize: { volume: '50ml', stock: improvedTrialSizeStock, sellDays: improvedTrialSizeSellDays },
          finalStock: {
            size150ml: { overseas: finalStock150mlOverseas, domestic: finalStock150mlDomestic, total: finalStock150ml, sellDays: final150mlSellDays },
            size50ml: { hairDryer: finalStock50mlHairDryer, domestic: finalStock50mlDomestic, overseas: finalStock50mlOverseas, total: finalStock50mlTotal, sellDays: final50mlSellDays },
            totalStock: finalStock150ml + finalStock50mlTotal,
          },
          volumeDistribution,
          top10AvgDailyQty,
          top10AvgDailyQtyPerProduct,
          sprayNewProducts180Count: sprayNewProducts180.length,
          sprayNewProductAvgDailyQtyPerProduct,
          newProductEstByNewProduct,
          newProductEstByTop10,
          newProductEstDailyQty,
          fullSizeSellDays,
          trialSizeSellDays,
          productionDays,
          productionDaysMin,
          productionDaysMax,
          productionDaysDisplay: productionDaysMin === productionDaysMax ? `${productionDaysMin}天` : `${productionDaysMin}-${productionDaysMax}天`,
          reorderPoint,
          top10TotalQty,
        }

        sprayAnalysis = {
          totalProducts: sprayProducts.length,
          totalSales: totalSpraySales,
          totalQty: totalSprayQty,
          volumeData: sortedVolumes,
          effectData: sortedSprayEffects,
          hairTypeData: sortedSprayHairTypes,
          priceByVolumeData,
          top10Products: top10Spray,
          topBrands: sortedSprayBrands,
          sprayHhi,
          sprayMarketPower,
          sprayMarketConcentration,
          sprayMarketConcentrationTop10,
          sprayAvgPrice,
          spray100mlCount: spray100ml.length,
          spray100mlAvgPrice: Math.round(spray100mlAvgPrice),
          spray100mlAvgQty: Math.round(spray100mlAvgQty),
          oilSprayCount: oilSprayProducts.length,
          oilSprayAvgPrice: Math.round(oilSprayAvgPrice),
          oilSprayAvgQty: Math.round(oilSprayAvgQty),
          competitorsSpray: COMPETITORS_SPRAY,
          ourSpray: OUR_SPRAY,
          profitBySku: sprayProfitBySku,
          packagingAnalysis,
        }
      }
    }

    const isGlovesCategory = /手套|перчатк|glove/i.test(topCatName)
    let competitorAnalysis = null
    const nitrileGlovesData = (() => {
      if (!isGlovesCategory) return null
      const nitrileProducts = products.filter(p => {
        const name = (p.name || '').toLowerCase()
        return name.includes('нитрил') || name.includes('nitrile')
      })
      if (nitrileProducts.length === 0) return null

      const colorStats = {}
      const sizeStats = {}
      const useStats = {}
      const brandStatsLocal = {}
      const priceRangeStats = { '0-100': { count: 0, sales: 0, qty: 0 }, '100-200': { count: 0, sales: 0, qty: 0 }, '200-300': { count: 0, sales: 0, qty: 0 }, '300-500': { count: 0, sales: 0, qty: 0 }, '500+': { count: 0, sales: 0, qty: 0 } }
      const packStats = {}

      nitrileProducts.forEach(p => {
        const name = (p.name || '').toLowerCase()
        const price = p.price || 0
        
        if (name.includes('черн') || name.includes('black')) colorStats['黑色'] = (colorStats['黑色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('голуб') || name.includes('син') || name.includes('blue')) colorStats['蓝色'] = (colorStats['蓝色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('бел') || name.includes('white')) colorStats['白色'] = (colorStats['白色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('сер') || name.includes('gray')) colorStats['灰色'] = (colorStats['灰色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('бежев') || name.includes('beige')) colorStats['米色'] = (colorStats['米色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('фиолет') || name.includes('purple')) colorStats['紫色'] = (colorStats['紫色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('розов') || name.includes('pink')) colorStats['粉色'] = (colorStats['粉色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('зелен') || name.includes('green')) colorStats['绿色'] = (colorStats['绿色'] || { count: 0, sales: 0, qty: 0 })
        else colorStats['其他/未标注'] = (colorStats['其他/未标注'] || { count: 0, sales: 0, qty: 0 })
        
        const colorKey = Object.keys(colorStats).find(k => name.includes(k.toLowerCase()) || (k === '黑色' && (name.includes('черн') || name.includes('black'))) || (k === '蓝色' && (name.includes('голуб') || name.includes('син') || name.includes('blue'))) || (k === '白色' && (name.includes('бел') || name.includes('white'))) || (k === '灰色' && (name.includes('сер') || name.includes('gray'))) || (k === '米色' && (name.includes('бежев') || name.includes('beige'))) || (k === '紫色' && (name.includes('фиолет') || name.includes('purple'))) || (k === '粉色' && (name.includes('розов') || name.includes('pink'))) || (k === '绿色' && (name.includes('зелен') || name.includes('green')))) || '其他/未标注'
        if (colorStats[colorKey]) { colorStats[colorKey].count++; colorStats[colorKey].sales += p.sales; colorStats[colorKey].qty += p.qty }
        
        let sizeKey = '未标注'
        if (name.includes(' xs') || name.includes('размер xs')) sizeKey = 'XS'
        else if (name.includes(' s') || name.includes('размер s') || name.includes('размером s')) sizeKey = 'S'
        else if (name.includes(' m') || name.includes('размер m') || name.includes('размером m')) sizeKey = 'M'
        else if (name.includes(' l') || name.includes('размер l') || name.includes('размером l')) sizeKey = 'L'
        else if (name.includes(' xl') || name.includes('размер xl')) sizeKey = 'XL'
        else if (name.includes('xxl')) sizeKey = 'XXL'
        else if (name.includes('универсальн')) sizeKey = '均码'
        if (!sizeStats[sizeKey]) sizeStats[sizeKey] = { count: 0, sales: 0, qty: 0 }
        sizeStats[sizeKey].count++; sizeStats[sizeKey].sales += p.sales; sizeStats[sizeKey].qty += p.qty
        
        if (name.includes('медицинск') || name.includes('медицин')) { if (!useStats['医疗']) useStats['医疗'] = { count: 0, sales: 0, qty: 0 }; useStats['医疗'].count++; useStats['医疗'].sales += p.sales; useStats['医疗'].qty += p.qty }
        if (name.includes('хозяйственн') || name.includes('хозяйств')) { if (!useStats['家务']) useStats['家务'] = { count: 0, sales: 0, qty: 0 }; useStats['家务'].count++; useStats['家务'].sales += p.sales; useStats['家务'].qty += p.qty }
        if (name.includes('смотров')) { if (!useStats['检查']) useStats['检查'] = { count: 0, sales: 0, qty: 0 }; useStats['检查'].count++; useStats['检查'].sales += p.sales; useStats['检查'].qty += p.qty }
        if (name.includes('хирургическ')) { if (!useStats['外科']) useStats['外科'] = { count: 0, sales: 0, qty: 0 }; useStats['外科'].count++; useStats['外科'].sales += p.sales; useStats['外科'].qty += p.qty }
        if (name.includes('парикмахерск') || name.includes('парикмах')) { if (!useStats['美发']) useStats['美发'] = { count: 0, sales: 0, qty: 0 }; useStats['美发'].count++; useStats['美发'].sales += p.sales; useStats['美发'].qty += p.qty }
        if (name.includes('косметическ') || name.includes('космет')) { if (!useStats['美容']) useStats['美容'] = { count: 0, sales: 0, qty: 0 }; useStats['美容'].count++; useStats['美容'].sales += p.sales; useStats['美容'].qty += p.qty }
        if (name.includes('садов') || name.includes('сад')) { if (!useStats['园艺']) useStats['园艺'] = { count: 0, sales: 0, qty: 0 }; useStats['园艺'].count++; useStats['园艺'].sales += p.sales; useStats['园艺'].qty += p.qty }
        if (name.includes('уборк')) { if (!useStats['清洁']) useStats['清洁'] = { count: 0, sales: 0, qty: 0 }; useStats['清洁'].count++; useStats['清洁'].sales += p.sales; useStats['清洁'].qty += p.qty }
        if (name.includes('одноразов')) { if (!useStats['一次性']) useStats['一次性'] = { count: 0, sales: 0, qty: 0 }; useStats['一次性'].count++; useStats['一次性'].sales += p.sales; useStats['一次性'].qty += p.qty }
        if (name.includes('многоразов')) { if (!useStats['可重复使用']) useStats['可重复使用'] = { count: 0, sales: 0, qty: 0 }; useStats['可重复使用'].count++; useStats['可重复使用'].sales += p.sales; useStats['可重复使用'].qty += p.qty }
        
        const brand = p.brand || '未知'
        if (!brandStatsLocal[brand]) brandStatsLocal[brand] = { count: 0, sales: 0, qty: 0 }
        brandStatsLocal[brand].count++; brandStatsLocal[brand].sales += p.sales; brandStatsLocal[brand].qty += p.qty
        
        if (price > 0 && price <= 100) { priceRangeStats['0-100'].count++; priceRangeStats['0-100'].sales += p.sales; priceRangeStats['0-100'].qty += p.qty }
        else if (price > 100 && price <= 200) { priceRangeStats['100-200'].count++; priceRangeStats['100-200'].sales += p.sales; priceRangeStats['100-200'].qty += p.qty }
        else if (price > 200 && price <= 300) { priceRangeStats['200-300'].count++; priceRangeStats['200-300'].sales += p.sales; priceRangeStats['200-300'].qty += p.qty }
        else if (price > 300 && price <= 500) { priceRangeStats['300-500'].count++; priceRangeStats['300-500'].sales += p.sales; priceRangeStats['300-500'].qty += p.qty }
        else if (price > 500) { priceRangeStats['500+'].count++; priceRangeStats['500+'].sales += p.sales; priceRangeStats['500+'].qty += p.qty }
        
        const packMatch = name.match(/(\d+)\s*(шт|пар)/)
        if (packMatch) {
          const rawQty = parseInt(packMatch[1])
          const qty = packMatch[2] === 'пар' ? rawQty * 2 : rawQty
          let packKey = '其他'
          if (qty <= 10) packKey = '1-10只'
          else if (qty <= 50) packKey = '11-50只'
          else if (qty <= 100) packKey = '51-100只'
          else if (qty <= 200) packKey = '101-200只'
          else packKey = '200只+'
          if (!packStats[packKey]) packStats[packKey] = { count: 0, sales: 0, qty: 0 }
          packStats[packKey].count++; packStats[packKey].sales += p.sales; packStats[packKey].qty += p.qty
        }
      })

      const totalNitrileSales = nitrileProducts.reduce((s, p) => s + p.sales, 0)
      const totalNitrileQty = nitrileProducts.reduce((s, p) => s + p.qty, 0)
      const avgNitrilePrice = nitrileProducts.filter(p => p.price > 0).length > 0 
        ? nitrileProducts.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / nitrileProducts.filter(p => p.price > 0).length 
        : 0

      const colorData = Object.entries(colorStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)
      const sizeData = Object.entries(sizeStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)
      const useData = Object.entries(useStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)
      const brandData = Object.entries(brandStatsLocal).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.sales - a.sales).slice(0, 10)
      const priceData = Object.entries(priceRangeStats).map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0 }))
      const packData = Object.entries(packStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)

      const getColor = (name) => {
        if (/черн|black/i.test(name)) return '黑色'
        if (/голуб|син|blue/i.test(name)) return '蓝色'
        if (/бел|white/i.test(name)) return '白色'
        if (/сер|gray/i.test(name)) return '灰色'
        if (/бежев|beige/i.test(name)) return '米色'
        if (/фиолет|purple/i.test(name)) return '紫色'
        if (/розов|pink/i.test(name)) return '粉色'
        if (/зелен|green/i.test(name)) return '绿色'
        return null
      }
      const getSize = (name) => {
        if (/xs/i.test(name)) return 'XS'
        if (/(?<![a-z])s(?![a-z])|размер\s*s|размером\s*s/i.test(name)) return 'S'
        if (/(?<![a-z])m(?![a-z])|размер\s*m|размером\s*m/i.test(name)) return 'M'
        if (/(?<![a-z])l(?![a-z])|размер\s*l|размером\s*l/i.test(name)) return 'L'
        if (/xl/i.test(name)) return 'XL'
        if (/xxl/i.test(name)) return 'XXL'
        if (/универсальн/i.test(name)) return '均码'
        return null
      }
      const getPack = (name) => {
        const m = name.match(/(\d+)\s*(шт|пар)/)
        if (m) {
          const num = parseInt(m[1])
          const total = m[2] === 'пар' ? num * 2 : num
          return `${total}只`
        }
        return null
      }
      const getUse = (name) => {
        if (/медицинск|медицин/i.test(name)) return '医疗'
        if (/хозяйственн|хозяйств/i.test(name)) return '家务'
        if (/смотров/i.test(name)) return '检查'
        if (/хирургическ/i.test(name)) return '外科'
        if (/парикмахерск|парикмах/i.test(name)) return '美发'
        if (/косметическ|космет/i.test(name)) return '美容'
        if (/садов|сад/i.test(name)) return '园艺'
        if (/уборк/i.test(name)) return '清洁'
        if (/одноразов/i.test(name)) return '一次性'
        if (/многоразов/i.test(name)) return '可重复使用'
        return null
      }
      const getShipType = (name) => {
        const lower = name.toLowerCase()
        if (/\bfbo\b/i.test(lower)) return 'FBO'
        if (/\bfbs\b/i.test(lower)) return 'FBS'
        if (/野派|fbo|fbs/i.test(name)) {
          if (/fbs/i.test(name)) return 'FBS'
          if (/fbo/i.test(name)) return 'FBO'
        }
        return null
      }
      const getGrossRate = (price) => {
        const refPrice = 1.5
        if (price < refPrice) return null
        return ((price - refPrice) / price * 100).toFixed(1)
      }

      const getPieceCount = (name) => {
        const m = name.match(/(\d+)\s*(шт|пар)/)
        if (m) {
          const num = parseInt(m[1])
          return m[2] === 'пар' ? num * 2 : num
        }
        return null
      }

      const topProducts = [...nitrileProducts].sort((a, b) => b.qty - a.qty).slice(0, 10).map(p => {
        const name = (p.name || '').toLowerCase()
        const pieceCount = getPieceCount(name)
        return {
          ...p,
          _color: getColor(p.name || ''),
          _size: getSize(p.name || ''),
          _pack: getPack(name),
          _pieceCount: pieceCount,
          _pricePerPiece: pieceCount && p.price > 0 ? (p.price / pieceCount).toFixed(1) : null,
          _use: getUse(p.name || ''),
          _shipType: getShipType(p.name || ''),
          _grossRate: getGrossRate(p.price),
        }
      })

      const OUR_COST = { purchase: 38, logistics: 20, ozonRate: 0.12, adRate: 0.10, exchangeLoss: 0.01, afterSales: 0.03, weight: 8.5 }
      const OUR_ACTUAL_PRICE_50 = 851
      const OUR_ACTUAL_PRICE_100 = 2120

      const top100Products = topProducts.filter(p => p._pieceCount === 100)
      const compBase = top100Products.length >= 3 ? top100Products : topProducts.filter(p => p._pieceCount && p._pieceCount >= 80 && p._pieceCount <= 120)
      const compProducts = compBase.length >= 3 ? compBase : topProducts

      const top10AvgPrice = compProducts.length > 0 ? compProducts.reduce((s, p) => s + (p.price || 0), 0) / compProducts.length : 0
      const top10MaxPrice = compProducts.length > 0 ? Math.max(...compProducts.map(p => p.price || 0)) : 0
      const top10MinPrice = compProducts.length > 0 ? Math.min(...compProducts.filter(p => p.price > 0).map(p => p.price || Infinity)) : 0
      const top10AvgQty = compProducts.length > 0 ? compProducts.reduce((s, p) => s + (p.qty || 0), 0) / compProducts.length : 0
      const top10Colors = [...new Set(compProducts.map(p => p._color).filter(Boolean))]
      const top10Sizes = [...new Set(compProducts.map(p => p._size).filter(Boolean))]
      const top10Packs = [...new Set(compProducts.map(p => p._pack).filter(Boolean))]
      const top10FboRatio = compProducts.filter(p => p._shipType === 'FBO').length / compProducts.length * 100
      const top10FbsRatio = compProducts.filter(p => p._shipType === 'FBS').length / compProducts.length * 100
      const top10GrossRates = compProducts.map(p => parseFloat(p._grossRate || 0)).filter(r => r > 0)
      const top10AvgGross = top10GrossRates.length > 0 ? top10GrossRates.reduce((s, r) => s + r, 0) / top10GrossRates.length : 0

      const calcProfit = (priceRub, purchaseCNY, logisticsCNY) => {
        const revenue = priceRub * R
        const ozonFee = priceRub * OUR_COST.ozonRate * R
        const adFee = priceRub * OUR_COST.adRate * R
        const exchangeLoss = priceRub * OUR_COST.exchangeLoss * R
        const afterSalesCost = priceRub * OUR_COST.afterSales * R
        const totalCost = purchaseCNY + ozonFee + adFee + exchangeLoss + afterSalesCost + logisticsCNY
        const profit = revenue - totalCost
        const rate = revenue > 0 ? (profit / revenue * 100) : 0
        return { profit, rate, ozonFee, adFee, exchangeLoss, afterSalesCost, totalCost, revenue }
      }

      const profit50 = calcProfit(OUR_ACTUAL_PRICE_50, OUR_COST.purchase / 2, OUR_COST.logistics * 3 / 5)
      const profit100 = calcProfit(OUR_ACTUAL_PRICE_100, OUR_COST.purchase, OUR_COST.logistics)
      const profitAtAvg = calcProfit(top10AvgPrice, OUR_COST.purchase, OUR_COST.logistics)

      const ozonFee50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.ozonRate)
      const adFee50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.adRate)
      const exchangeLoss50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.exchangeLoss)
      const afterSales50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.afterSales)
      const ozonFee100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.ozonRate)
      const adFee100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.adRate)
      const exchangeLoss100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.exchangeLoss)
      const afterSales100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.afterSales)

      const top10ColorCount = top10Colors.length
      const top10SizeCount = top10Sizes.length
      const top10AvgPieceCount = compProducts.filter(p => p._pieceCount).length > 0
        ? compProducts.filter(p => p._pieceCount).reduce((s, p) => s + p._pieceCount, 0) / compProducts.filter(p => p._pieceCount).length
        : 0
      const top10AvgPricePerPiece = compProducts.filter(p => p._pricePerPiece).length > 0
        ? compProducts.filter(p => p._pricePerPiece).reduce((s, p) => s + parseFloat(p._pricePerPiece), 0) / compProducts.filter(p => p._pricePerPiece).length
        : 0
      const ourPricePerPiece100 = OUR_ACTUAL_PRICE_100 / 100

      const radarData = [
        {
          subject: '产品质量',
          us: 95,
          avg: Math.min(70, Math.round(50 + (top10AvgPieceCount < 6 ? 10 : 0) + (top10AvgGross < 15 ? 5 : 10))),
          fullMark: 100,
          usNote: '8.5g高克重重型防滑',
          avgNote: `市场均重${top10AvgPieceCount > 0 ? top10AvgPieceCount.toFixed(1) + 'g' : '5-6g'}`
        },
        {
          subject: '价格竞争力',
          us: Math.round(Math.max(30, 100 - (ourPricePerPiece100 / Math.max(top10AvgPricePerPiece, 0.1) - 1) * 50)),
          avg: 65,
          fullMark: 100,
          usNote: `₽${ourPricePerPiece100.toFixed(1)}/只`,
          avgNote: `₽${top10AvgPricePerPiece.toFixed(1)}/只`
        },
        {
          subject: '利润空间',
          us: Math.min(95, Math.max(20, Math.round(profit100.rate * 2 + 30))),
          avg: Math.min(80, Math.max(20, Math.round(parseFloat(top10AvgGross) * 3 + 25))),
          fullMark: 100,
          usNote: `净利率${profit100.rate.toFixed(1)}%`,
          avgNote: `净利率${top10AvgGross.toFixed(1)}%`
        },
        {
          subject: '供货稳定性',
          us: 90,
          avg: 70,
          fullMark: 100,
          usNote: '国内采购稳定',
          avgNote: '依赖本地供应'
        },
        {
          subject: '包装体验',
          us: 85,
          avg: Math.min(70, 50 + top10ColorCount * 3 + top10SizeCount * 3),
          fullMark: 100,
          usNote: '双面防滑+高克重',
          avgNote: `${top10ColorCount}色${top10SizeCount}码`
        },
        {
          subject: '合规认证',
          us: 80,
          avg: 55,
          fullMark: 100,
          usNote: '无乳胶认证',
          avgNote: '认证参差不齐'
        },
        {
          subject: '品牌故事',
          us: 65,
          avg: Math.min(75, 45 + Math.round(top10AvgQty / 500)),
          fullMark: 100,
          usNote: '重型防滑手套专家',
          avgNote: `TOP10均销${Math.round(top10AvgQty)}件`
        },
        {
          subject: '市场熟悉度',
          us: 50,
          avg: Math.min(85, 55 + Math.round(top10AvgQty / 300)),
          fullMark: 100,
          usNote: '新入局者',
          avgNote: `已验证市场`
        },
      ]

      competitorAnalysis = {
        top10AvgPrice: Math.round(top10AvgPrice),
        top10MaxPrice: Math.round(top10MaxPrice),
        top10MinPrice: Math.round(top10MinPrice),
        top10AvgQty: Math.round(top10AvgQty),
        top10Colors,
        top10Sizes,
        top10Packs,
        top10FboRatio: top10FboRatio.toFixed(0),
        top10FbsRatio: top10FbsRatio.toFixed(0),
        top10AvgGross: top10AvgGross.toFixed(1),
        top10AvgPricePerPiece: top10AvgPricePerPiece.toFixed(1),
        ourPrice50: OUR_ACTUAL_PRICE_50,
        ourPrice100: OUR_ACTUAL_PRICE_100,
        ourPurchase50: OUR_COST.purchase / 2,
        ourPurchase100: OUR_COST.purchase,
        ourLogistics50: OUR_COST.logistics * 3 / 5,
        ourLogistics100: OUR_COST.logistics,
        profit50: profit50.profit.toFixed(2),
        profitRate50: profit50.rate.toFixed(1),
        profit100: profit100.profit.toFixed(2),
        profitRate100: profit100.rate.toFixed(1),
        profitAtAvg: profitAtAvg.profit.toFixed(2),
        profitRateAtAvg: profitAtAvg.rate.toFixed(1),
        ozonFee50,
        adFee50,
        exchangeLoss50,
        afterSales50,
        ozonFee100,
        adFee100,
        exchangeLoss100,
        afterSales100,
        ourCostCNY: OUR_COST.purchase,
        ourLogistics: OUR_COST.logistics,
        ourWeight: OUR_COST.weight,
        ourColor: '黑色/橙色',
        ourSize: 'M码',
        compProductCount: compProducts.length,
        compIs100pcs: top100Products.length >= 3,
        radarData,
      }

      return {
        total: nitrileProducts.length,
        totalSales: totalNitrileSales,
        totalQty: totalNitrileQty,
        avgPrice: avgNitrilePrice,
        shareOfCategory: (nitrileProducts.length / products.length * 100).toFixed(1),
        colorData,
        sizeData,
        useData,
        brandData,
        priceData,
        packData,
        topProducts
      }
    })()

    return {
      totalSales, totalSalesCNY: totalSales * R, totalQty, totalExposure, totalClicks,
      totalAdCost, totalAdCostCNY: totalAdCost * R, avgGross, avgCartRate, avgPrice,
      productCount: data.length, brandCount: Object.keys(brandStats).length,
      topCategory: topCatName,
      dictionary,
      topBrands, shippingData, fbsFboChartData, priceData, featureData, topProducts, fbsTopProducts,
      highPotential, vacuumZone, adEfficiency, noAdHighSales, priceElasticity, priceBandFeatureData,
      newProducts180, newProductsStats, priceScatterAnalysis, operationStrategy,
      avgClickRate: totalExposure > 0 ? (totalClicks / totalExposure * 100).toFixed(2) : '0',
      avgAdRatio: products.reduce((s, p) => s + p.adRatio, 0) / products.length,
      marketConcentration, hhi, marketPower, brandPower, underservedPrices, seasonalData, seasonalAdvice,
      isPillowCategory, sizeMaterialData,
      isHairCareCategory, ingredientData,
      isHairMaskCategory, hairMaskAnalysis,
      isSprayCategory, sprayAnalysis,
      isGlovesCategory, nitrileGlovesData, competitorAnalysis
    }
  }, [data])
}
