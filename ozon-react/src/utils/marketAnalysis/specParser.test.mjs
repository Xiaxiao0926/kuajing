/**
 * 模块3 规格标准化解析器 - 单元测试
 * 运行: node ozon-react/src/utils/marketAnalysis/specParser.test.mjs
 *
 * 夹具来源：真实 Ozon 热销表标题（手套2026-05-12 / 发膜2026-05-08 / 护发喷雾2026-05-08 /
 * 枕头2026-05-08 / 矫形枕2026-05-07 / 热销产品2026-05-06），逐条标注期望，
 * 陷阱样例（尺寸对/型号/Nв1/насадок/№8/版本号）均来自真实数据。
 */

import { parseSpec, pickCandidate } from './specParser.js'

let pass = 0, fail = 0
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`) }
  else { fail++; console.log(`  ❌ ${msg}`) }
}
const P = (title) => parseSpec(title)

console.log('\n===== 规格标准化解析器 测试开始 =====\n')

// ---------- пар（双） ----------
{
  const p = P('Перчатки хозяйственные размер Универсальный 6 пар')
  assert(p.primary && p.primary.unit === 'пар' && p.primary.qty === 6 && p.primary.value === 12,
    '6 пар → pair, qty=6, 折算 12 只')
}
{
  const p = P('Перчатки хозяйственные размер M 50 пар')
  assert(p.primary && p.primary.qty === 50 && p.primary.value === 100, '50 пар → 100 只')
}
{
  const p = P('Перчатки хозяйственные 1 пара размер M')
  assert(p.primary && p.primary.qty === 1 && p.primary.value === 2, '1 пара（单数变格）→ 2 只')
}
{
  const p = P('Перчатки хозяйственные размер M 12 пар')
  assert(p.primary && p.primary.qty === 12 && p.primary.value === 24, '12 пар → 24 只')
}
{
  const p = P('Партия перчаток 100 штук партия 5')
  assert(p.candidates.filter((c) => c.basis === 'pair').length === 0,
    'партия（批次）等词内嵌 пар 不误判（无数量+пар 结构）')
}

// ---------- шт（只） ----------
{
  const p = P('Подушки 50x70 2шт Queen Страйп силиконизированное волокно гипоаллергенные')
  assert(p.primary && p.primary.unit === 'шт' && p.primary.qty === 2,
    'Подушки 50x70 2шт → pcs qty=2（50x70 尺寸对被排除）')
  assert(p.excluded.some((e) => e.reason === 'dimension' && /50x70/.test(e.raw)), '尺寸对 50x70 记录排除原因')
}
{
  const p = P('Подушка для сна 70х70 см - 2 шт. стеганая микроволокно Лебяжий пух')
  assert(p.primary && p.primary.qty === 2, '70х70 см 尺寸排除后取 2 шт.')
}
{
  const p = P('SOKACHIE Подушка 50х70 см высота 19 см ортопедическая анатомическая для сна взрослых 1 шт.')
  assert(p.primary && p.primary.qty === 1, '两处 см 尺寸排除后取 1 шт.')
}

// ---------- мл / л（容量） ----------
{
  const p = P('VOIS Маска для здоровья волос с кератином и экстрактом имбиря восстанавливающая 350мл')
  assert(p.primary && p.primary.unit === 'мл' && p.primary.value === 350, '350мл（无空格）→ 350ml')
}
{
  const p = P('Маска для объема волос basil & mandarin 200 мл')
  assert(p.primary && p.primary.value === 200, '200 мл（有空格）→ 200ml')
}
{
  const p = P('Маска для волос восстанавливающая профессиональная с коллагеном и кератином 1000 мл')
  assert(p.primary && p.primary.value === 1000, '1000 мл → 1000ml')
}
{
  const p = P('Маска для объема волос 1.5 л')
  const vol = pickCandidate(p, 'volume_ml')
  assert(vol && vol.value === 1500, '1.5 л → 1500ml（×1000 折算）')
}

// ---------- 陷阱排除 ----------
{
  const p = P('Garnier Fructis Маска для волос 3в1 Фруктис Superfood Банан питательная для очень сухих волос 390 мл')
  assert(p.primary && p.primary.value === 390 && !p.candidates.some((c) => c.qty === 3),
    '3в1 功能描述排除，取 390 мл')
  assert(p.excluded.some((e) => e.reason === 'feature-n-in-1' && /3в1/.test(e.raw)), '3в1 记录排除原因')
}
{
  const p = P('Спрей-термозащита для волос уход несмываемый 17 в 1 250 мл')
  assert(p.primary && p.primary.value === 250 && !p.candidates.some((c) => c.qty === 17),
    '17 в 1（空格变体）排除，取 250 мл')
}
{
  const p = P('Фен-стайлер с вращением для волос HBI1418 8 насадок кейс')
  assert(p.candidates.length === 0, 'HBI1418 型号 + 8 насадок 附件数 → 无候选')
  assert(p.excluded.some((e) => e.reason === 'model-number' && /HBI1418/.test(e.raw)), 'HBI1418 记录排除原因')
  assert(p.excluded.some((e) => e.reason === 'feature-count' && /8 насадок/.test(e.raw)), '8 насадок 记录排除原因')
}
{
  const p = P('Фен для волос профессиональный мощный с насадками 5в1')
  assert(p.candidates.length === 0, 'фен 5в1 → 无数量候选（等待单数推断层处理）')
}
{
  const p = P('Фен Pocket High-speed AHD51 Titanium Gold')
  assert(p.candidates.length === 0 && p.excluded.some((e) => /AHD51/.test(e.raw)), 'AHD51 型号排除')
}
{
  const p = P('booster воздуходувка для автомобиля беспроводной TF64')
  assert(p.candidates.length === 0 && p.excluded.some((e) => /TF64/.test(e.raw)), 'TF64 型号排除')
}
{
  const p = P('Подушка ортопедическая для сна Просто Подушка №8 мягкая 60х40х13 см')
  assert(p.candidates.length === 0, '№8 编号 + 60х40х13 三围 → 无候选')
  assert(p.excluded.some((e) => e.reason === 'ordinal-number' && /№8/.test(e.raw)), '№8 记录排除原因')
  assert(p.excluded.some((e) => e.reason === 'dimension' && /60х40х13/.test(e.raw)), '三围记录排除原因')
}
{
  const p = P('IQ DREAM Ортопедическая подушка 40x60см высота 13.00 см')
  assert(p.candidates.length === 0, '40x60см + высота 13.00 см → 无候选')
}
{
  const p = P('Подушка MemorySleep S Grand Big размер 60*40 см высота 15/17 см Анатомическая')
  assert(p.candidates.length === 0, '60*40（*分隔）+ 15/17 см（斜杠双高度）→ 无候选')
  assert(p.excluded.some((e) => e.reason === 'dimension-slash'), '斜杠尺寸记录排除原因')
}
{
  const p = P('MIXIT Набор шампунь для волос женский и бальзам маска для волос RESTART 2.0 Keratin')
  assert(p.candidates.length === 0 && p.excluded.some((e) => e.reason === 'version-number'),
    'RESTART 2.0 版本号排除（裸小数不接单位）')
}
{
  const p = P('OIL PREMIUM Спрей для ухода за волосами 15 масел легкое расчесывание')
  assert(p.candidates.length === 0 && p.excluded.some((e) => /15 масел/.test(e.raw)),
    '15 масел（15种油）功能描述排除')
}
{
  const p = P('KAARAL Многофункциональная маска-спрей AAA MULTI 20 в 1 для ухода за волосами 150 мл')
  assert(p.primary && p.primary.value === 150 && !p.candidates.some((c) => c.qty === 20),
    '20 в 1 排除后取 150 мл')
}

// ---------- 中文单位 ----------
{
  const p = P('一次性手套 100只 装食品级')
  assert(p.primary && p.primary.basis === 'pcs' && p.primary.qty === 100, '100只 → pcs qty=100')
}
{
  const p = P('家用橡胶手套 50双装')
  assert(p.primary && p.primary.basis === 'pair' && p.primary.value === 100, '50双 → 100 只')
}
{
  const p = P('发膜 500毫升 装')
  assert(p.primary && p.primary.basis === 'volume_ml' && p.primary.value === 500, '500毫升 → 500ml')
}

// ---------- 边界 ----------
{
  const p = P('')
  assert(p.candidates.length === 0 && p.primary === null, '空标题 → 无候选')
}
{
  const p = P('Подушка ортопедическая')
  assert(p.candidates.length === 0, '纯文字无数字 → 无候选')
}

console.log(`\n===== 测试结果: ${pass} 通过 / ${fail} 失败 =====\n`)
if (fail > 0) process.exit(1)
