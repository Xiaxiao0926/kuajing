/**
 * 坪山优选价格分析 - 公网穿透（可选工具）
 *
 * localtunnel 为可选依赖：未安装时打印指引并正常退出（exit 0），
 * 不影响主服务（server.js 独立运行）。
 * 安装可选依赖：npm install localtunnel
 */
let localtunnel;
try {
    localtunnel = require('localtunnel');
} catch (e) {
    console.log('========================================');
    console.log('  Tunnel feature unavailable.');
    console.log('  Install optional dependency: npm install localtunnel');
    console.log('  (主服务 server.js 不受影响，可直接 npm start)');
    console.log('========================================');
    process.exit(0);
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
