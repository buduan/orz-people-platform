import { createServer } from 'node:http';
import type { Server } from 'node:http';

export interface WorkerHealthServer {
  close: () => Promise<void>;
  markNotReady: () => void;
  port: number;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function createWorkerHealthServer(port: number): Promise<WorkerHealthServer> {
  let ready = true;
  const server = createServer((request, response) => {
    if (request.url !== '/health/live' && request.url !== '/health/ready') {
      response.writeHead(404).end();
      return;
    }

    const isReadyRequest = request.url === '/health/ready';
    const healthy = !isReadyRequest || ready;
    response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      service: 'orz-people-platform-worker',
      status: healthy ? 'ok' : 'not-ready',
    }));
  });

  await listen(server, port);
  const address = server.address();

  if (address === null || typeof address === 'string') {
    await close(server);
    throw new Error('Worker health server did not bind to a TCP port.');
  }

  return {
    close: () => close(server),
    markNotReady: () => {
      ready = false;
    },
    port: address.port,
  };
}
