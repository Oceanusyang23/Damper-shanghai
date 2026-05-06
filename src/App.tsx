/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wind, 
  Activity, 
  Settings2, 
  Info, 
  Zap, 
  Magnet, 
  ShieldCheck, 
  ShieldAlert,
  Play,
  RotateCcw,
  TrendingDown
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn } from '@/src/lib/utils';

// --- Constants & Types ---

type Mode = 'WIND' | 'EARTHQUAKE';
type Intensity = 'LOW' | 'MEDIUM' | 'HIGH';

interface SimState {
  time: number;
  buildingSway: number;
  damperSway: number;
}

// --- Components ---

export default function App() {
  const [mode, setMode] = useState<Mode>('WIND');
  const [intensity, setIntensity] = useState<Intensity>('LOW');
  const [isDamperActive, setIsDamperActive] = useState(true);
  const [history, setHistory] = useState<SimState[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Physics refs
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const stateRef = useRef({ bVel: 0, bPos: 0, dVel: 0, dPos: 0 });

  // Reset simulation
  const resetSim = () => {
    stateRef.current = { bVel: 0, bPos: 0, dVel: 0, dPos: 0 };
    setHistory([]);
    startTimeRef.current = performance.now();
  };

  // Physics Loop
  useEffect(() => {
    const animate = (time: number) => {
      if (!isSimulating) return;

      const dt = 0.016; // Fixed timestep approx 60fps
      const { bVel, bPos, dVel, dPos } = stateRef.current;

      // Building parameters
      const bMass = 100;
      const bK = 20; // Stiffness
      const bD = 0.05; // Base structural damping (low)

      // Damper parameters
      const dMass = isDamperActive ? 10 : 0.001; // 10% mass ratio if active
      const dK = isDamperActive ? 2 : 0; // Tuned stiffness
      const dD = isDamperActive ? 0.8 : 0; // Magnetic damping (high)

      // External Force (Wind or Earthquake)
      let extForce = 0;
      const t = (time - startTimeRef.current) / 1000;
      
      const intensityScale = intensity === 'LOW' ? 1 : intensity === 'MEDIUM' ? 3 : 8;

      if (mode === 'WIND') {
        // Wind: Constant pressure + gustiness
        extForce = (intensityScale * 1.5) + Math.sin(t * 2) * intensityScale * 0.5;
      } else {
        // Earthquake: Sudden impulse then decay
        if (t < 0.5) extForce = intensityScale * 20;
        else extForce = 0;
      }

      // Coupled equations of motion
      // F_building = extForce - k_b*x_b - d_b*v_b + k_d*(x_d - x_b) + d_d*(v_d - v_b)
      // F_damper = -k_d*(x_d - x_b) - d_d*(v_d - v_b)
      
      const forceOnBuilding = extForce - (bK * bPos) - (bD * bVel) + (dK * (dPos - bPos)) + (dD * (dVel - bVel));
      const forceOnDamper = -(dK * (dPos - bPos)) - (dD * (dVel - bVel));

      const newBVel = bVel + (forceOnBuilding / bMass) * dt;
      const newBPos = bPos + newBVel * dt;
      const newDVel = dVel + (forceOnDamper / dMass) * dt;
      const newDPos = dPos + newDVel * dt;

      stateRef.current = { bVel: newBVel, bPos: newBPos, dVel: newDVel, dPos: newDPos };

      setHistory(prev => {
        const next = [...prev, { time: t, buildingSway: newBPos, damperSway: newDPos }];
        return next.slice(-100); // Keep last 100 points
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    if (isSimulating) {
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isSimulating, isDamperActive, mode, intensity]);

  const currentSway = stateRef.current.bPos;
  const maxSway = Math.max(...history.map(h => Math.abs(h.buildingSway)), 0.1);
  const comfortLevel = useMemo(() => {
    const acc = Math.abs(stateRef.current.bVel);
    if (acc < 0.05) return { label: '极佳', color: 'text-emerald-400' };
    if (acc < 0.15) return { label: '良好', color: 'text-yellow-400' };
    return { label: '不适', color: 'text-red-400' };
  }, [stateRef.current.bVel]);

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden p-4 md:p-6 flex flex-col gap-4 pb-safe">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none opacity-5" />

      {/* Header */}
      <header className="relative z-10 bg-slate-900/50 border border-slate-800 rounded-2xl px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Activity className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h1 className="text-sm md:text-xl font-bold tracking-tight text-white uppercase">
              上海慧眼 | 阻尼器
            </h1>
            <p className="text-[8px] md:text-[10px] text-slate-500 font-bold tracking-widest uppercase">
              Shanghai Tower TMD
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2 md:mr-4">
            <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">系统状态</span>
            <span className="text-emerald-400 font-mono text-sm flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", isSimulating ? "bg-emerald-400 animate-pulse" : "bg-slate-600")} />
              {isSimulating ? "仿真中..." : "待命"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isSimulating ? (
              <button 
                onClick={() => { resetSim(); setIsSimulating(true); }}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2"
              >
                <Play className="w-3 h-3 fill-current" />
                启动仿真
              </button>
            ) : (
              <button 
                onClick={() => setIsSimulating(false)}
                className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-all"
              >
                停止系统
              </button>
            )}
            <button 
              onClick={resetSim}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 grid grid-cols-12 gap-4">
        
        {/* Left Column: Simulation Viewport */}
        <section className="col-span-12 lg:col-span-8 bg-slate-900/30 border border-slate-800 rounded-3xl relative overflow-hidden flex flex-col min-h-[500px]">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          {/* Overlay Status */}
          <div className="absolute top-6 right-6 z-20">
            <div className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border backdrop-blur-md", 
              isDamperActive ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-red-500/10 border-red-500/30 text-red-500"
            )}>
              阻尼器: {isDamperActive ? 'Active' : 'Offline'}
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center pt-8">
            {/* Scale Reference */}
            <div className="absolute left-6 top-0 bottom-0 flex flex-col justify-between py-10 text-[10px] text-slate-600 font-mono pointer-events-none">
              <span>632M</span><span>500M</span><span>400M</span><span>300M</span><span>200M</span><span>100M</span><span>0M</span>
            </div>

            {/* Building SVG Visualization */}
            <div className="relative w-full h-full flex flex-col items-center justify-end pb-12">
              <motion.div 
                animate={{ 
                  rotate: isSimulating ? stateRef.current.bPos * 0.5 : 0,
                  x: isSimulating ? stateRef.current.bPos * 5 : 0 
                }}
                transition={{ type: 'just' }}
                style={{ transformOrigin: 'bottom center' }}
                className="relative w-32 h-[400px] bg-gradient-to-t from-slate-800/40 to-cyan-500/20 rounded-t-full border-x border-t border-slate-700/50 flex flex-col items-center shadow-2xl"
              >
                {/* Windows/Grid Pattern */}
                <div className="absolute inset-0 grid grid-cols-4 gap-px p-4 opacity-5 pointer-events-none">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-[1px]" />
                  ))}
                </div>

                {/* Damper Room */}
                <div className="absolute top-10 w-24 h-24 bg-slate-900 border-4 border-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)] z-10">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-[9px] text-cyan-400 font-bold uppercase tracking-tighter whitespace-nowrap">
                    125th Floor
                  </div>
                  
                  {/* The Eye Damper */}
                  <motion.div 
                    animate={{ 
                      x: isSimulating ? (stateRef.current.dPos - stateRef.current.bPos) * 15 : 0,
                      rotate: isSimulating ? (stateRef.current.dPos - stateRef.current.bPos) * 10 : 0
                    }}
                    transition={{ type: 'just' }}
                    className="relative w-12 h-12 flex items-center justify-center"
                  >
                    <div className="w-12 h-12 border-2 border-dashed border-cyan-400/50 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 bg-cyan-400 rounded-full shadow-[0_0_15px_#22d3ee]" />
                    </div>
                  </motion.div>
                </div>

                {/* Cables to bottom */}
                <div className="absolute top-22 w-full h-full flex justify-around opacity-20 px-8">
                  <div className="w-[1px] h-full bg-cyan-500" />
                  <div className="w-[1px] h-full bg-cyan-500" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Comparison Toggle Overlay */}
          <div className="p-6 flex justify-between items-end bg-gradient-to-t from-slate-950 to-transparent relative z-20">
            <div className="bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl flex gap-1 backdrop-blur-sm">
              <button 
                onClick={() => setIsDamperActive(true)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  isDamperActive ? "bg-cyan-500 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                )}
              >
                开启阻尼器
              </button>
              <button 
                onClick={() => setIsDamperActive(false)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  !isDamperActive ? "bg-red-500 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
                )}
              >
                禁用模式
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">当前偏摆幅度: <span className="text-white font-mono">{Math.abs(currentSway * 1000).toFixed(0)} MM</span></p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">涡流平衡系统已介入</p>
            </div>
          </div>
        </section>

        {/* Right Column Grid */}
        <div className="col-span-12 lg:col-span-4 grid grid-cols-4 grid-rows-6 gap-4">
          
          {/* Environment Controls */}
          <section className="col-span-4 row-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_8px_#06b6d4]"></span> 环境模拟
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 uppercase font-bold">仿真模式</span>
                  <div className="bg-slate-800 rounded-lg p-1 flex gap-1">
                    <button 
                      onClick={() => {setMode('WIND'); resetSim();}}
                      className={cn("px-2 py-1 rounded-md transition-all", mode === 'WIND' ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500")}
                    ><Wind className="w-3 h-3" /></button>
                    <button 
                      onClick={() => {setMode('EARTHQUAKE'); resetSim();}}
                      className={cn("px-2 py-1 rounded-md transition-all", mode === 'EARTHQUAKE' ? "bg-orange-500/20 text-orange-400" : "text-slate-500")}
                    ><Zap className="w-3 h-3" /></button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as Intensity[]).map((level) => (
                    <button 
                      key={level}
                      onClick={() => setIntensity(level)}
                      className={cn(
                        "py-2 rounded-xl text-[10px] font-bold border transition-all",
                        intensity === level 
                          ? "bg-slate-800 border-slate-700 text-white" 
                          : "bg-slate-900/50 border-slate-800/50 text-slate-500 hover:bg-slate-800"
                      )}
                    >
                      {level === 'LOW' ? '轻微' : level === 'MEDIUM' ? '中度' : '剧烈'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] uppercase font-bold mb-2">
                  <span className="text-slate-500">外部动能强度</span>
                  <span className={cn("font-mono", mode === 'WIND' ? 'text-cyan-400' : 'text-orange-400')}>
                    {intensity === 'LOW' ? 'Level 4' : intensity === 'MEDIUM' ? 'Level 8' : 'Level 12+'}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={false}
                    animate={{ width: intensity === 'LOW' ? '30%' : intensity === 'MEDIUM' ? '60%' : '100%' }}
                    className={cn("h-full rounded-full bg-gradient-to-r", mode === 'WIND' ? "from-cyan-500 to-blue-500" : "from-orange-500 to-red-500")}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Metrics 1: Sway Reduction */}
          <section className="col-span-2 row-span-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">最大偏摆</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-mono font-bold text-white tracking-tighter">{(maxSway * 1000).toFixed(0)}</span>
              <span className="text-[10px] text-slate-500">MM</span>
            </div>
            {isDamperActive && (
              <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full inline-block mt-2 self-start">
                ↓ 约 45% 优化
              </span>
            )}
          </section>

          {/* Metrics 2: Comfort Index */}
          <section className="col-span-2 row-span-1 bg-slate-900/50 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">舒适指数</span>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-xl font-bold tracking-tight uppercase", comfortLevel.color)}>{comfortLevel.label}</span>
            </div>
            <span className="text-[9px] text-slate-500">室内垂直振感监测</span>
          </section>

          {/* Wave Monitor (Replacing Historical section for a better bento look) */}
          <section className="col-span-4 row-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col relative overflow-hidden group">
             <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingDown className="w-3 h-3 text-emerald-400" /> 波形分析
                </h3>
             </div>
             <div className="flex-1 min-h-[100px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <Line 
                      type="monotone" 
                      dataKey="buildingSway" 
                      stroke="#06b6d4" 
                      strokeWidth={2} 
                      dot={false} 
                      isAnimationActive={false} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="damperSway" 
                      stroke="#fb923c" 
                      strokeWidth={1} 
                      strokeDasharray="3 3"
                      dot={false} 
                      isAnimationActive={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
             </div>
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
          </section>
        </div>
      </main>

      {/* Footer Knowledge */}
      <footer className="mt-4 flex flex-col md:flex-row justify-between items-center bg-indigo-900/10 border border-indigo-500/20 rounded-2xl p-6 gap-6">
        <div className="flex-1 flex gap-4 items-start">
           <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl">
             <Info className="w-5 h-5 text-indigo-400" />
           </div>
           <div>
             <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">科普：上海慧眼的作用</h4>
             <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
               上海中心阻尼器不仅是减灾工程，更是一件名为“上海慧眼”的艺术品。重达<span className="text-white font-bold">1000吨</span>，位于125层。它利用永磁铁和涡流板的电磁耦合，将风致振动的动能高效转化为热能，让即使处于632米高空的访客也能感到如履平地。
             </p>
           </div>
        </div>
        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest space-y-2 text-right">
          <p>© 2026 SHANGHAI TOWER LABS</p>
          <p className="flex items-center gap-2 justify-end">
            <span className="w-1.5 h-1.5 bg-slate-700 rounded-full" /> 风洞仿真数据支持
          </p>
        </div>
      </footer>

      {/* Comparison Modal Overlay (Conditional Hint) */}
      <AnimatePresence>
        {!isDamperActive && isSimulating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-red-600 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-red-500/30 backdrop-blur-xl"
          >
            <ShieldAlert className="w-5 h-5 text-white animate-pulse" />
            <p className="text-white font-bold text-sm">危险：阻尼器已失稳！建筑结构面临损毁风险</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
