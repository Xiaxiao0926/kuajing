import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const OZON_DATA_DIR = path.resolve('D:/ozon/市场分析')
const OZON_UPLOADS_DIR = path.resolve('D:/ozon/市场分析/uploads')
const PUBLIC_DATA_DIR = path.resolve('public/data')
const PERSIST_FILE = path.resolve('D:/ozon/市场分析/persisted-data.json')

const DATA_EXTENSIONS = ['.xlsx', '.xls', '.html', '.htm']

function isDataFile(filename) {
  return DATA_EXTENSIONS.some(ext => filename.endsWith(ext)) && !filename.startsWith('~$')
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(isDataFile)
    .map(f => {
      const src = path.join(dir, f)
      const stat = fs.statSync(src)
      const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/)
      return {
        name: f,
        date: dateMatch ? dateMatch[1] : stat.mtime.toISOString().slice(0, 10),
        size: stat.size,
        source: dir === OZON_UPLOADS_DIR ? 'upload' : 'local'
      }
    })
}

function ozonDataSyncPlugin() {
  const syncData = () => {
    if (!fs.existsSync(PUBLIC_DATA_DIR)) {
      fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(OZON_UPLOADS_DIR)) {
      fs.mkdirSync(OZON_UPLOADS_DIR, { recursive: true })
    }

    const rootFiles = scanDir(OZON_DATA_DIR)
    const uploadFiles = scanDir(OZON_UPLOADS_DIR)
    const allFiles = [...rootFiles, ...uploadFiles]
      .sort((a, b) => b.date.localeCompare(a.date))

    const seen = new Set()
    const deduped = allFiles.filter(f => {
      if (seen.has(f.name)) return false
      seen.add(f.name)
      return true
    })

    deduped.forEach(f => {
      const srcDir = f.source === 'upload' ? OZON_UPLOADS_DIR : OZON_DATA_DIR
      const src = path.join(srcDir, f.name)
      const dest = path.join(PUBLIC_DATA_DIR, f.name)
      if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
        fs.copyFileSync(src, dest)
      }
    })

    const manifest = {
      files: deduped.map(({ source, ...rest }) => rest),
      updatedAt: new Date().toISOString()
    }
    fs.writeFileSync(
      path.join(PUBLIC_DATA_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    )
  }

  return {
    name: 'ozon-data-sync',
    buildStart() { syncData() },
    configureServer(server) {
      syncData()

      server.middlewares.use('/api/persist', (req, res, next) => {
        if (req.method === 'GET') {
          try {
            const data = fs.existsSync(PERSIST_FILE)
              ? JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf-8'))
              : {}
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data))
          } catch (err) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({}))
          }
          return
        }

        if (req.method === 'POST') {
          const chunks = []
          req.on('data', chunk => chunks.push(chunk))
          req.on('end', () => {
            try {
              const body = JSON.parse(Buffer.concat(chunks).toString())
              let current = {}
              if (fs.existsSync(PERSIST_FILE)) {
                try { current = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf-8')) } catch {}
              }
              if (body.key && body.value !== undefined) {
                current[body.key] = { value: body.value, updatedAt: Date.now() }
              } else if (typeof body === 'object' && !body.key) {
                Object.entries(body).forEach(([k, v]) => {
                  current[k] = { value: v, updatedAt: Date.now() }
                })
              }
              const dir = path.dirname(PERSIST_FILE)
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
              fs.writeFileSync(PERSIST_FILE, JSON.stringify(current, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (err) {
              console.error('Persist error:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
        }

        next()
      })

      server.middlewares.use('/api/upload', (req, res, next) => {
        if (req.method !== 'POST') { next(); return }

        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
          try {
            const raw = Buffer.concat(chunks)
            const boundary = req.headers['content-type']?.split('boundary=')[1]
            if (!boundary) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'No boundary' }))
              return
            }

            const boundaryBuf = Buffer.from(`--${boundary}`)
            const parts = []
            let start = 0
            while (start < raw.length) {
              const idx = raw.indexOf(boundaryBuf, start)
              if (idx === -1) break
              if (start > 0) parts.push(raw.slice(start, idx - 2))
              start = idx + boundaryBuf.length + 2
            }

            let savedFile = null
            for (const part of parts) {
              const headerEnd = part.indexOf('\r\n\r\n')
              if (headerEnd === -1) continue
              const header = part.slice(0, headerEnd).toString()
              const nameMatch = header.match(/name="([^"]+)"/)
              const filenameMatch = header.match(/filename="([^"]+)"/)
              if (!filenameMatch) continue

              const filename = filenameMatch[1]
              if (!isDataFile(filename)) continue

              const body = part.slice(headerEnd + 4)
              if (!fs.existsSync(OZON_UPLOADS_DIR)) {
                fs.mkdirSync(OZON_UPLOADS_DIR, { recursive: true })
              }
              const dest = path.join(OZON_UPLOADS_DIR, filename)
              fs.writeFileSync(dest, body)
              savedFile = { name: filename, size: body.length }
            }

            syncData()

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, file: savedFile }))
          } catch (err) {
            console.error('Upload error:', err)
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })

      fs.watch(OZON_DATA_DIR, (eventType, filename) => {
        if (filename && isDataFile(filename)) {
          setTimeout(syncData, 500)
        }
      })
      fs.watch(OZON_UPLOADS_DIR, (eventType, filename) => {
        if (filename && isDataFile(filename)) {
          setTimeout(syncData, 500)
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      // 构建前把 config/*.json 同步为 src/generated/*.js（唯一事实源，fail-close）
      // 同步/校验失败必须 throw：禁止拿着 stale generated 配置继续出包。
      name: 'config-sync',
      buildStart() {
        execFileSync('node', [path.resolve(__dirname, '../scripts/sync-config.js')], { stdio: 'inherit' })
      },
      // dev 运行态传播：watch config/*.json → 变化即同步 generated → full-reload。
      // 保证 Python 面板保存 config 后，正在运行的 React dev 立即看到新数值。
      configureServer(server) {
        const configDir = path.resolve(__dirname, '../config')
        let debounceTimer = null
        const syncAndReload = () => {
          try {
            execFileSync('node', [path.resolve(__dirname, '../scripts/sync-config.js')], { stdio: 'inherit' })
            server.ws.send({ type: 'full-reload' })
          } catch (e) {
            // 同步失败：不 reload，config 保持旧值；错误已在 sync-config stderr 输出
            console.error('[config-sync] dev 同步失败，前端继续使用旧 generated:', e.message)
          }
        }
        try {
          execFileSync('node', [path.resolve(__dirname, '../scripts/sync-config.js')], { stdio: 'inherit' })
        } catch (e) {
          console.error('[config-sync] dev 启动同步失败:', e.message)
        }
        fs.watch(configDir, (eventType, filename) => {
          if (!filename || !filename.endsWith('.json')) return
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(syncAndReload, 200)
        })
      },
    },
    ozonDataSyncPlugin(),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/ai': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
