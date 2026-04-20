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
  RefreshCw,
  Settings,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { GoogleGenAI, Type } from '@google/genai';
import { cn } from './lib/utils';

// --- Constants & Types ---
const GEO_URL = "https://code.highcharts.com/mapdata/countries/id/id-all.topo.json";

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
  // --- Component State ---
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [aiData, setAiData] = useState<RegionalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Network Map');
  const [mapMode, setMapMode] = useState('SDM MAP');

  // --- Settings & Sidebar Resize ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localApiKey, setLocalApiKey] = useState("");
  const availableModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-3.1-flash-lite-preview'
  ];
  const [selectedModel, setSelectedModel] = useState(availableModels[0]);
  const [sidebarWidth, setSidebarWidth] = useState(256); // 256px
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      setSidebarWidth(Math.max(160, Math.min(e.clientX, 600)));
    };
    const handleMouseUp = () => setIsResizing(false);
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const GEMINI_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const activeApiKey = localApiKey || GEMINI_KEY;
  const ai = useMemo(() => new GoogleGenAI({ apiKey: activeApiKey || 'N/A' }), [activeApiKey]);

  const fetchRegionalInfo = async (provinceName: string) => {
    setIsLoading(true);
    setAiData(null);
    setIsSidebarOpen(true);

    if (!activeApiKey || activeApiKey === 'N/A') {
      console.warn("Gemini API key is not configured.");
      setAiData({
        province: provinceName,
        budget: "Akses Dibatasi",
        population: "Akses Dibatasi",
        growth: "Akses Dibatasi",
        policies: ["Harap atur API Key di Pengaturan (Bawah Kiri)"],
        summary: "Sistem membutuhkan API Key Gemini yang valid untuk beroperasi penuh."
      });
      setIsLoading(false);
      return;
    }

    try {
      const prompt = `Cari dan analisis data kebijakan pemerintah, anggaran (APBD), dan peraturan terbaru untuk provinsi "${provinceName}" di Indonesia.
      Kembalikan data HANYA dalam format JSON valid yang berisi:
      {
        "province": "Nama provinsi",
        "budget": "Estimasi total APBD terbaru",
        "population": "Estimasi populasi",
        "growth": "Pertumbuhan ekonomi",
        "policies": ["Kebijakan 1", "Kebijakan 2", "Kebijakan 3"],
        "summary": "Ringkasan singkat (1-2 paragraf) tentang fokus pembangunan di wilayah ini."
      }`;

      const result = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt
      });
      
      const text = result.text || "";
      const cleanJson = text.replace(/```json|```/g, "").trim();
      const data = JSON.parse(cleanJson);
      
      setAiData(data);
      setChatHistory([{ role: 'ai', text: `Halo! Saya telah menganalisis data untuk **${provinceName}**. Ada kebijakan atau data spesifik lain yang ingin Anda ketahui?` }]);
    } catch (error) {
      console.error("AI Error:", error);
      // Fallback
      setAiData({
        province: provinceName,
        budget: "Data sedang diperbarui",
        population: "Akses terbatas",
        growth: "Stabil",
        policies: ["Pembangunan Infrastruktur", "Digitalisasi Layanan"],
        summary: "Gagal menyambung ke server AI. Memuat data fallback dari memori lokal sementara koneksi pulih."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (!activeApiKey || activeApiKey === 'N/A') {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Mohon atur GEMINI API KEY di Pengaturan (Bawah Kiri) untuk menggunakan asisten AI." }]);
      return;
    }

    const userText = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setIsChatLoading(true);

    try {
      // Allow general conversation but specialized in Indonesia Data if unspecified. Translation explicitly supported.
      const prompt = `Kamu adalah asisten cerdas yang berfungsi dalam Sistem DATA SDM INDONESIA. Pengguna bertanya tentang: "${userText}". 
      Konteks wilayah saat ini: "${selectedRegion || 'Indonesia'}". 
      Tugas utama Anda meriset kebijakan dan SDM, namun jika user meminta terjemahan/hal lain, penuhi dengan akurat.`;

      const result = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt
      });
      
      setChatHistory(prev => [...prev, { role: 'ai', text: result.text || "Saya tidak yakin." }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Terjadi kesalahan koneksi ke backend AI." }]);
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
      
      {/* 1. Sidebar - Resizable on the left */}
      <aside 
        style={{ width: `${sidebarWidth}px` }}
        className="relative flex-none border-r border-white/5 bg-zinc-900/90 flex flex-col py-6 px-4 z-[100] transition-[width] duration-0"
      >
        <div className="flex items-center gap-3 mb-10 px-2 shrink-0 truncate">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-white text-sm uppercase tracking-tighter truncate">DATA SDM ID</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden">
          <NavItem icon={<Globe className="w-5 h-5" />} label="Network Map" active={activeTab === 'Network Map'} onClick={() => setActiveTab('Network Map')} />
          <NavItem icon={<FileText className="w-5 h-5" />} label="Archive" active={activeTab === 'Archive'} onClick={() => setActiveTab('Archive')} />
          <NavItem icon={<TrendingUp className="w-5 h-5" />} label="Analytics" active={activeTab === 'Analytics'} onClick={() => setActiveTab('Analytics')} />
          <NavItem icon={<Shield className="w-5 h-5" />} label="Regulation" active={activeTab === 'Regulation'} onClick={() => setActiveTab('Regulation')} />
        </nav>
        
        <div className="mt-auto px-2 pt-6">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 mb-3 text-zinc-400 hover:text-white transition-colors w-full cursor-pointer hover:bg-white/5 p-2 rounded-lg"
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-widest truncate">Pengaturan AI</span>
          </button>
          
          <div className="p-3 bg-white/5 rounded-xl border border-white/5 truncate">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[9px] font-bold text-emerald-400 truncate tracking-widest uppercase">GEMINI: {selectedModel.split('-')[1]}</span>
            </div>
            <p className="text-[8px] text-zinc-500 font-mono tracking-tighter truncate">v4.5.2 Operational</p>
          </div>
        </div>
        
        {/* Resize Handle */}
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-50 group"
        >
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-8 flex flex-col justify-between">
              <div className="w-0.5 h-1 bg-white/50 rounded-full" />
              <div className="w-0.5 h-1 bg-white/50 rounded-full" />
              <div className="w-0.5 h-1 bg-white/50 rounded-full" />
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
                scale: 1200,
                center: [118, -2]
              }}
              className="w-full h-full pointer-events-auto"
            >
              <ZoomableGroup 
                center={[118, -2]} 
                zoom={1} 
                maxZoom={8}
                onMoveStart={(e) => {
                   // Ensure clicks still work by checking if it's a drag
                }}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies, error }) => {
                    if (error) return <text x="50%" y="50%" fill="red" fontSize="20" textAnchor="middle">Map Load Error</text>;
                    if (!geographies || geographies.length === 0) return <text x="50%" y="50%" fill="#fff" fontSize="20" textAnchor="middle" className="animate-pulse">Loading Map...</text>;
                    
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
             <MapBtn label="Satellite" active={mapMode === 'SATELLITE'} onClick={() => setMapMode('SATELLITE')} />
             <MapBtn label="SDM Map" active={mapMode === 'SDM MAP'} onClick={() => setMapMode('SDM MAP')} />
             <MapBtn label="Policy" active={mapMode === 'POLICY'} onClick={() => setMapMode('POLICY')} />
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

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setIsSettingsOpen(false)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-md bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden"
             >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white uppercase tracking-widest">AI Settings</h3>
                  <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/10"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      Gemini API Key
                    </label>
                    <input 
                      type="password"
                      placeholder={GEMINI_KEY && GEMINI_KEY !== 'N/A' ? "Using preset VITE_GEMINI_API_KEY" : "Enter your AI Studio API Key..."}
                      value={localApiKey}
                      onChange={(e) => setLocalApiKey(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                    />
                    <p className="text-[10px] text-zinc-500">Leave blank to use environment variable default.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      AI Generation Model
                    </label>
                    <div className="relative">
                      <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                      >
                        {availableModels.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronRight className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none rotate-90" />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-950/50 border-t border-white/5 flex justify-end">
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                  >
                    Simpan
                  </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// --- Helper Components ---

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all group cursor-pointer",
      active ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
    )}>
      <div className={cn("shrink-0", active ? "text-indigo-400" : "")}>{icon}</div>
      <span className="truncate">{label}</span>
      {active && <div className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
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

function MapBtn({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
      "px-4 py-3 md:py-2 border rounded-xl text-[10px] font-black transition-all uppercase tracking-widest shadow-xl cursor-pointer active:scale-95",
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
