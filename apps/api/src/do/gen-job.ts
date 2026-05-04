import { DurableObject } from 'cloudflare:workers';
import type { ApiBindings } from '../app.js';

// GenJob DO — one instance per GenJob (id == genJobId).
// Responsibilities (tech-design §5.4):
//   1. Hold fan-out state for the 9-image generation: per-card status, partial results.
//   2. Receive completion notifications from the queue consumer Worker.
//   3. Multiplex card_image_done events → SSE clients watching the editor.
//
// M1 phase 0/1 status: SKELETON. The methods return 501 until the queue consumer + image
// service land. Per memory: gpt-image-2 ≈ 4min/image, 3-way concurrency, ~12min total —
// SSE progress here is critical UX.
export class GenJob extends DurableObject<ApiBindings> {
  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/sse' && req.method === 'GET') {
      return this.openSse();
    }

    if (url.pathname === '/notify' && req.method === 'POST') {
      // Called by queue consumer when a single card image completes.
      // TODO: persist progress, broadcast SSE event card_image_done.
      return new Response('not implemented', { status: 501 });
    }

    if (url.pathname === '/status' && req.method === 'GET') {
      // TODO: return aggregate status: { done: [0,1,3], pending: [2,4..8], failed: [] }
      return new Response('not implemented', { status: 501 });
    }

    return new Response('not found', { status: 404 });
  }

  private openSse(): Response {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    void writer.write(new TextEncoder().encode(`event: hello\ndata: gen-job\n\n`));

    return new Response(readable, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  }
}
