// T4-2/T4-3 1000 SKU 分数分布审计（一次性脚本，非生产代码）
// 输出：A/B/C/D/不可评级 五档分布、LOW_MARKET_CONTEXT 虚高检查、Top20% 模型 enrichment（candidate-weighted + unique-type）
const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(process.cwd(), 'node_modules', 'xlsx'));
const { pathToFileURL } = require('url');

const ROOT = process.cwd();

async function main() {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'scoring_rules.json'), 'utf-8'));
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.json'), 'utf-8'));
  const bench = JSON.parse(fs.readFileSync(path.join(ROOT, 'ozon-react', 'public', 'data', 'bsr_market_benchmarks.json'), 'utf-8'));
  const { scoreProduct } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'scoring', 'scoringEngine.js')).href);
  const { calcShipping, ALL_CHANNELS } = await import(pathToFileURL(path.join(ROOT, 'ozon-react', 'src', 'utils', 'ozonEngine.js')).href);

  // ---- 1. 读候选 ----
  const wb = xlsx.readFile(path.join(ROOT, '选品', '跨境项目产品线扩展计划.xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const headers = rows[0].map((h) => String(h == null ? '' : h).trim());
  const col = (name) => headers.findIndex((h) => h === name);
  const idx = {
    name: col('商品名称'), brand: col('品牌'), cat: col('所属类目'),
    rating: col('商品评分'), reviews: col('评论数'), price: col('价格'), avgPrice: col('平均单价'),
    sales: col('销售额'), units: col('销量'), exposure: col('曝光量'), visits: col('浏览次数'),
    conv: col('订单转化率'), cartAdd: col('商品卡加入购物车率'),
    gross: col('预估毛利率'), fbs: col('FBS佣金（%）'), fbo: col('FBO佣金（%）'), rfbs: col('RFBS佣金（%）'), fbp: col('FBP佣金（%）'),
    adShare: col('广告占比'), weight: col('重量 g'), volume: col('体积/公升'),
    len: col('尺寸-长度（cm）'), wid: col('尺寸-宽度（cm）'), hei: col('尺寸-高度（cm）'),
    shipMode: col('发货模式'), signRate: col('签收率'), oos: col('无库存天占比'),
    stock: col('期末库存数'), turnover: col('周转动态'), revenueLoss: col('收入损失'),
  };
  const pctNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n; };

  const candidates = rows.slice(1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''))
    .map((r) => {
      const catFull = String(r[idx.cat] || '').trim();
      const sales = pctNum(r[idx.sales]);
      const price = pctNum(r[idx.price]);
      const avgPrice = pctNum(r[idx.avgPrice]);
      return {
        name: String(r[idx.name] || '').trim(),
        category_leaf: catFull.split('>').pop().trim(),
        category_full: catFull,
        price_rub: price != null && price > 0 ? price : null,
        avg_price_rub: avgPrice != null && avgPrice > 0 ? avgPrice : null,
        sales_rub_28d: sales,
        units_28d: pctNum(r[idx.units]),
        conv_rate: pctNum(r[idx.conv]),
        cart_add_rate: pctNum(r[idx.cartAdd]),
        exposure: pctNum(r[idx.exposure]),
        card_visits: pctNum(r[idx.visits]),
        reviews: pctNum(r[idx.reviews]),
        gross_margin: pctNum(r[idx.gross]),
        commission_fbs: pctNum(r[idx.fbs]), commission_fbo: pctNum(r[idx.fbo]),
        commission_rfbs: pctNum(r[idx.rfbs]), commission_fbp: pctNum(r[idx.fbp]),
        ad_share: pctNum(r[idx.adShare]),
        weight_kg: (pctNum(r[idx.weight]) ?? 0) / 1000,
        volume_l: pctNum(r[idx.volume]),
        // 尺寸缺失保持 null（引擎按数据不足处理，禁止回填）
        dims: [pctNum(r[idx.len]), pctNum(r[idx.wid]), pctNum(r[idx.hei])],
        ship_mode: String(r[idx.shipMode] || '').trim(),
        sign_rate: pctNum(r[idx.signRate]),
        oos_days_share: pctNum(r[idx.oos]),
        stock: pctNum(r[idx.stock]),
        turnover: pctNum(r[idx.turnover]),
        revenue_loss_rate: sales != null && sales > 0 && pctNum(r[idx.revenueLoss]) != null
          ? pctNum(r[idx.revenueLoss]) / sales : null,
      };
    });

  // ---- 2. 候选池（percentile 用） ----
  const poolArr = (key) => candidates.map((c) => c[key]).filter((v) => v !== null && v !== undefined);
  const candidatePool = {
    sales_rub_28d: poolArr('sales_rub_28d'), units_28d: poolArr('units_28d'),
    conv_rate: poolArr('conv_rate'), cart_add_rate: poolArr('cart_add_rate'),
    exposure: poolArr('exposure'), card_visits: poolArr('card_visits'), reviews: poolArr('reviews'),
    gross_margin: poolArr('gross_margin'),
    commission_max: candidates.map((c) => Math.max(c.commission_fbs ?? 0, c.commission_fbo ?? 0, c.commission_rfbs ?? 0, c.commission_fbp ?? 0)).filter((v) => v != null),
    ad_share: poolArr('ad_share'), sign_rate: poolArr('sign_rate'),
    oos_days_share: poolArr('oos_days_share'), turnover: poolArr('turnover'),
    revenue_loss_rate: poolArr('revenue_loss_rate'),
    billable_weight: [], shipping_ratio: [], // 物流池：预计算
  };

  // ---- 3. 类型映射（精确 > 包含 > domain 由类型自带） ----
  const typeBench = bench.product_types;
  const domainBench = bench.domains;
  const typeNames = Object.keys(typeBench).filter((t) => t !== '(未分类)');
  // shrinkage：α = n/(n+5)，对顶层标量与 p10-p90 字段线性融合
  function blendBench(typeB, domainB, n) {
    if (!domainB) return typeB;
    const alpha = n / (n + 5);
    const out = { ...typeB };
    const blend = (tv, dv) => (tv != null && dv != null ? alpha * tv + (1 - alpha) * dv : (tv ?? dv));
    for (const key of ['seller_hhi', 'brand_hhi', 'top1_brand_share', 'top5_brand_share', 'top10_seller_share', 'fbo_share', 'fbs_share', 'bsr_leader_share']) {
      out[key] = blend(typeB[key], domainB[key]);
    }
    for (const key of ['sales_28d', 'units_28d', 'avg_price_rub', 'min_price_rub', 'sign_rate', 'conv_rate', 'cart_add', 'discount', 'promo_share', 'promo_days', 'ad_days', 'ad_roi', 'oos_days', 'missed_sales_rub', 'volume_l']) {
      const t = typeB[key] || {}, d = domainB[key] || {};
      out[key] = {};
      for (const q of ['p10', 'p25', 'p50', 'p75', 'p90']) {
        out[key][q] = blend(t[q], d[q]);
      }
    }
    return out;
  }
  function matchType(leaf) {
    if (typeNames.includes(leaf)) {
      const b = typeBench[leaf];
      return { kind: 'exact', benchmark: b, matchedType: leaf, domain: b.domain, n: b.n };
    }
    const hit = typeNames.find((t) => (t.includes(leaf) || leaf.includes(t)) && Math.min(t.length, leaf.length) >= 2);
    if (hit) {
      const b = typeBench[hit];
      return { kind: 'partial', benchmark: domainBench[b.domain] || null, matchedType: hit, domain: b.domain, n: b.n };
    }
    return { kind: 'none', benchmark: null, matchedType: null, domain: null, n: null };
  }

  // ---- 4. 物流池预计算 ----
  // 有效价格：price>0 用 price，否则 avg_price；都无效时用 1 探测渠道（ratio 不计算）
  const effPriceOf = (c) => (c.price_rub > 0 ? c.price_rub : (c.avg_price_rub && c.avg_price_rub > 0 ? c.avg_price_rub : null))
  const celChannels = (c) => {
    if (!(c.weight_kg > 0)) return []
    const p = effPriceOf(c) ?? 1
    const out = []
    for (const ch of ALL_CHANNELS) {
      const res = calcShipping(ch, p, c.weight_kg, c.dims[0], c.dims[1], c.dims[2])
      if (res) out.push(res)
    }
    return out
  }
  const dimsValid = (c) => Array.isArray(c.dims) && c.dims.length === 3 && c.dims.every((v) => v !== null && v !== undefined && v > 0)
  for (const c of candidates) {
    // 冻结契约：尺寸/重量无效的 SKU 不得进入 shipping_ratio / billable_weight percentile 池
    if (!(c.weight_kg > 0) || !dimsValid(c)) continue
    const chs = celChannels(c)
    if (chs.length > 0) {
      const best = chs.reduce((a, b) => (b.cost < a.cost ? b : a), chs[0])
      candidatePool.billable_weight.push(best.chargeWeight)
      const eff = effPriceOf(c)
      if (eff > 0) {
        candidatePool.shipping_ratio.push(best.cost / (eff / settings.rub_per_cny))
      }
    }
  }

  // ---- 5. 评分 ----
  const results = candidates.map((c) => {
    const m = matchType(c.category_leaf)
    let context, benchmark = m.benchmark, domainTypes = []
    if (m.kind === 'exact') {
      context = m.n >= 10 ? 'HIGH' : m.n >= 5 ? 'MEDIUM' : 'LOW'
      if (m.n < 10) benchmark = blendBench(typeBench[m.matchedType], domainBench[m.domain], m.n)
    } else if (m.kind === 'partial') {
      context = 'LOW'
    } else {
      context = 'LOW_MARKET_CONTEXT'
      benchmark = null
    }
    if (m.domain && domainBench[m.domain]) {
      domainTypes = Object.entries(typeBench)
        .filter(([, t]) => t.domain === m.domain)
        .map(([, t]) => t)
    }
    const deps = { candidatePool, rubPerCny: settings.rub_per_cny, calcCelShipping: celChannels }
    const r = scoreProduct(c, { context, benchmark, matchedType: m.matchedType, sampleSize: m.n, domainTypes }, deps, rules)
    return { ...r, kind: m.kind, leaf: c.category_leaf, sales: c.sales_rub_28d }
  })

  // ---- 6. 分布统计 ----
  const total = results.length
  const gradeCount = { A: 0, B: 0, C: 0, D: 0, null: 0 }
  const contextCount = { HIGH: 0, MEDIUM: 0, LOW: 0, LOW_MARKET_CONTEXT: 0 }
  const statusCount = {}
  const scores = []
  for (const r of results) {
    gradeCount[r.grade ?? 'null']++
    contextCount[r.context]++
    for (const s of r.status) statusCount[s] = (statusCount[s] || 0) + 1
    if (r.totalScore !== null) scores.push(r.totalScore)
  }
  scores.sort((a, b) => a - b)
  const p = (q) => scores[Math.floor(scores.length * q)]

  console.log('===== 1000 SKU 分数分布审计 =====')
  console.log(`总数: ${total}`)
  console.log(`A: ${gradeCount.A} (${(gradeCount.A / total * 100).toFixed(1)}%)`)
  console.log(`B: ${gradeCount.B} (${(gradeCount.B / total * 100).toFixed(1)}%)`)
  console.log(`C: ${gradeCount.C} (${(gradeCount.C / total * 100).toFixed(1)}%)`)
  console.log(`D: ${gradeCount.D} (${(gradeCount.D / total * 100).toFixed(1)}%)`)
  console.log(`不可评级: ${gradeCount.null}`)
  console.log(`\n分数分布: min ${scores[0]?.toFixed(1)} / p10 ${p(0.1)?.toFixed(1)} / p25 ${p(0.25)?.toFixed(1)} / p50 ${p(0.5)?.toFixed(1)} / p75 ${p(0.75)?.toFixed(1)} / p90 ${p(0.9)?.toFixed(1)} / max ${scores[scores.length - 1]?.toFixed(1)}`)
  console.log(`\nContext: HIGH ${contextCount.HIGH} / MEDIUM ${contextCount.MEDIUM} / LOW ${contextCount.LOW} / LOW_MARKET_CONTEXT ${contextCount.LOW_MARKET_CONTEXT}`)
  console.log(`\nStatus 分布:`)
  for (const [k, v] of Object.entries(statusCount).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`)

  // 虚高检查：LOW_MARKET_CONTEXT 组的分数分布 vs 有映射组
  const lmc = results.filter((r) => r.context === 'LOW_MARKET_CONTEXT').map((r) => r.totalScore).filter((s) => s !== null)
  const mapped = results.filter((r) => r.context !== 'LOW_MARKET_CONTEXT').map((r) => r.totalScore).filter((s) => s !== null)
  const avg = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0
  const aLmc = results.filter((r) => r.context === 'LOW_MARKET_CONTEXT' && r.grade === 'A').length
  const aMapped = results.filter((r) => r.context !== 'LOW_MARKET_CONTEXT' && r.grade === 'A').length
  console.log(`\n虚高检查:`)
  console.log(`  LOW_MARKET_CONTEXT 组: n=${lmc.length}, 均分 ${avg(lmc).toFixed(1)}, A 数 ${aLmc} (${(aLmc / Math.max(contextCount.LOW_MARKET_CONTEXT, 1) * 100).toFixed(1)}%)`)
  console.log(`  有映射组: n=${mapped.length}, 均分 ${avg(mapped).toFixed(1)}, A 数 ${aMapped} (${(aMapped / Math.max(total - contextCount.LOW_MARKET_CONTEXT, 1) * 100).toFixed(1)}%)`)

  // ---- 7. 模型验证：Top20% 总分 SKU 的 matched-type 销售领导者 enrichment ----
  // 真实验证流程（T4-3 口径）：仅取有 BSR 映射的候选 → 按 totalScore 排序 → 模型 Top20%
  // → 其 matched type 的 bsr_leader_share 均值 vs 全部 mapped 候选的 matched-type baseline。
  const mappedResults = results.filter((r) => r.context !== 'LOW_MARKET_CONTEXT' && r.totalScore !== null)
  const leaderOf = (r) => {
    const t = r.matchedProductType ? typeBench[r.matchedProductType] : null
    return t && t.bsr_leader_share != null ? t.bsr_leader_share : null
  }
  const withLeader = mappedResults.filter((r) => leaderOf(r) !== null)
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
  const baseLeader = mean(withLeader.map((r) => leaderOf(r)))
  const byScore = [...withLeader].sort((a, b) => b.totalScore - a.totalScore)
  const top20 = byScore.slice(0, Math.ceil(byScore.length * 0.2))
  const topLeader = mean(top20.map((r) => leaderOf(r)))
  console.log(`\n模型验证：Top20% 总分 SKU 的 matched-type 销售领导者 enrichment`)
  console.log(`  参与: mapped 且可评级 ${mappedResults.length} 行; matched type 有 bsr_leader_share 的 ${withLeader.length} 行`)
  console.log(`  baseline (candidate-weighted): ${baseLeader?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  模型 Top20% 组 (candidate-weighted): ${topLeader?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  enrichment 倍数 (candidate-weighted): ${baseLeader && topLeader ? (topLeader / baseLeader).toFixed(2) : 'N/A'}`)
  // unique-type 口径：避免同一产品类型因候选 SKU 多而被重复加权
  const byType = {}
  for (const r of withLeader) {
    if (!byType[r.matchedProductType]) byType[r.matchedProductType] = []
    byType[r.matchedProductType].push(r)
  }
  const typeRows = Object.values(byType).map((rs) => ({
    type: rs[0].matchedProductType,
    score: rs.reduce((s, r) => s + r.totalScore, 0) / rs.length,
    leader: leaderOf(rs[0]),
  }))
  const baseType = mean(typeRows.map((t) => t.leader))
  typeRows.sort((a, b) => b.score - a.score)
  const topTypes = typeRows.slice(0, Math.ceil(typeRows.length * 0.2))
  const topTypeLeader = mean(topTypes.map((t) => t.leader))
  console.log(`  unique-type: 覆盖 ${typeRows.length} 个产品类型`)
  console.log(`  baseline (unique-type): ${baseType?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  Top20% 类型组 (unique-type): ${topTypeLeader?.toFixed(1) ?? 'N/A'}%`)
  console.log(`  enrichment 倍数 (unique-type): ${baseType && topTypeLeader ? (topTypeLeader / baseType).toFixed(2) : 'N/A'}`)

  // 保存明细（本地审计用，不入 git）
  fs.writeFileSync(path.join(ROOT, '_audit', 'tmp', 't4-score-audit-raw.json'), JSON.stringify(results, null, 2), 'utf-8')
  console.log(`\n明细: _audit/tmp/t4-score-audit-raw.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
