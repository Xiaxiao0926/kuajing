#!/usr/bin/env node
/**
 * 跨平台 Python 测试启动器（AI 维护约定：不要在 AGENTS/RUNBOOK 中直接调用 python 命令）
 *
 * 探测顺序：
 *   Windows: py -3
 *   Linux/macOS: python3
 *   通用回退: python
 *
 * 用法（由 npm scripts 调用）：
 *   node scripts/run-wb-py-test.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const WB_DIR = path.join(__dirname, '..', 'ozon-product-analyzer');

const CANDIDATES = [
    { cmd: 'py', args: ['-3'] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
];

function tryRun(cmd, args) {
    const probe = spawnSync(cmd, [...args, '--version'], {
        cwd: WB_DIR,
        stdio: 'ignore',
        shell: process.platform === 'win32',
    });
    return probe.status === 0;
}

let selected = null;
for (const c of CANDIDATES) {
    if (tryRun(c.cmd, c.args)) {
        selected = c;
        break;
    }
}

if (!selected) {
    console.error('[test:python] 未找到可用的 Python 解释器（已尝试 py -3 / python3 / python）。');
    console.error('[test:python] 请安装 Python 3.10+ 并加入 PATH。');
    process.exit(1);
}

console.log(`[test:python] 使用解释器: ${selected.cmd} ${selected.args.join(' ')}`);
const result = spawnSync(selected.cmd, [...selected.args, 'wb_test.py'], {
    cwd: WB_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

process.exit(result.status === null ? 1 : result.status);
