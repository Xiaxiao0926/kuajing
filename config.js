/**
 * 坪山优选价格分析 - 全局配置
 *
 * 路径解析优先级（三层）：
 *   1. 环境变量 BASE_PATH（部署到新机器时使用）
 *   2. 项目内 data/ 目录（项目内自带数据）
 *   3. Legacy 路径 E:\Desktop\坪优报价分析（默认禁用，需显式启用）
 *
 * 部署用法：
 *   $env:BASE_PATH = "D:\你的数据目录"   # PowerShell
 *   BASE_PATH=/your/data/path             # Linux/macOS
 *
 * 关闭 Legacy 回退（推荐生产环境）：
 *   $env:LEGACY_PATH_ENABLED = "false"
 */

const path = require('path');

const LEGACY_PATH = 'E:\\Desktop\\坪优报价分析';
const LEGACY_PATH_ENABLED = process.env.LEGACY_PATH_ENABLED !== 'false'; // 默认 true，等所有流程验证完再设 false

// 三层优先级：环境变量 → 项目内 data/ → Legacy（若启用）
let BASE_PATH;
if (process.env.BASE_PATH) {
    BASE_PATH = process.env.BASE_PATH;
} else if (process.env.LEGACY_PATH_ENABLED === 'false') {
    // 显式禁用 Legacy 时，使用项目内 data/ 目录
    BASE_PATH = path.join(__dirname, 'data');
} else if (LEGACY_PATH_ENABLED) {
    // 兼容历史：回退到 Legacy 路径
    BASE_PATH = LEGACY_PATH;
} else {
    BASE_PATH = path.join(__dirname, 'data');
}

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
