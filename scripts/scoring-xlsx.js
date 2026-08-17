// scripts/scoring-xlsx.js — 选品 xlsx → canonical candidates 解析（唯一实现，审计与数据构建共用）
// canonical 字段契约见 T4-1B §1.1；每日字段不评分不解析。
const fs = require('fs');
const path = require('path');
const xlsx = require(path.join(process.cwd(), 'node_modules', 'xlsx'));

function loadCanonicalCandidates(xlsxPath) {
  const wb = xlsx.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const headers = rows[0].map((h) => String(h == null ? '' : h).trim());
  const col = (name) => headers.findIndex((h) => h === name);
  const idx = {
    name: col('商品名称'), brand: col('品牌'), cat: col('所属类目'),
    rating: col('商品评分'), reviews: col('评论数'), price: col('价格'), avgPrice: col('平均单价'),
    productId: col('商品ID'),
    sales: col('销售额'), units: col('销量'), exposure: col('曝光量'), visits: col('浏览次数'),
    conv: col('订单转化率'), cartAdd: col('商品卡加入购物车率'),
    gross: col('预估毛利率'), fbs: col('FBS佣金（%）'), fbo: col('FBO佣金（%）'), rfbs: col('RFBS佣金（%）'), fbp: col('FBP佣金（%）'),
    adShare: col('广告占比'), weight: col('重量 g'), volume: col('体积/公升'),
    len: col('尺寸-长度（cm）'), wid: col('尺寸-宽度（cm）'), hei: col('尺寸-高度（cm）'),
    shipMode: col('发货模式'), signRate: col('签收率'), oos: col('无库存天占比'),
    stock: col('期末库存数'), turnover: col('周转动态'), revenueLoss: col('收入损失'),
  };
  const pctNum = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n; };

  return rows.slice(1)
    .filter((r) => r.some((c) => c !== null && c !== undefined && c !== ''))
    .map((r) => {
      const catFull = String(r[idx.cat] || '').trim();
      const sales = pctNum(r[idx.sales]);
      const price = pctNum(r[idx.price]);
      const avgPrice = pctNum(r[idx.avgPrice]);
      return {
        name: String(r[idx.name] || '').trim(),
        // T6-1：稳定业务身份（原始 商品ID，1000 行 1000 唯一）；评分引擎忽略此字段
        source_product_id: r[idx.productId] != null ? String(r[idx.productId]).trim() : '',
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
}

module.exports = { loadCanonicalCandidates };
