// Minimal static dev server that mimics Netlify's clean-URL + SPA-fallback behaviour.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8420;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.avif': 'image/avif',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(ROOT, rel);

  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden', 'text/plain');

  // Directory -> index.html ; extensionless -> try .html then /index.html
  const candidates = [];
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    candidates.push(path.join(file, 'index.html'));
  } else if (!path.extname(file)) {
    candidates.push(file + '.html', path.join(file, 'index.html'));
  } else {
    candidates.push(file);
  }

  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return send(res, 200, fs.readFileSync(c), TYPES[path.extname(c)] || 'application/octet-stream');
    }
  }

  // 404 -> serve 404.html (what the site SHOULD do)
  const notFound = path.join(ROOT, '404.html');
  if (fs.existsSync(notFound)) {
    return send(res, 404, fs.readFileSync(notFound), 'text/html; charset=utf-8');
  }
  send(res, 404, 'Not found', 'text/plain');
}).listen(PORT, () => console.log(`zerolines dev server on http://localhost:${PORT}`));
