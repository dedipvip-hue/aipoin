
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

    // AI POST /api/ping
    if (request.method === 'POST' && url.pathname === '/api/ping') {
      try {
        const body = await request.json() as { selectedModel?: string };
        let apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
           const obj = await env.VPSAI_BUCKET.get('gemini_api_key');
           if (obj) apiKey = await obj.text();
        }

        if (!apiKey) {
          return new Response(JSON.stringify({ error: "API Key not found in R2." }), { status: 401, headers: { 'Content-Type': 'application/json' }});
        }
        
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
           model: body.selectedModel || 'gemini-3.1-flash-lite-preview',
           contents: "Test connection ping. Reply simply with 'OK'."
        });
        return new Response(JSON.stringify({ status: "success" }), { headers: { 'Content-Type': 'application/json' }});
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
      }
    }

    // AI POST /api/region
    if (request.method === 'POST' && url.pathname === '/api/region') {
      try {
        const body = await request.json() as { provinceName: string, selectedModel: string, mapMode?: string };
        const { provinceName, selectedModel, mapMode = 'SEKOLAH' } = body;
        
        let apiKey = env.GEMINI_API_KEY;
        console.log("Checking API key in env:", !!apiKey);
        if (!apiKey) {
           console.log("Checking API key in R2 bucket 'vpsai'...");
           try {
             const obj = await env.VPSAI_BUCKET.get('gemini_api_key');
             if (obj) {
               apiKey = await obj.text();
               console.log("Found key in R2! Key length:", apiKey?.length);
             } else {
               console.log("No key found in R2 bucket.");
             }
           } catch (e) {
             console.error("Error fetching from R2:", e);
           }
        }
        
        if (!apiKey) {
          console.error("API Key not found in environment or R2.");
          return new Response(JSON.stringify({ error: "API Key not found. Please check Cloudflare Worker Logs for details." }), { status: 401, headers: { 'Content-Type': 'application/json' }});
        }
        
        const ai = new GoogleGenAI({ apiKey });
        
        let specificInstruction = "";
        if (mapMode === 'SEKOLAH') {
          specificInstruction = `Fokus pada statistik jumlah sekolah (SD, SMP, SMA, SMK, dll), kualitas pendidikan, dan distribusi jumlah sekolah di berbagai tingkatan.`;
        } else if (mapMode === 'KOTA') {
          specificInstruction = `Fokus pada jumlah kota administrasi/otonom, nama kota terbesar, tingkat urbanisasi, dan karakteristik khusus perkotaannya.`;
        } else if (mapMode === 'KABUPATEN') {
          specificInstruction = `Fokus pada jumlah kabupaten, luas cakupan kabupaten, distribusi wilayah, dan potensi sumber daya dari berbagai kabupaten.`;
        } else if (mapMode === 'KECAMATAN') {
          specificInstruction = `Fokus pada jumlah total kecamatan, tantangan administratif wilayah, kepadatan kecamatan, atau persebaran pemukiman di kecamatan.`;
        } else {
          specificInstruction = `Fokus pada kondisi SDM, demografi umum, dan kebijakan makro.`;
        }

        const prompt = `Analisis provinsi "${provinceName}" di Indonesia. ${specificInstruction}
      Kembalikan data HANYA dalam format JSON valid yang berisi persis struktur berikut:
      {
        "title": "Nama Provinsi",
        "stats": [
          { "label": "Nama Stat 1 (cth: Total Sekolah / Total Kota / dll)", "value": "Angka/Nilai" },
          { "label": "Nama Stat 2", "value": "Angka/Nilai" },
          { "label": "Nama Stat 3", "value": "Angka/Nilai" },
          { "label": "Nama Stat 4", "value": "Angka/Nilai" }
        ],
        "listTitle": "Judul daftar (cth: Kota Terbesar, Prioritas Pendidikan, dll)",
        "listItems": ["Poin 1 detail...", "Poin 2 detail...", "Poin 3 detail..."],
        "summary": "Ringkasan deskriptif terkait fokus analisis di atas (1-2 paragraf pendek)."
      }`;
        
        const result = await ai.models.generateContent({
           model: selectedModel || 'gemini-3.1-flash-lite-preview',
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
        const body = await request.json() as { userText: string, selectedRegion: string, selectedModel: string };
        const { userText, selectedRegion, selectedModel } = body;
        
        let apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
           const obj = await env.VPSAI_BUCKET.get('gemini_api_key');
           if (obj) apiKey = await obj.text();
        }

        if (!apiKey) {
          return new Response(JSON.stringify({ error: "API Key not found." }), { status: 401, headers: { 'Content-Type': 'application/json' }});
        }
        
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Kamu adalah asisten cerdas yang sangat ramah dan santai, berfungsi dalam Sistem DATA SDM INDONESIA. Pengguna bertanya tentang: "${userText}". 
        Konteks wilayah saat ini: "${selectedRegion || 'Indonesia'}". 
        Gunakan bahasa yang natural, tidak kaku, inspiratif, dan informatif saat menjawab. Hindari gaya bicara robotik. Jika ada data spesifik wilayah, gunakan itu sebagai acuan utama.`;
        
        const result = await ai.models.generateContent({
           model: selectedModel || 'gemini-3.1-flash-lite-preview',
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
