/**
 * 坪山优选价格分析 - 全局配置
 *
 * 部署到公网服务器时，修改此文件中的路径即可。
 * 也可通过环境变量 BASE_PATH 覆盖。
 */

const path = require('path');

// 优先使用环境变量，否则使用默认路径
const BASE_PATH = process.env.BASE_PATH || 'E:\\Desktop\\坪优报价分析';

module.exports = {
    BASE_PATH,
    MARKET_FOLDER: path.join(BASE_PATH, '市场价'),
    QUOTE_FOLDER: path.join(BASE_PATH, '报价表'),
    OUTPUT_FOLDER: path.join(BASE_PATH, '分析结果'),
    CLEANED_FILE: path.join(BASE_PATH, '分析结果', '清洗后的市场价数据.xlsx'),
    RESULT_FILE: path.join(BASE_PATH, '分析结果', '价格优势分析结果_v2.xlsx'),
    REJECTIONS_FILE: path.join(BASE_PATH, '分析结果', 'rejected_candidates.json'),
    PORT: parseInt(process.env.PORT) || 8888,
};
