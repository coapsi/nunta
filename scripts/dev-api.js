// Server local pentru /api/rpc (doar pentru dezvoltare): PG_LOCAL=1 DATABASE_URL=... node scripts/dev-api.js
import http from 'node:http';
import handler from '../api/rpc.js';

http
  .createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); };
      handler(req, res);
    });
  })
  .listen(3001, () => console.log('api local pe :3001'));
