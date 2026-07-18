import { createServer } from 'node:http';

const maxBodyBytes = 1024 * 1024;
const maxRequests = 100;
const port = Number(process.env.DELIVERY_SINK_PORT ?? 8080);
const requests = [];

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://delivery-sink.local');

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/requests') {
    sendJson(response, 200, { requests });
    return;
  }

  if (request.method === 'DELETE' && url.pathname === '/requests') {
    requests.length = 0;
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 404, { error: 'not-found' });
    return;
  }

  const chunks = [];
  let bodyBytes = 0;
  let bodyTooLarge = false;

  request.on('data', (chunk) => {
    bodyBytes += chunk.length;

    if (bodyBytes > maxBodyBytes) {
      bodyTooLarge = true;
      return;
    }

    chunks.push(chunk);
  });

  request.on('end', () => {
    if (bodyTooLarge) {
      sendJson(response, 413, { error: 'body-too-large' });
      return;
    }

    requests.push({
      body: Buffer.concat(chunks).toString('utf8'),
      eventId: request.headers['x-orz-event-id'] ?? null,
      method: request.method,
      path: url.pathname,
      signature: request.headers['x-orz-signature'] ?? null,
      timestamp: request.headers['x-orz-timestamp'] ?? null,
    });
    requests.splice(0, Math.max(0, requests.length - maxRequests));

    const requestedStatus = Number(url.searchParams.get('status') ?? 204);
    const status = requestedStatus >= 200 && requestedStatus <= 599 ? requestedStatus : 400;
    const requestedDelay = Number(url.searchParams.get('delayMs') ?? 0);
    const delay = Number.isFinite(requestedDelay)
      ? Math.min(Math.max(requestedDelay, 0), 5000)
      : 0;

    setTimeout(() => {
      if (status === 204) {
        response.writeHead(status);
        response.end();
        return;
      }

      sendJson(response, status, { received: true, status });
    }, delay);
  });
});

server.listen(port, '0.0.0.0');

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
