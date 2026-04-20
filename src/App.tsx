import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Map as MapIcon, 
  Info, 
  Search, 
  FileText, 
  TrendingUp, 
  Users, 
  DollarSign, 
  ArrowRight, 
  ChevronRight, 
  Globe, 
  Shield, 
  LayoutDashboard,
  Loader2,
  Sparkles,
  MessageSquare,
  X,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { GoogleGenAI, Type } from '@google/genai';
import { cn } from './lib/utils';

// --- Constants & Types ---
const GEO_URL = "https://raw.githubusercontent.com/superpikar/indonesia-geojson/master/indonesia.json";

interface RegionalData {
  province: string;
  budget: string;
  population: string;
  growth: string;
  policies: string[];
  summary: string;
}

const INDONESIA_CENTER: [number, number] = [118, -2];

// ... Mock Initial Data ...
const MOCK_REGIONS: Record<string, Partial<RegionalData>> = {
  "Jakarta Raya": {
    budget: "Rp 82.47 Triliun (2024)",
    population: "10.67 Juta",
    growth: "5.1%",
  },
  "Jawa Barat": {
    budget: "Rp 36.1 Triliun",
    population: "49.9 Juta",
    growth: "5.0%",
  },
};

export default function App() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [aiData, setAiData] = useState<RegionalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- AI Setup ---
  const GEMINI_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const ai = useMemo(() => new GoogleGenAI({ apiKey: GEMINI_KEY || 'N/A' }), [GEMINI_KEY]);

  const fetchRegionalInfo = async (provinceName: string) => {
    if (!GEMINI_KEY) return;
    setIsLoading(true);
    setAiData(null);
    setIsSidebarOpen(true);

    try {
      const prompt = `Cari dan analisis data kebijakan pemerintah, anggaran (APBD), dan peraturan terbaru untuk provinsi "${provinceName}" di Indonesia tahun 2024-2025.
      Sumber harus dipercaya. Kembalikan data dalam format JSON yang berisi:
      - province: Nama provinsi
      - budget: Estimasi total APBD terbaru
      - population: Estimasi populasi
      - growth: Pertumbuhan ekonomi
      - policies: Daftar 3-5 kebijakan strategis utama saat ini
      - summary: Ringkasan singkat (1-2 paragraf) tentang fokus pembangunan di wilayah ini.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              province: { type: Type.STRING },
              budget: { type: Type.STRING },
              population: { type: Type.STRING },
              growth: { type: Type.STRING },
              policies: { type: Type.ARRAY, items: { type: Type.STRING } },
              summary: { type: Type.STRING },
            },
            required: ["province", "budget", "policies", "summary"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      setAiData(result);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !GEMINI_KEY) return;

    const userText = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setIsChatLoading(true);

    try {
      const prompt = `Kamu adalah asisten ahli DATA SDM INDONESIA. Pengguna bertanya tentang: "${userText}" 
      terkait wilayah "${selectedRegion || 'Indonesia'}". Berikan jawaban yang akurat berdasarkan data kebijakan publik dan SDM terbaru.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: prompt,
      });

      setChatHistory(prev => [...prev, { role: 'ai', text: response.text || "Maaf, saya tidak dapat menemukan informasi tersebut." }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Terjadi kesalahan koneksi ke AI." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const onRegionClick = (geoName: string) => {
    setSelectedRegion(geoName);
    fetchRegionalInfo(geoName);
  };

  return (
    <div className="fixed inset-0 flex bg-[#050505] text-zinc-300 font-sans overflow-hidden">
      
      {/* 1. Sidebar - Fixed on the left */}
      <aside className="relative flex-none w-16 md:w-64 border-r border-white/5 bg-zinc-900/90 flex flex-col py-6 px-4 z-[100]">
        <div className="flex items-center gap-3 mb-10 px-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="hidden md:block font-black text-white text-sm uppercase tracking-tighter">DATA SDM ID</span>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem icon={<Globe className="w-4 h-4" />} label="Network Map" active />
          <NavItem icon={<FileText className="w-4 h-4" />} label="Archive" />
          <NavItem icon={<TrendingUp className="w-4 h-4" />} label="Analytics" />
          <NavItem icon={<Shield className="w-4 h-4" />} label="Regulation" />
        </nav>
        
        <div className="mt-auto px-2">
          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400">GEMINI ACTIVE</span>
            </div>
            <p className="hidden md:block text-[8px] text-zinc-500 font-mono tracking-tighter">v4.5.2 Operational</p>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 relative flex flex-col min-w-0 z-10">
        
        {/* Header Stats */}
        <header className="h-16 flex items-center justify-between px-6 bg-zinc-950/80 border-b border-white/5 z-50">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-bold tracking-widest uppercase">Target Region</span>
            <h2 className="text-sm font-bold text-white uppercase italic">{selectedRegion || 'Pilih Wilayah...'}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block p-2 bg-indigo-600/10 border border-indigo-500/20 rounded-lg text-[10px] font-bold text-indigo-400">
              SDM INDEX: 74.39
            </div>
            <button className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* The Map Stage */}
        <div className="flex-1 relative bg-[#050505] z-0">
           {/* Map Interaction Area */}
           <div className="absolute inset-0 w-full h-full">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 1300,
                center: [118, -2]
              }}
              className="w-full h-full"
            >
              <ZoomableGroup center={[118, -2]} zoom={1} maxZoom={8}>
                <Geographies geography={GEO_URL}>
                  {({ geographies, error }) => {
                    if (error) return <text x="118" y="-2" fill="red" fontSize="20" textAnchor="middle">Map Load Error</text>;
                    if (!geographies || geographies.length === 0) return <text x="118" y="-2" fill="#444" textAnchor="middle" className="animate-pulse">Loading Map...</text>;
                    
                    return geographies.map((geo) => {
                      const name = geo.properties.name || geo.properties.NAME_1 || geo.properties.state || geo.properties.PROP || "Unknown";
                      const isSelected = selectedRegion === name;
                      
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => {
                            console.log("Clicked:", name);
                            onRegionClick(name);
                          }}
                          style={{
                            default: {
                              fill: isSelected ? "#6366f1" : "#3f3f46",
                              stroke: "#52525b",
                              strokeWidth: 1,
                              outline: "none"
                            },
                            hover: {
                              fill: "#818cf8",
                              stroke: "#fff",
                              strokeWidth: 2,
                              outline: "none",
                              cursor: "pointer"
                            },
                            pressed: {
                              fill: "#4f46e5",
                              outline: "none"
                            }
                          }}
                        />
                      );
                    });
                  }}
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
           </div>

           {/* Overlay HUD controls */}
           <div className="absolute bottom-6 left-6 z-40 flex flex-col gap-2">
             <MapBtn label="Satellite" />
             <MapBtn label="SDM Map" />
             <MapBtn label="Policy" />
           </div>

           <div className="absolute top-6 right-6 z-40">
            {!isSidebarOpen && selectedRegion && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-600/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-white cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            )}
           </div>
        </div>
      </main>

      {/* 3. AI Side Panel - Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200]"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-zinc-950 border-l border-white/10 z-[210] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-white text-xl tracking-tight">AI Policy Research</h3>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-3 text-zinc-500 hover:text-white transition-colors cursor-pointer">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
                 {isLoading ? (
                   <div className="flex flex-col items-center justify-center py-32 gap-6">
                      <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-mono text-zinc-500 font-black tracking-[0.4em] animate-pulse">ANALYZING REGIONAL STATS...</p>
                   </div>
                 ) : aiData && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="space-y-10"
                   >
                     <section>
                       <div className="flex items-center gap-3 mb-2">
                         <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                         <h2 className="text-4xl font-black text-white tracking-tighter">{aiData.province}</h2>
                       </div>
                       <div className="prose prose-invert prose-sm text-zinc-400 font-medium leading-relaxed italic border-l border-white/10 pl-5 bg-white/5 py-4 rounded-r-2xl">
                         <Markdown>{aiData.summary}</Markdown>
                       </div>
                     </section>

                     <div className="grid grid-cols-3 gap-3">
                       <StatBox label="APBD 24" value={aiData.budget} />
                       <StatBox label="Popul." value={aiData.population} />
                       <StatBox label="Growth" value={aiData.growth} />
                     </div>

                     <section className="space-y-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Shield className="w-3 h-3" /> Targeted Policies
                        </p>
                        <div className="space-y-2">
                          {aiData.policies.map((p, i) => (
                            <div key={i} className="group p-4 bg-zinc-900 border border-white/5 rounded-2xl text-[11px] text-zinc-300 font-bold hover:border-indigo-500/30 transition-all flex items-start gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                              {p}
                            </div>
                          ))}
                        </div>
                     </section>

                     <section className="pt-8 border-t border-white/5 space-y-6">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Discussion Stream</span>
                        </div>
                        <div className="space-y-4">
                           {chatHistory.map((c, i) => (
                             <div key={i} className={cn(
                               "p-4 rounded-2xl text-xs max-w-[90%] font-medium",
                               c.role === 'user' 
                                ? "bg-zinc-900 border border-white/5 ml-auto text-zinc-300" 
                                : "bg-indigo-600/10 border border-indigo-500/20 mr-auto text-white shadow-sm"
                             )}>
                               <Markdown>{c.text}</Markdown>
                             </div>
                           ))}
                        </div>
                        <form onSubmit={handleChatSubmit} className="relative pt-4">
                          <input 
                            type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
                            placeholder="Tanyakan detail spesifik..."
                            className="w-full bg-zinc-900 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
                          />
                        </form>
                     </section>
                   </motion.div>
                 )}
              </div>
              
              <footer className="p-6 border-t border-white/5 bg-zinc-950/80 flex items-center justify-between shrink-0">
                 <div className="flex flex-col">
                   <span className="text-[8px] font-black tracking-widest text-zinc-600 uppercase">Engine Status</span>
                   <span className="text-[10px] font-bold text-white">OP-READY-STREAM</span>
                 </div>
                 <div className="w-10 h-1 bg-white/5 rounded-full" />
              </footer>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper Components ---

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group cursor-pointer",
      active ? "bg-white/5 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
    )}>
      {icon}
      <span className="hidden md:inline">{label}</span>
      {active && <div className="ml-auto w-1 h-1 rounded-full bg-indigo-500" />}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="text-sm font-bold text-white">{value}</span>
    </div>
  );
}

function MapControl({ label }: { label: string }) {
  return (
    <button className="px-3 py-1.5 bg-zinc-900/80 backdrop-blur border border-white/10 rounded-lg text-[10px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all uppercase tracking-wider text-left">
      {label}
    </button>
  );
}

function StatBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-zinc-900 p-3 rounded-xl border border-white/5 border-t-indigo-500/30 border-t-2">
      <p className="text-[8px] text-zinc-500 font-black uppercase tracking-wider">{label}</p>
      <p className="text-[10px] font-black text-white truncate">{value}</p>
    </div>
  );
}

function MapBtn({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={cn(
      "px-4 py-2 border rounded-xl text-[10px] font-black transition-all uppercase tracking-widest shadow-xl cursor-pointer",
      active 
        ? "bg-indigo-600 border-indigo-500 text-white shadow-indigo-600/20" 
        : "bg-zinc-950/95 border-white/10 text-zinc-500 hover:text-white hover:bg-zinc-900"
    )}>
      {label}
    </button>
  );
}

function PolicyItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-4 group bg-white/5 p-3 rounded-2xl border border-white/5">
      <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 group-hover:scale-125 transition-transform" />
      <p className="text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors leading-relaxed font-bold">{text}</p>
    </div>
  );
}
