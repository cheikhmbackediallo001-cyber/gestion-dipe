// Serveur local de développement (node server.js) : sert les fichiers statiques du projet.
// Sécurisé : accès limité au dossier du projet, fichiers sensibles bloqués, en-têtes de sécurité.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Seules ces extensions sont servies ; tout le reste (.env, .sql, .git, server.js...) est refusé
const ALLOWED_EXT = new Set(Object.keys(MIME_TYPES));
const BLOCKED_SEGMENTS = new Set(['.git', '.vercel', 'node_modules', 'sql', 'scratch', 'server.js']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cache-Control': 'no-cache, no-store, must-revalidate'
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, 'Allow': 'GET, HEAD' });
    return res.end();
  }

  let reqUrl;
  try {
    reqUrl = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400, SECURITY_HEADERS);
    return res.end('Requête invalide');
  }
  if (reqUrl === '/') reqUrl = '/index.html';
  if (reqUrl === '/app') reqUrl = '/app.html';
  if (reqUrl === '/verify') reqUrl = '/verify.html';

  const filePath = path.resolve(ROOT, '.' + path.posix.normalize(reqUrl));
  const relative = path.relative(ROOT, filePath);
  const segments = relative.split(path.sep);
  const ext = path.extname(filePath).toLowerCase();

  // Protection contre la traversée de répertoires et l'accès aux fichiers sensibles
  if (relative.startsWith('..') || path.isAbsolute(relative) || reqUrl.includes('\0') ||
      segments.some(s => s.startsWith('.') || BLOCKED_SEGMENTS.has(s)) || !ALLOWED_EXT.has(ext)) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME_TYPES[ext] });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Serveur local actif sur http://localhost:${PORT}`);
});
