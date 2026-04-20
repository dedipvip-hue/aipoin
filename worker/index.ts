
import { GoogleGenAI } from "@google/genai";

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  GEMINI_API_KEY: string;
  VPSAI_BUCKET: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // AI POST /api/save-key
    if (request.method === 'POST' && url.pathname === '/api/save-key') {
      try {
        const { apiKey } = await request.json() as { apiKey: string };
        await env.VPSAI_BUCKET.put('gemini_api_key', apiKey);
        return new Response(JSON.stringify({ status: "success" }), { headers: { 'Content-Type': 'application/json' }});
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // AI POST /api/region
    if (request.method === 'POST' && url.pathname === '/api/region') {
      try {
        const body = await request.json() as { provinceName: string };
        const { provinceName } = body;
        
        let apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
           const obj = await env.VPSAI_BUCKET.get('gemini_api_key');
           if (obj) apiKey = await obj.text();
        }
        
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "API Key not found." }), { status: 401, headers: { 'Content-Type': 'application/json' }});
        }
        
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Cari dan analisis data kebijakan pemerintah, anggaran (APBD), dan peraturan terbaru untuk provinsi "${provinceName}" di Indonesia tahun 2024-2025.
        Sumber harus dipercaya. Kembalikan data dalam format JSON yang berisi:
        - province: Nama provinsi
        - budget: Estimasi total APBD terbaru
        - population: Estimasi populasi
        - growth: Pertumbuhan ekonomi
        - policies: Daftar 3-5 kebijakan strategis utama saat ini
        - summary: Ringkasan singkat (1-2 paragraf) tentang fokus pembangunan di wilayah ini.`;
        
        const result = await ai.models.generateContent({
           model: 'gemini-1.5-flash',
           contents: prompt
        });
        const text = result.text || "";
        const cleanJson = text.replace(/```json|```/g, "").trim();
        const data = JSON.parse(cleanJson);
        
        return new Response(JSON.stringify(data), {
           headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // AI POST /api/chat
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await request.json() as { userText: string, selectedRegion: string };
        const { userText, selectedRegion } = body;
        
        let apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
           const obj = await env.VPSAI_BUCKET.get('gemini_api_key');
           if (obj) apiKey = await obj.text();
        }

        if (!apiKey) {
          return new Response(JSON.stringify({ error: "API Key not found." }), { status: 401, headers: { 'Content-Type': 'application/json' }});
        }
        
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Kamu adalah asisten ahli DATA SDM INDONESIA. Pengguna bertanya tentang: "${userText}" 
        terkait wilayah "${selectedRegion || 'Indonesia'}". Berikan jawaban yang akurat berdasarkan data kebijakan publik dan SDM terbaru.`;
        
        const result = await ai.models.generateContent({
           model: 'gemini-1.5-flash',
           contents: prompt
        });
        return new Response(JSON.stringify({ text: result.text || "" }), {
           headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // Serve static assets from the "dist" directory (via env.ASSETS)
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
