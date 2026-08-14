const localtunnel = require('D:/tunnel/node_modules/localtunnel');

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
