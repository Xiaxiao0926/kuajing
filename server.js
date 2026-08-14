const http = require('http');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { execSync } = require('child_process');
const config = require('./config');

// ========== 数据版本号：每次数据变更时递增 ==========
let dataVersion = Date.now();
function bumpDataVersion() {
    dataVersion = Date.now();
}

const PORT = config.PORT;
const BASE_PATH = config.BASE_PATH;
const MARKET_FOLDER = config.MARKET_FOLDER;
const QUOTE_FOLDER = config.QUOTE_FOLDER;
const OUTPUT_FOLDER = config.OUTPUT_FOLDER;
const CLEANED_FILE = config.CLEANED_FILE;
const RESULT_FILE = config.RESULT_FILE;
const REJECTIONS_FILE = config.REJECTIONS_FILE;

// ========== 拒绝候选记录持久化 ==========
function loadRejections() {
    try {
        if (fs.existsSync(REJECTIONS_FILE)) {
            return JSON.parse(fs.readFileSync(REJECTIONS_FILE, 'utf-8'));
        }
    } catch (e) { console.error('读取拒绝记录失败:', e); }
    return {};
}
function saveRejections(data) {
    try {
        fs.writeFileSync(REJECTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
        bumpDataVersion();
    } catch (e) { console.error('保存拒绝记录失败:', e); }
}

// ========== 拒绝记录仅在rejections.json中维护，前端动态应用 ==========
// 不再修改结果Excel，避免双重处理和数据不一致

// ========== 文件夹监听 + 定时扫描：自动重新清洗和分析 ==========
let isProcessing = false;
let watchDebounceTimer = null;

// 记录已知文件快照，用于定时扫描检测新文件
let knownMarketFiles = new Set();
let knownQuoteFiles = new Set();

function snapshotFiles() {
    knownMarketFiles = new Set();
    knownQuoteFiles = new Set();
    try {
        if (fs.existsSync(MARKET_FOLDER)) {
            fs.readdirSync(MARKET_FOLDER).filter(f => f.endsWith('.csv')).forEach(f => knownMarketFiles.add(f));
        }
    } catch (e) { /* ignore */ }
    try {
        if (fs.existsSync(QUOTE_FOLDER)) {
            fs.readdirSync(QUOTE_FOLDER).filter(f => (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')) && !f.startsWith('~$')).forEach(f => knownQuoteFiles.add(f));
        }
    } catch (e) { /* ignore */ }
}

function runPipeline(reason) {
    if (isProcessing) {
        console.log(`[监听] 正在处理中，跳过本次触发 (${reason})`);
        return;
    }
    isProcessing = true;
    try {
        console.log(`\n[监听] 检测到变化: ${reason}`);
        console.log('[监听] 开始增量清洗市场价数据...');
        execSync('node market_data_processor.js --incremental', { cwd: __dirname, stdio: 'inherit' });
        console.log('[监听] 开始重新分析价格...');
        execSync('node analyze_with_cleaned_data.js', { cwd: __dirname, stdio: 'inherit' });
        console.log('[监听] 数据更新完成！\n');
        // 分析结果已更新，清空旧拒绝记录（新候选可能与旧记录不匹配）
        try {
            if (fs.existsSync(REJECTIONS_FILE)) {
                fs.writeFileSync(REJECTIONS_FILE, '{}', 'utf-8');
                console.log('[监听] 已清空旧拒绝记录');
            }
        } catch (e) { console.error('[监听] 清空拒绝记录失败:', e); }
        bumpDataVersion();
        // 更新文件快照
        snapshotFiles();
    } catch (error) {
        console.error('[监听] 处理失败:', error.message);
    } finally {
        isProcessing = false;
    }
}

function onFileChange(eventType, filename) {
    if (!filename) return;
    // 只关注CSV文件
    if (!filename.endsWith('.csv')) return;
    // 防抖：3秒内多次变更只执行一次
    if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
    watchDebounceTimer = setTimeout(() => {
        runPipeline(`市场价文件变更: ${filename}`);
    }, 3000);
}

// 监听市场价文件夹
if (fs.existsSync(MARKET_FOLDER)) {
    fs.watch(MARKET_FOLDER, onFileChange);
    console.log(`[监听] 已启动市场价文件夹监听: ${MARKET_FOLDER}`);
} else {
    console.warn(`[监听] 市场价文件夹不存在: ${MARKET_FOLDER}`);
}

// 监听供应商报价表文件夹
if (fs.existsSync(QUOTE_FOLDER)) {
    fs.watch(QUOTE_FOLDER, (eventType, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls') && !filename.endsWith('.csv')) return;
        if (filename.startsWith('~$')) return;
        if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
        watchDebounceTimer = setTimeout(() => {
            runPipeline(`供应商报价表变更: ${filename}`);
        }, 3000);
    });
    console.log(`[监听] 已启动供应商报价文件夹监听: ${QUOTE_FOLDER}`);
} else {
    console.warn(`[监听] 供应商报价文件夹不存在: ${QUOTE_FOLDER}`);
}

// ========== 定时扫描：检测fs.watch可能遗漏的新文件 ==========
const SCAN_INTERVAL = 5 * 60 * 1000; // 每5分钟扫描一次

function scanForNewFiles() {
    const newFiles = [];

    // 扫描市场价文件夹
    try {
        if (fs.existsSync(MARKET_FOLDER)) {
            const currentFiles = fs.readdirSync(MARKET_FOLDER).filter(f => f.endsWith('.csv'));
            for (const f of currentFiles) {
                if (!knownMarketFiles.has(f)) {
                    newFiles.push(`市场价/${f}`);
                }
            }
        }
    } catch (e) { /* ignore */ }

    // 扫描报价表文件夹
    try {
        if (fs.existsSync(QUOTE_FOLDER)) {
            const currentFiles = fs.readdirSync(QUOTE_FOLDER).filter(f => (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')) && !f.startsWith('~$'));
            for (const f of currentFiles) {
                if (!knownQuoteFiles.has(f)) {
                    newFiles.push(`报价表/${f}`);
                }
            }
        }
    } catch (e) { /* ignore */ }

    if (newFiles.length > 0) {
        console.log(`[定时扫描] 发现新文件: ${newFiles.join(', ')}`);
        runPipeline(`定时扫描发现新文件: ${newFiles.join(', ')}`);
    }
}

// 初始化文件快照
snapshotFiles();
setInterval(scanForNewFiles, SCAN_INTERVAL);
console.log(`[定时扫描] 已启动，每${SCAN_INTERVAL / 60000}分钟扫描一次新文件`);

function loadCleanedMarketData() {
    try {
        if (!fs.existsSync(CLEANED_FILE)) return [];
        const workbook = xlsx.readFile(CLEANED_FILE);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(worksheet);
        return data.map(row => ({
            source_file: row['来源文件'] || '',
            title: row['标题'] || '',
            price: row['价格'],
            spec: row['规格'] || '',
            shop: row['店铺'] || '',
            link: row['链接'] || '',
            brand: row['品牌'] || '',
            product_type: row['产品类型'] || '',
            capacity: row['容量'] || '',
            series: row['系列'] || '',
            quantity: row['数量'] || '',
            original_title: row['原始标题'] || '',
            product_name: row['产品名'] || '',
            description: row['描述'] || '',
            source_platform: row['数据来源'] || '',
            is_ad: row['是否广告'] === '是',
            gray_price: row['划线价'] || 0
        }));
    } catch (error) {
        console.error('加载清洗数据错误:', error.message);
        return [];
    }
}

function readAnalysisResults() {
    try {
        if (!fs.existsSync(RESULT_FILE)) return [];
        const workbook = xlsx.readFile(RESULT_FILE);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        return xlsx.utils.sheet_to_json(worksheet);
    } catch (error) {
        console.error('加载分析结果错误:', error.message);
        return [];
    }
}

function serveStaticFile(res, filePath, contentType) {
    if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(fs.readFileSync(filePath), 'utf-8');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
    }
}

function parseUrl(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return { pathname: url.pathname, query: Object.fromEntries(url.searchParams) };
}

const server = http.createServer((req, res) => {
    const { pathname, query } = parseUrl(req);

    if (pathname === '/') {
        serveStaticFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html; charset=utf-8');
    }
    else if (pathname === '/api/data-version') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ version: dataVersion }), 'utf-8');
    }
    else if (pathname === '/api/summary') {
        const results = readAnalysisResults();
        const marketData = loadCleanedMarketData();
        const total = results.length;
        const matchedCount = results.filter(r => r['状态'] === '已匹配').length;
        const unmatchedCount = results.filter(r => r['状态'] === '未匹配').length;
        const reviewCount = results.filter(r => r['状态'] === '需要人工复核').length;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            total, matchedCount, unmatchedCount, reviewCount,
            marketDataCount: marketData.length,
            updateTime: new Date().toLocaleString('zh-CN')
        }), 'utf-8');
    }
    else if (pathname === '/api/results') {
        const results = readAnalysisResults();
        const formattedResults = results.map(row => {
            const candidates = [];
            for (let i = 1; i <= 10; i++) {
                const title = row[`候选${i}标题`];
                if (title) {
                    candidates.push({
                        title: title,
                        original_title: row[`候选${i}原始标题`] || title,
                        price: row[`候选${i}价格`],
                        spec: row[`候选${i}规格`] || '',
                        shop: row[`候选${i}店铺`] || '',
                        link: row[`候选${i}链接`] || '',
                        similarity: row[`候选${i}匹配度`] || '',
                        isSet: row[`候选${i}是否套装`] === '是',
                        needsReview: row[`候选${i}需复核`] === '是'
                    });
                }
            }

            let priceAdvantage = row['价格优势'] || '';
            let recommendedPriceAdvantage = row['价格优势(推荐价vs市场价)'] || '';
            let hasAdvantage = recommendedPriceAdvantage.includes('成本价低于市场参考价') || priceAdvantage.includes('低于市场');

            return {
                status: row['状态'] || '',
                category: row['品类'] || '',
                brand: row['品牌'] || '',
                queryName: row['查询名称'] || '',
                supplierPrice: row['供应商价格'],
                youzanCostPrice: row['有赞成本价'],
                suggestedRetailPrice: row['推荐售价'],
                priceType: row['价格口径'] || '',
                priceAdvantage: priceAdvantage,
                recommendedPriceAdvantage: row['价格优势(推荐价vs市场价)'] || '',
                hasAdvantage: hasAdvantage,
                marketCount: row['市场抓取报价数量'] || 0,
                minPrice: row['参考价'],
                minPriceItem: row['参考价标题'] ? {
                    title: row['参考价标题'],
                    price: row['参考价'],
                    shop: row['参考价店铺'] || '',
                    link: row['参考价链接'] || ''
                } : null,
                candidates: candidates,
                sourceFile: row['来源文件'] || '',
                reviewReasons: (row['复核原因'] || '').split('; ').filter(Boolean)
            };
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(formattedResults), 'utf-8');
    }
    else if (pathname === '/api/cleaned') {
        const marketData = loadCleanedMarketData();
        const page = parseInt(query.page) || 1;
        const pageSize = parseInt(query.pageSize) || 50;
        const brand = query.brand || '';
        const type = query.type || '';
        const search = (query.search || '').toLowerCase();
        const minPrice = parseFloat(query.minPrice) || 0;
        const maxPrice = parseFloat(query.maxPrice) || Infinity;

        let filtered = marketData;
        if (brand) filtered = filtered.filter(item => item.brand === brand);
        if (type) filtered = filtered.filter(item => item.product_type && item.product_type.includes(type));
        if (search) filtered = filtered.filter(item => item.title.toLowerCase().includes(search) || (item.original_title || '').toLowerCase().includes(search));
        if (minPrice > 0) filtered = filtered.filter(item => item.price >= minPrice);
        if (maxPrice < Infinity) filtered = filtered.filter(item => item.price <= maxPrice);

        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const pageData = filtered.slice(start, start + pageSize);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ total, page, pageSize, data: pageData }), 'utf-8');
    }
    else if (pathname === '/api/cleaned-summary') {
        const marketData = loadCleanedMarketData();
        const brandCount = {};
        const typeCount = {};
        const fileCount = {};
        const seriesCount = {};

        marketData.forEach(item => {
            if (item.brand) brandCount[item.brand] = (brandCount[item.brand] || 0) + 1;
            if (item.product_type) {
                item.product_type.split('|').forEach(t => {
                    if (t) typeCount[t] = (typeCount[t] || 0) + 1;
                });
            }
            if (item.source_file) fileCount[item.source_file] = (fileCount[item.source_file] || 0) + 1;
            if (item.series) seriesCount[item.series] = (seriesCount[item.series] || 0) + 1;
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            total: marketData.length,
            brandCount, typeCount, fileCount, seriesCount,
            updateTime: new Date().toLocaleString('zh-CN')
        }), 'utf-8');
    }
    else if (pathname === '/api/rejections' && req.method === 'GET') {
        const rejections = loadRejections();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(rejections), 'utf-8');
    }
    else if (pathname === '/api/reject-candidate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { queryName, candidateTitle, candidatePrice, candidateShop } = JSON.parse(body);
                if (!queryName || !candidateTitle) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '缺少参数' }));
                    return;
                }
                const rejections = loadRejections();
                const key = queryName;
                if (!rejections[key]) rejections[key] = [];
                // 避免重复添加（价格用数值比较，避免类型不一致）
                const exists = rejections[key].some(r => r.title === candidateTitle && Number(r.price) === Number(candidatePrice) && r.shop === candidateShop);
                if (!exists) {
                    rejections[key].push({ title: candidateTitle, price: candidatePrice, shop: candidateShop, rejectedAt: new Date().toISOString() });
                    saveRejections(rejections);
                }
                // 拒绝记录已保存到rejections.json，前端会动态应用
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true }), 'utf-8');
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    }
    else if (pathname === '/api/restore-candidate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { queryName, candidateTitle, candidatePrice, candidateShop } = JSON.parse(body);
                if (!queryName) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '缺少参数' }));
                    return;
                }
                const rejections = loadRejections();
                const key = queryName;
                if (rejections[key]) {
                    rejections[key] = rejections[key].filter(r => !(r.title === candidateTitle && Number(r.price) === Number(candidatePrice) && r.shop === candidateShop));
                    if (rejections[key].length === 0) delete rejections[key];
                    saveRejections(rejections);
                }
                // 拒绝记录已保存到rejections.json，前端会动态应用
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true }), 'utf-8');
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    }
    else if (pathname === '/api/export-filtered' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { data } = JSON.parse(body);
                if (!data || !data.length) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '无数据' }));
                    return;
                }
                const headers = ['状态', '品类', '品牌', '查询名称', '供应商价格', '有赞成本价', '推荐售价', '价格口径', '价格优势(推荐价vs市场价)', '市场抓取报价数量', '参考价', '参考价标题', '参考价店铺', '参考价链接'];
                const wsData = [headers];
                data.forEach(row => {
                    wsData.push([
                        row.status, row.category, row.brand, row.queryName,
                        row.supplierPrice, row.youzanCostPrice, row.suggestedRetailPrice, row.priceType,
                        row.priceAdvantage, row.marketCount, row.minPrice,
                        row.minPriceTitle, row.minPriceShop, row.minPriceLink
                    ]);
                });
                const wb = xlsx.utils.book_new();
                const ws = xlsx.utils.aoa_to_sheet(wsData);
                ws['!cols'] = [{wch:10},{wch:8},{wch:12},{wch:30},{wch:12},{wch:12},{wch:10},{wch:25},{wch:12},{wch:10},{wch:35},{wch:15},{wch:40}];
                xlsx.utils.book_append_sheet(wb, ws, '价格分析');
                const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
                res.writeHead(200, {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': 'attachment; filename=' + encodeURIComponent('价格优势分析结果_筛选.xlsx')
                });
                res.end(buf);
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    }
    else if (pathname === '/api/export') {
        try {
            if (!fs.existsSync(RESULT_FILE)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '文件不存在' }));
                return;
            }
            const fileBuffer = fs.readFileSync(RESULT_FILE);
            res.writeHead(200, {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename=' + encodeURIComponent('价格优势分析结果.xlsx')
            });
            res.end(fileBuffer);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }
    else if (pathname.startsWith('/public/') || pathname.endsWith('.js') || pathname.endsWith('.css')) {
        const filePath = path.join(__dirname, pathname);
        const ext = path.extname(filePath);
        const contentTypes = {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html'
        };
        serveStaticFile(res, filePath, (contentTypes[ext] || 'text/plain') + '; charset=utf-8');
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    // 拒绝记录由前端动态应用，无需启动同步
    const rejections = loadRejections();
    const keys = Object.keys(rejections);
    if (keys.length > 0) {
        console.log(`[启动] 已加载${keys.length}条拒绝记录，前端将动态应用`);
    }
    console.log(`服务器已启动: http://localhost:${PORT}`);
});
