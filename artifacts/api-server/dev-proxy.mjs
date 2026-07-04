import http from 'node:http';
import { request as httpsRequest } from 'node:https';

const PORT = Number(process.env.PORT || 8080);
const TARGET_HOST = 'api.ikiss.me';
const UA = 'ikiss-replit-dev-proxy/1.0';

const server = http.createServer((req, res) => {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers['accept-encoding'];
  headers['user-agent'] = UA;
  headers['x-forwarded-host'] = req.headers.host || '';

  const upstream = httpsRequest(
    {
      host: TARGET_HOST,
      port: 443,
      method: req.method,
      path: req.url,
      headers,
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, upRes.headers);
      upRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    console.error('[dev-proxy] upstream error:', err.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('bad gateway: ' + err.message);
  });

  req.pipe(upstream);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ikiss-proxy] listening on :${PORT} → https://${TARGET_HOST}`);
});
