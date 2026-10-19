const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const PORT = 5173
const DIST_DIR = path.join(__dirname, 'dist')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split('?')[0])
  let filePath = path.join(DIST_DIR, requestPath)

  // Prevent escaping the dist directory.
  if (!filePath.startsWith(DIST_DIR)) {
    filePath = DIST_DIR
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: any non-file route (e.g. /dashboard/home, /callback,
      // /overlay) is served index.html so react-router can take over.
      fs.readFile(path.join(DIST_DIR, 'index.html'), (fallbackErr, fallbackData) => {
        if (fallbackErr) {
          res.writeHead(500)
          res.end('Could not load Resonance. Did the build finish? Run "npm run build" first.')
          return
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] })
        res.end(fallbackData)
      })
      return
    }

    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
    res.end(data)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Resonance is running at http://127.0.0.1:${PORT}`)
  console.log('Keep this window open while using Resonance. Close it to stop the server.')
})
