import { DurableObject } from 'cloudflare:workers';
import type { ApiBindings } from '../app.js';

// AgentSession DO — one instance per Project (id derived from projectId).
// Responsibilities (tech-design §5.2):
//   1. Hold the container handle (CF Containers in prod / Docker in dev) for this project's agent.
//   2. Multiplex container ws output → many SSE clients (the user's tabs).
//   3. Resume from sleep when user returns within the 30-min window.
//
// M1 phase 0/1 status: SKELETON. The methods return 501 until the container plumbing lands.
export class AgentSession extends DurableObject<ApiBindings> {
  // SSE clients connected to this session, keyed by an opaque clientId.
  private clients = new Map<string, WritableStreamDefaultWriter<Uint8Array>>();

  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/sse' && req.method === 'GET') {
      return this.openSse();
    }

    if (url.pathname === '/plan' && req.method === 'POST') {
      // TODO: ensure container alive, send {cmd:'plan', topic, skillIds, ...} via ws,
      // fanout container events to all SSE clients.
      return new Response('not implemented', { status: 501 });
    }

    if (url.pathname === '/follow-up' && req.method === 'POST') {
      // TODO: send {cmd:'followUp', ...} to the existing container session.
      return new Response('not implemented', { status: 501 });
    }

    return new Response('not found', { status: 404 });
  }

  private openSse(): Response {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const clientId = crypto.randomUUID();
    this.clients.set(clientId, writer);

    // Greet so the EventSource fires onopen quickly.
    void writer.write(new TextEncoder().encode(`event: hello\ndata: ${clientId}\n\n`));

    // TODO: wire to container ws output — for now this stays open with no events.
    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  }
}
