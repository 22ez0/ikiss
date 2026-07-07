import type { IncomingMessage, ServerResponse } from 'node:http';

// Ultra-minimal: just verify the function can be invoked at all
const handler = (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('bot-handler alive');
};

export default handler;
