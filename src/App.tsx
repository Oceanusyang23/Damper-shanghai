import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wind, 
  Activity, 
  Settings2, 
  Zap, 
  Magnet, 
  ShieldCheck, 
  Play,
  RotateCcw,
  Compass,
  Cpu,
  HeartPulse,
  Database,
  BarChart3,
  Waves,
  ShieldAlert
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '@/src/lib/utils';

// --- Types & Config ---

interface SimData {
  time: number;
  buildingSwayOn: number;
  buildingSwayOff: number;
  accelOn: number;
  accelOff: number;
}

// --- Components ---

export default function App() {
  const [isWindEnabled, setIsWindEnabled] = useState(true);
  const [isEarthquakeEnabled, setIsEarthquakeEnabled] = useState(true);
  const [windLevel, setWindLevel] = useState(8);
  const [earthquakeMag, setEarthquakeMag] = useState(7);
  const [windDirection, setWindDirection] = useState(225);
  const [isDamperActive, setIsDamperActive] = useState(true);
  const [isSimulating, setIsSimulating] = useState(true);
  const [isFooterExpanded, setIsFooterExpanded] = useState(true);
  const [history, setHistory] = useState<SimData[]>([]);
  const [simTime, setSimTime] = useState(0);

  // Compass interaction
  const compassRef = useRef<HTMLDivElement>(null);
  const handleCompassMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!compassRef.current) return;
    const rect = compassRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
    setWindDirection(Math.round((angle + 90 + 360) % 360));
  };

  // Physics Loop
  // Simulation State Refs (Coupled Physics)
  const stateRef = useRef({
    on: { bPos: 0, bVel: 0, dPos: 0, dVel: 0 },
    off: { bPos: 0, bVel: 0 }
  });

  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef(0);

  // Reset Simulation
  const resetSim = () => {
    stateRef.current = {
      on: { bPos: 0, bVel: 0, dPos: 0, dVel: 0 },
      off: { bPos: 0, bVel: 0 }
    };
    setHistory([]);
    setSimTime(0);
    frameCountRef.current = 0;
    startTimeRef.current = performance.now();
  };

  useEffect(() => {
    const animate = (time: number) => {
      if (!isSimulating) return;

      const dt = 0.016; 
      const t = (time - startTimeRef.current) / 1000;

      // --- Force Calculation ---
      const windFactor = Math.abs(Math.cos((windDirection - 225) * Math.PI / 180));
      const windForce = isWindEnabled ? (Math.pow(windLevel / 4, 2) * (20 + Math.sin(t * 1.5) * 5) * windFactor) : 0;
      const earthquakeForce = (isEarthquakeEnabled && (t % 10 < 0.3)) ? Math.pow(earthquakeMag - 2, 2.5) * 10 : 0;
      const totalForce = (windForce + earthquakeForce) || 0; 

      // --- Building Parameters ---
      const mB = 1000; 
      const kB = 80;   
      const dB = 1.2;  

      // --- Damper Parameters (Tuned) ---
      const mD = 100;  
      const kD = isDamperActive ? 8 : 1.5; 
      const dD = isDamperActive ? 15 : 0.08;

      // 1. Calculate Native State (Static Damper)
      const { bPos: bPosOff, bVel: bVelOff } = stateRef.current.off;
      const accOff = (totalForce - kB * bPosOff - dB * bVelOff) / (mB + mD);
      const nBVelOff = bVelOff + accOff * dt;
      const nBPosOff = bPosOff + nBVelOff * dt;

      // 2. Calculate Active Control State (Coupled TMD)
      const { bPos, bVel, dPos, dVel } = stateRef.current.on;
      
      const forceOnBuilding = totalForce - kB * bPos - dB * bVel + kD * (dPos - bPos) + dD * (dVel - bVel);
      const forceOnDamper = -kD * (dPos - bPos) - dD * (dVel - bVel);

      const accOn = (forceOnBuilding / mB) || 0;
      const nBVel = bVel + accOn * dt;
      const nBPos = bPos + nBVel * dt;
      const nDVel = dVel + (forceOnDamper / mD) * dt;
      const nDPos = dPos + nDVel * dt;

      stateRef.current = {
        on: { bPos: nBPos, bVel: nBVel, dPos: nDPos, dVel: nDVel },
        off: { bPos: nBPosOff, bVel: nBVelOff }
      };

      // Throttle UI updates to 15Hz (every 4 frames)
      frameCountRef.current++;
      if (frameCountRef.current % 4 === 0) {
        setSimTime(t);
        setHistory(prev => {
          const nextPoint = {
            time: t,
            buildingSwayOn: nBPos * 1000, 
            buildingSwayOff: nBPosOff * 1000,
            accelOn: accOn,
            accelOff: accOff
          };
          const next = [...prev, nextPoint];
          return next.length > 50 ? next.slice(1) : next;
        });
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isSimulating, isDamperActive, isWindEnabled, isEarthquakeEnabled, windLevel, earthquakeMag, windDirection]);

  // Optimized Clock Display
  const [clock, setClock] = useState({ date: '', time: '' });
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClock({
        date: now.toLocaleDateString('zh-CN').replace(/\//g, '-'),
        time: now.toLocaleTimeString('zh-CN', { hour12: false })
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const amplitudeReduction = 43; 

  return (
    <div className="fixed inset-0 bg-[#02050a] text-slate-200 font-sans overflow-hidden selection:bg-cyan-500/30">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-[0.03]" />
      
      <div className="h-full w-full max-w-[1920px] mx-auto flex flex-col p-4 gap-4">
        
        {/* --- HEADER --- */}
        <header className="flex justify-between items-center bg-slate-900/40 border border-slate-800 rounded-xl px-6 py-3 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Activity className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                上海慧眼 <span className="text-slate-500 font-light mx-1">|</span> 阻尼器仿真系统
              </h1>
              <p className="text-[10px] text-cyan-500 font-mono tracking-widest uppercase opacity-80">
                SHANGHAI EYE | DAMPER SIMULATION COCKPIT
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-10">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 text-right w-full">系统状态</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                <span className="text-emerald-400 font-mono text-sm font-bold uppercase">运行中 RUNNING</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-mono font-bold leading-none">{clock.date}</p>
              <p className="text-[14px] font-mono font-bold text-slate-400 mt-1">{clock.time}</p>
            </div>
            <button className="p-2 text-slate-500 hover:text-white transition-colors">
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* --- MAIN GRID --- */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          
          {/* Left Panel (Environment Simulation) */}
          <section className="col-span-3 flex flex-col gap-4">
            <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5 flex flex-col gap-6 backdrop-blur-md">
              <div className="space-y-1">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">环境条件模拟</h2>
                <p className="text-[9px] text-slate-600 uppercase">ENVIRONMENT SIMULATION</p>
              </div>

              {/* Wind Force Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                   <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setIsWindEnabled(!isWindEnabled)}
                        className={cn("p-1.5 rounded-md transition-colors", isWindEnabled ? "text-cyan-400 bg-cyan-400/10" : "text-slate-600 bg-slate-800/50")}
                      >
                        <Wind className="w-4 h-4" />
                      </button>
                      <span className="font-medium">风力强度 ({isWindEnabled ? '开启' : '关闭'})</span>
                   </div>
                   <span className={cn("text-xl font-mono font-bold transition-opacity", isWindEnabled ? "text-cyan-400 opacity-100" : "text-slate-600 opacity-50")}>
                     {windLevel} <span className="text-xs opacity-50">级</span>
                   </span>
                </div>
                <div className={cn("relative pt-1 transition-opacity", !isWindEnabled && "opacity-30 pointer-events-none")}>
                  <input 
                    type="range" min="0" max="12" step="1"
                    disabled={!isWindEnabled}
                    value={windLevel} onChange={(e) => setWindLevel(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-2 font-mono">
                     <span>微风</span><span>强风</span><span>台风</span>
                  </div>
                </div>
              </div>

              {/* Earthquake Level Selection */}
              <div className="space-y-4 border-t border-slate-800/50 pt-4">
                <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsEarthquakeEnabled(!isEarthquakeEnabled)}
                      className={cn("p-1.5 rounded-md transition-colors", isEarthquakeEnabled ? "text-orange-400 bg-orange-400/10" : "text-slate-600 bg-slate-800/50")}
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium">地震模拟 ({isEarthquakeEnabled ? '同步执行' : '待命'})</span>
                   </div>
                </div>
                <div className={cn("grid grid-cols-4 gap-2 transition-opacity", !isEarthquakeEnabled && "opacity-30 pointer-events-none")}>
                   {[3, 5, 7, 9].map(m => (
                     <button 
                       key={m}
                       disabled={!isEarthquakeEnabled}
                       onClick={() => setEarthquakeMag(m)}
                       className={cn(
                         "py-2 rounded-lg text-xs font-bold font-mono transition-all border",
                         earthquakeMag === m 
                          ? "bg-orange-500/10 border-orange-500/60 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.1)]" 
                          : "bg-slate-800/30 border-slate-800 text-slate-500 hover:text-slate-300"
                       )}
                     >
                       {m}级
                     </button>
                   ))}
                </div>
              </div>

              {/* Wind Direction Compass */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 relative select-none">
                <div className="absolute top-0 left-0 flex items-center gap-2">
                   <Compass className="w-4 h-4 text-slate-500" />
                   <span className="text-xs text-slate-500 uppercase font-bold">交互罗盘 / 方向控制</span>
                </div>
                <div 
                  ref={compassRef}
                  onMouseMove={(e) => e.buttons === 1 && handleCompassMove(e)}
                  onMouseDown={handleCompassMove}
                  onTouchMove={handleCompassMove}
                  className="relative w-44 h-44 cursor-crosshair group"
                >
                   <div className="absolute inset-0 rounded-full border border-slate-800 border-dashed animate-[spin_30s_linear_infinite] group-hover:border-cyan-500/30" />
                   <div className="absolute inset-4 rounded-full border border-slate-800/50 flex items-center justify-center">
                      <div className="grid grid-cols-2 gap-x-20 text-[9px] font-mono text-slate-700 font-bold">
                         <span>NW</span><span>NE</span>
                      </div>
                   </div>
                   <motion.div 
                     className="absolute inset-0 flex items-center justify-center"
                     animate={{ rotate: windDirection }}
                     transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                   >
                      <div className="w-36 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-cyan-400 flex items-center justify-end group-active:scale-x-110 transition-transform">
                         <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-cyan-400 rotate-90 translate-x-2 shadow-[4px_0_10px_rgba(34,211,238,0.5)]" />
                      </div>
                   </motion.div>
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-2xl flex flex-col items-center backdrop-blur-md">
                         <span className="text-xl font-mono font-bold text-white leading-none">{windDirection}°</span>
                         <span className="text-[10px] text-cyan-500 font-bold mt-1">
                           {windDirection >= 337.5 || windDirection < 22.5 ? 'N' :
                            windDirection < 67.5 ? 'NE' :
                            windDirection < 112.5 ? 'E' :
                            windDirection < 157.5 ? 'SE' :
                            windDirection < 202.5 ? 'S' :
                            windDirection < 247.5 ? 'SW' :
                            windDirection < 292.5 ? 'W' : 'NW'}
                         </span>
                      </div>
                   </div>
                </div>
                <p className="text-[9px] text-slate-600 mt-4 uppercase font-bold tracking-widest">DRAG OR CLICK TO SET DIRECTION</p>
              </div>
            </div>

            {/* Damper Control Switches */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">阻尼器控制</h2>
               <div className="flex gap-2">
                  <button 
                    onClick={() => setIsDamperActive(true)}
                    className={cn(
                      "flex-1 py-4 rounded-xl border font-bold text-sm transition-all flex flex-col items-center justify-center gap-1",
                      isDamperActive 
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]" 
                        : "bg-slate-800/30 border-slate-800 text-slate-600"
                    )}
                  >
                    <span className="text-lg">开启</span>
                    <span className="text-[9px] opacity-50 font-mono tracking-widest uppercase">ENABLE ON</span>
                  </button>
                  <button 
                    onClick={() => setIsDamperActive(false)}
                    className={cn(
                      "flex-1 py-4 rounded-xl border font-bold text-sm transition-all flex flex-col items-center justify-center gap-1",
                      !isDamperActive 
                        ? "bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]" 
                        : "bg-slate-800/30 border-slate-800 text-slate-600"
                    )}
                  >
                    <span className="text-lg">关闭</span>
                    <span className="text-[9px] opacity-50 font-mono tracking-widest uppercase">DISABLE OFF</span>
                  </button>
               </div>
            </div>
          </section>

          {/* Center Panel (Shanghai Tower Vis) */}
          <section className="col-span-5 bg-slate-900/20 border border-slate-800/40 rounded-2xl p-6 relative overflow-hidden flex flex-col gap-6 backdrop-blur-[2px]">
             <div className="flex justify-between items-start relative z-10">
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-tight">上海中心大厦 - 阻尼器系统</h2>
                  <p className="text-[10px] text-slate-500 uppercase font-mono">SHANGHAI TOWER - DAMPER SYSTEM</p>
                </div>
                <div className={cn(
                  "px-4 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-2",
                  isDamperActive ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400" : "bg-red-500/10 border-red-500/40 text-red-400"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", isDamperActive ? "bg-cyan-400" : "bg-red-400")} />
                  阻尼器状态 : {isDamperActive ? 'ACTIVE' : 'INACTIVE'}
                </div>
             </div>

             <div className="flex-1 flex gap-8">
                {/* Building Profile */}
                <div className="w-[40%] relative flex flex-col items-center justify-end pb-12">
                   <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between py-2 text-[10px] text-slate-700 font-mono pointer-events-none">
                      <span>632M</span><span>500M</span><span>400M</span><span>300M</span><span>200M</span><span>100M</span><span>0M</span>
                   </div>
                   
                   {/* Tower Core */}
                   <motion.div 
                     animate={{ rotate: isSimulating ? (isDamperActive ? stateRef.current.on.bPos : stateRef.current.off.bPos) * 1.5 : 0 }}
                     style={{ transformOrigin: 'bottom center' }}
                     className="relative w-24 h-[90%] bg-gradient-to-t from-slate-900 to-cyan-900/10 border-x border-t border-cyan-800/30 rounded-t-3xl shadow-[0_0_60px_rgba(34,211,238,0.03)]"
                   >
                      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#22d3ee 1px, transparent 1px), linear-gradient(90deg, #22d3ee 1px, transparent 1px)', backgroundSize: '12px 24px' }} />
                      
                      {/* TMD highlight zone at 125th floor */}
                      <div className="absolute top-[8%] inset-x-0 h-16 bg-cyan-400/10 border-y border-cyan-400/20 backdrop-blur-sm shadow-[inset_0_0_20px_rgba(34,211,238,0.1)] flex items-center justify-center">
                         <div className="w-8 h-8 rounded-full bg-cyan-500 shadow-[0_0_20px_#22d3ee] animate-pulse flex items-center justify-center">
                            <Magnet className="text-white w-4 h-4" />
                         </div>
                      </div>

                      {/* Info Pin */}
                      <div className="absolute top-[8%] -right-32 flex items-center">
                         <div className="w-12 h-[1px] bg-cyan-500/50" />
                         <div className="flex flex-col ml-2">
                            <span className="text-xs font-bold text-cyan-400">125-126层</span>
                            <span className="text-[10px] text-slate-500 uppercase">阻尼器位置 / TMD</span>
                         </div>
                      </div>
                   </motion.div>
                </div>

                {/* Real-time Data Feeds */}
                <div className="flex-1 flex flex-col gap-4">
                   <div className="bg-slate-950/60 rounded-xl border border-slate-800/50 p-5 flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                         <BarChart3 className="w-4 h-4 text-cyan-500" />
                         <h3 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">实时位移 / DISPLACEMENT</h3>
                      </div>
                      <div className="h-28 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                               <defs>
                                  <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4}/>
                                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/>
                                  </linearGradient>
                               </defs>
                               <Area type="monotone" dataKey="buildingSwayOn" stroke="#22d3ee" strokeWidth={2} fill="url(#visGrad)" isAnimationActive={false} />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                      <div className="flex justify-between items-center mt-2 px-1">
                         <span className="text-[10px] text-slate-700 italic font-mono">-125 mm</span>
                         <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-mono font-bold text-white">{(isDamperActive ? stateRef.current.on.bPos * 1000 : stateRef.current.off.bPos * 1000).toFixed(1)}</span>
                            <span className="text-xs text-cyan-500 font-bold uppercase">mm</span>
                         </div>
                         <span className="text-[10px] text-slate-700 italic font-mono">+125 mm</span>
                      </div>
                   </div>

                   <div className="bg-slate-950/60 rounded-xl border border-slate-800/50 p-5 flex-1 flex flex-col">
                      <h3 className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-4">相对位移轨迹 / TRAJECTORY</h3>
                      <div className="flex-1 flex items-center justify-center pt-2">
                         <div className="w-full h-full border border-slate-800 rounded-lg relative overflow-hidden">
                            {/* Grid Background */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-30">
                               <div className="w-full h-[1px] bg-slate-800" />
                               <div className="h-full w-[1px] bg-slate-800" />
                               <div className="absolute w-24 h-24 rounded-full border border-slate-800" />
                            </div>
                            {/* Moving Point */}
                            <motion.div 
                              animate={{ 
                                x: (isDamperActive ? (stateRef.current.on.dPos - stateRef.current.on.bPos) * 150 : 0),
                                y: Math.sin(simTime * 3) * 15 
                              }}
                              className="absolute inset-0 flex items-center justify-center"
                            >
                               <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_15px_#22d3ee] flex items-center justify-center">
                                  <div className="w-full h-full bg-cyan-400 rounded-full animate-ping opacity-30" />
                               </div>
                               <div className="absolute w-32 h-32 border border-cyan-400/10 rounded-full" />
                            </motion.div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* Right Panel (Simulation Monitoring) */}
          <section className="col-span-4 flex flex-col gap-4">
             <div className="flex-1 bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-md overflow-hidden">
                <div className="space-y-1">
                   <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">仿真数据监控</h2>
                   <p className="text-[9px] text-slate-600 uppercase">SIMULATION MONITORING</p>
                </div>

                {/* Comparison Lists */}
                <div className="flex-1 flex flex-col gap-4">
                   {/* Displacement Charts */}
                   <div className="flex-1 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                         <span className="text-slate-500">位移响应对比 (顶端位移)</span>
                         <div className="flex gap-4">
                            <div className="flex items-center gap-1"><div className="w-3 h-0.5 border-t border-dashed border-orange-500" /> <span className="text-slate-400">关闭 OFF</span></div>
                            <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-cyan-500" /> <span className="text-slate-400">开启 ON</span></div>
                         </div>
                      </div>
                      <div className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800/50 p-2">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                               <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vert={false} />
                               <Line type="monotone" dataKey="buildingSwayOff" stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                               <Line type="monotone" dataKey="buildingSwayOn" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   {/* Acceleration Charts */}
                   <div className="flex-1 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                         <span className="text-slate-500">加速度响应对比 (项端加速度)</span>
                      </div>
                      <div className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800/50 p-2">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                               <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vert={false} />
                               <Line type="monotone" dataKey="accelOff" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                               <Line type="monotone" dataKey="accelOn" stroke="#00e5ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                            </LineChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                </div>

                {/* Detailed Comparison Metrics */}
                <div className="grid grid-cols-12 gap-3 mt-auto">
                   <div className="col-span-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/50 flex flex-col items-center">
                      <span className="text-[9px] text-slate-600 font-bold uppercase mb-3">振幅减小</span>
                      <div className="relative w-16 h-16 flex items-center justify-center">
                         <svg className="w-full h-full -rotate-90">
                           <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="4" />
                           <motion.circle 
                             cx="32" cy="32" r="28" fill="none" stroke="#06b6d4" strokeWidth="4" 
                             strokeDasharray="176" initial={{ strokeDashoffset: 176 }} animate={{ strokeDashoffset: 176 - (176 * 0.43) }}
                             transition={{ duration: 2 }}
                           />
                         </svg>
                         <span className="absolute text-xl font-mono font-bold text-cyan-400">43%</span>
                      </div>
                      <p className="text-[8px] text-slate-700 mt-2 font-bold uppercase">MAX UP TO 43%</p>
                   </div>

                   <div className="col-span-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                      <span className="text-[9px] text-slate-600 font-bold uppercase">阻尼比 (ζ)</span>
                      <div className="space-y-3">
                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] font-bold"><span className="text-slate-500">开启 ON</span><span className="text-cyan-400">2.5~3.0%</span></div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-cyan-500 w-[60%]" /></div>
                         </div>
                         <div className="space-y-1">
                            <div className="flex justify-between text-[8px] font-bold"><span className="text-slate-500">关闭 OFF</span><span className="text-orange-400">0.5~1.0%</span></div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-orange-500 w-[15%]" /></div>
                         </div>
                      </div>
                   </div>

                   <div className="col-span-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800/50 flex flex-col justify-between">
                      <span className="text-[9px] text-slate-600 font-bold uppercase">电涡流耗能状态</span>
                      <div className="flex-1 flex flex-col justify-center">
                         <div className="text-2xl font-mono font-bold text-emerald-400">78%</div>
                         <div className="flex gap-1 mt-2">
                            {Array.from({length: 12}).map((_, i) => (
                              <div key={i} className={cn("flex-1 h-3 rounded-[1px]", i < 9 ? "bg-emerald-500" : "bg-slate-800")} />
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </section>
        </div>

        {/* --- FOOTER STATS (DRAGGABLE & COLLAPSIBLE) --- */}
        <div className="relative h-24 mb-2">
          <motion.footer 
            drag
            dragConstraints={{ left: -100, right: 100, top: -600, bottom: 20 }}
            dragElastic={0.1}
            initial={false}
            animate={{ 
              height: isFooterExpanded ? 'auto' : '56px',
              width: isFooterExpanded ? '100%' : '56px',
              borderRadius: isFooterExpanded ? '12px' : '50%',
              y: isFooterExpanded ? 0 : 10
            }}
            className={cn(
              "absolute bottom-0 left-0 z-[100] bg-slate-900/90 border border-slate-700 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden cursor-grab active:cursor-grabbing group",
              !isFooterExpanded && "flex items-center justify-center p-0"
            )}
          >
            {isFooterExpanded ? (
              <div className="px-8 py-4 grid grid-cols-5 gap-10 min-w-[1200px]">
                <div className="flex items-center gap-4 border-r border-slate-800 pr-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-cyan-400">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">仿真时间 / SIM TIME</p>
                    <p className="text-xl font-mono font-bold text-white">
                        {Math.floor(simTime / 60).toString().padStart(2, '0')}:
                        {Math.floor(simTime % 60).toString().padStart(2, '0')}:
                        {Math.floor((simTime * 100) % 100).toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-r border-slate-800 pr-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-indigo-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">数据采集频率</p>
                    <p className="text-xl font-mono font-bold text-white">1000 <span className="text-xs text-slate-400">Hz</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-r border-slate-800 pr-4">
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-t from-emerald-500/10 to-emerald-400/20 flex items-center justify-center text-emerald-400 font-mono font-bold">
                        98%
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">系统健康度 / HEALTH</p>
                    <p className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> 优秀 EXCELLENT
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-r border-slate-800 pr-4">
                  <div className="w-10 h-10 rounded bg-slate-800/80 flex items-center justify-center text-slate-400">
                    <Waves className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">当前工况分析</p>
                    <p className="text-xs font-bold text-slate-300">台风 {isWindEnabled ? windLevel : 0} 级 + 地震 {isEarthquakeEnabled ? earthquakeMag : 0} 级</p>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-center relative">
                   <button 
                     onClick={() => setIsFooterExpanded(false)}
                     className="absolute -top-2 -right-4 p-2 text-slate-600 hover:text-white"
                   >
                     <RotateCcw className="w-3 h-3 rotate-45" />
                   </button>
                   <span className="text-[9px] text-emerald-400 font-bold tracking-[0.2em] mb-2 animate-pulse uppercase">实时传输中 STREAMING</span>
                   <div className="flex gap-1 items-end h-4">
                     {Array.from({length: 12}).map((_, i) => (
                       <motion.div 
                         key={i}
                         animate={{ height: [4, 16, 8, 16, 4] }}
                         transition={{ repeat: Infinity, duration: 1, delay: i * 0.05 }}
                         className="w-[3px] bg-emerald-500/80 rounded-full"
                       />
                     ))}
                   </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsFooterExpanded(true)}
                className="w-full h-full flex items-center justify-center text-cyan-400 hover:text-white transition-colors animate-bounce"
              >
                <Cpu className="w-6 h-6" />
              </button>
            )}
          </motion.footer>
        </div>

      </div>

      {/* Stability Warning */}
      <AnimatePresence>
        {!isDamperActive && isSimulating && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 backdrop-blur-xl border border-red-500 px-8 py-3 rounded-full flex items-center gap-4 shadow-[0_0_40px_rgba(239,68,68,0.4)]"
          >
            <ShieldAlert className="text-white w-6 h-6 animate-bounce" />
            <span className="text-white font-bold tracking-widest text-sm">当前计算结果：若不开启阻尼器，结构承载力将逼近极限！</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
