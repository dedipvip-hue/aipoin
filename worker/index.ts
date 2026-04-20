
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  GEMINI_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // If it's an API request, we could handle it here
    // For now, it's a SPA, so we just serve assets
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: "API not implemented in worker yet" }), {
        status: 501,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Serve static assets from the "dist" directory (via env.ASSETS)
    // If the request doesn't match a manifest file, Cloudflare will return 404 or we can handle SPA fallback
    try {
      const response = await env.ASSETS.fetch(request);
      
      // SPA fallback: If asset not found, serve index.html
      if (response.status === 404 && !url.pathname.includes('.')) {
        return await env.ASSETS.fetch(new Request(new URL('/', request.url)));
      }
      
      return response;
    } catch (e) {
      return new Response("Asset serving failed", { status: 500 });
    }
  },
};
