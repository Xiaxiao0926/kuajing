// 优先从项目内 node_modules 加载 localtunnel，回退到全局安装
let localtunnel;
try {
    localtunnel = require('localtunnel');
} catch (e) {
    console.error('未找到 localtunnel 模块。请执行: npm install localtunnel');
    process.exit(1);
}

(async () => {
    try {
        const tunnel = await localtunnel({ port: 8888 });

        console.log('========================================');
        console.log('  坪山优选价格分析 - 公网访问地址');
        console.log('========================================');
        console.log(`  ${tunnel.url}`);
        console.log('========================================');
        console.log('  在WordPress中用iframe嵌入此地址');
        console.log('  按Ctrl+C关闭穿透');
        console.log('========================================');

        tunnel.on('close', () => {
            console.log('穿透已关闭');
        });

        tunnel.on('error', (err) => {
            console.error('穿透错误:', err.message);
        });
    } catch (e) {
        console.error('启动穿透失败:', e.message);
        process.exit(1);
    }
})();
