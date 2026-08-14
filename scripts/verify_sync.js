#!/usr/bin/env node
/**
 * 双端对拍脚本（T2-4 实现）
 * 当前为占位脚本：config/ 唯一事实源尚未建立。
 * 实现后：读 config/*.json → 分别喂 React 引擎与 Python wb_calc.py
 * → 对同一组边界用例输出 diff，零差异才通过。
 */
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');

if (!fs.existsSync(CONFIG_DIR)) {
    console.log('[test:sync] SKIP — config/ 唯一事实源尚未建立（T2-1 任务）。无对拍对象。');
    process.exit(0);
}

console.log('[test:sync] TODO — 配置层存在但对拍逻辑将在 T2-4 实现。');
process.exit(0);
