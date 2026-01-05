import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { 
  PieChart as PieIcon, 
  Disc, 
  Circle, 
  Activity, 
  Grid,
  ChevronLeft,
  Briefcase,
  Wallet,
  Landmark,
  PiggyBank,
  Coins,
  MoreHorizontal
} from 'lucide-react'
import type { FinancialDistribution } from '../services/summaryService'

// --- CONSTANTS & HELPERS ---
const COLORS_MAP: Record<string, string> = {
  'Cuentas / Bancos': '#3b82f6', // Blue
  'Efectivo': '#10b981', // Emerald
  'Ahorro': '#f97316', // Orange
  'Objetivos Ahorro': '#ec4899', // Pink
  'Inversión': '#8b5cf6', // Purple
  'Otros': '#64748b'  // Slate
}

const RADIAN = Math.PI / 180;

type ChartType = 'pie' | 'donut' | 'thin' | 'half' | 'spaced'

// Helper for dynamic colors
const getDynamicColor = (index: number) => {
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#6366f1'];
    return palette[index % palette.length];
}

const getIcon = (name: string, drillLevel: any) => {
    if (drillLevel) return <Briefcase size={14} /> // Generic icon for sub-items
    if (name.includes('Banco')) return <Landmark size={14} />
    if (name.includes('Efectivo')) return <Wallet size={14} />
    if (name.includes('Ahorro')) return <PiggyBank size={14} />
    if (name.includes('Inversión')) return <Activity size={14} />
    if (name.includes('Objetivos')) return <Coins size={14} />
    return <MoreHorizontal size={14} />
}

// --- HOOK ---
export function useNetWorth(financialOverview: FinancialDistribution | null) {
  const [chartType, setChartType] = useState<ChartType>('donut')
  const [drillLevel, setDrillLevel] = useState<any | null>(null)

  const currentData = useMemo(() => {
    if (!financialOverview) return []
    if (drillLevel) return drillLevel.subItems || []
    return financialOverview.distribution
  }, [drillLevel, financialOverview])

  const currentTotal = useMemo(() => {
    if (!financialOverview) return 0
    if (drillLevel) return currentData.reduce((sum: number, item: any) => sum + item.value, 0)
    return financialOverview.totalAssets
  }, [currentData, drillLevel, financialOverview])

  const chartConfig = {
    pie: { inner: 0, outer: 130, padding: 0, start: 90, end: -270 },
    donut: { inner: 75, outer: 130, padding: 0, start: 90, end: -270 },
    thin: { inner: 110, outer: 130, padding: 0, start: 90, end: -270 },
    half: { inner: 75, outer: 130, padding: 0, start: 180, end: 0, cy: '75%' },
    spaced: { inner: 75, outer: 130, padding: 4, start: 90, end: -270 }
  }
  const activeConfig = chartConfig[chartType]

  return {
      chartType,
      setChartType,
      drillLevel,
      setDrillLevel,
      currentData,
      currentTotal,
      activeConfig
  }
}

// --- INFO COMPONENT ---
interface NetWorthInfoProps {
    drillLevel: any
    setDrillLevel: (val: any) => void
    currentData: any[]
    currentTotal: number
    formatCurrency: (val: number) => string
}

export function NetWorthInfo({ drillLevel, setDrillLevel, currentData, currentTotal, formatCurrency }: NetWorthInfoProps) {
    // Animation key for key-based transitions
    const viewKey = drillLevel ? `drill-${drillLevel.name}` : 'main'

    return (
        <div className="section-card !p-10 flex flex-col h-full min-h-[350px] overflow-hidden relative">
             {/* Animations Styles */}
             <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-in {
                    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
             `}</style>

             <div key={viewKey} className="flex flex-col h-full animate-slide-in">
                 {/* Header Logic: Main vs Drilldown */}
                 <div className="flex-none mb-6">
                    {drillLevel ? (
                        /* Drilldown Header */
                        <div className="flex flex-col gap-4">
                           <button 
                                onClick={() => setDrillLevel(null)} 
                                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-primary transition-colors group self-start"
                           >
                              <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> 
                              Volver
                           </button>

                           <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                                        style={{ background: drillLevel.color || COLORS_MAP[drillLevel.name] || '#94a3b8' }}
                                    >
                                        {getIcon(drillLevel.name, true)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                            {drillLevel.name}
                                        </h3>
                                        <span className="text-xs text-gray-500 font-medium">Detalle de sección</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                        {formatCurrency(currentTotal)}
                                    </div>
                                </div>
                           </div>
                        </div>
                    ) : (
                        /* Main Header */
                        <div>
                           <div className="flex items-center gap-2 mb-6">
                               <div className="bg-primary/10 text-primary p-1.5 rounded-lg">
                                   <Briefcase size={16} />
                               </div>
                               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                  Patrimonio Neto
                               </h3>
                           </div>
                           <div className="mb-2">
                                <div className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums leading-none">
                                   {formatCurrency(currentTotal)}
                                </div>
                           </div>
                        </div>
                    )}
                 </div>

                 {/* Content List */}
                 <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex flex-col gap-2">
                        {currentData.map((item: any, idx: number) => {
                       const value = item.value || 0
                       const percent = currentTotal > 0 ? (value / currentTotal) * 100 : 0
                       const hasSubs = !drillLevel && item.subItems?.length
                       // FIX: In drillDown, ALWAYS use dynamic cycling to ensure distinction between sub-items
                       // Otherwise they all inherit the parent's color (e.g. Purple for Investment)
                       const color = drillLevel ? getDynamicColor(idx) : (item.color || COLORS_MAP[item.name] || '#94a3b8')

                       return (
                          <div 
                             key={idx}
                             onClick={() => hasSubs && setDrillLevel(item)}
                             className={`
                                group flex items-center justify-between py-3 px-3 rounded-xl border border-transparent transition-all duration-200
                                ${hasSubs 
                                    ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:shadow-sm hover:border-gray-100 dark:hover:border-slate-700/50' 
                                    : 'cursor-default hover:bg-gray-50/50 dark:hover:bg-slate-800/30'}
                             `}
                          >
                             <div className="flex items-center gap-3">
                                {/* Icon (Smaller in drilldown, standard in main) */}
                                <div 
                                   className={`
                                        flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105
                                        ${drillLevel ? 'w-8 h-8 rounded-lg text-xs' : 'w-10 h-10 rounded-xl'}
                                   `}
                                   style={{ background: color }}
                                >
                                   {getIcon(item.name, drillLevel)}
                                </div>
                                
                                <div className="flex flex-col min-w-[100px]">
                                   <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1 group-hover:text-primary transition-colors">
                                      {item.name}
                                      {hasSubs && <ChevronLeft size={12} className="rotate-180 text-gray-300 group-hover:text-primary transition-colors" />}
                                   </span>
                                   
                                   {/* Progress Bar (Visible in ALL views now for better visuals) */}
                                   <div className="w-16 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
                                   </div>
                                </div>
                             </div>
                             
                             <div className="text-right">
                                <div className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                                   {formatCurrency(value)}
                                </div>
                                {/* Badge style percent for drilldown, simple text for main */}
                                <div className={`text-xs font-medium mt-0.5 tabular-nums ${drillLevel ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 px-1.5 py-0.5 rounded-md inline-block' : 'text-gray-400'}`}>
                                   {percent.toFixed(1)}%
                                </div>
                             </div>
                          </div>
                       )
                    })}
                    </div>
                 </div>
             </div>
        </div>
    )
}

// --- CHART COMPONENT ---
interface NetWorthChartProps {
    drillLevel: any
    setDrillLevel: (val: any) => void
    currentData: any[]
    currentTotal: number
    formatCurrency: (val: number) => string
    chartType: ChartType
    setChartType: (val: ChartType) => void
    activeConfig: any
}

export function NetWorthChart({ 
    drillLevel, setDrillLevel, currentData, currentTotal, formatCurrency, 
    chartType, setChartType, activeConfig 
}: NetWorthChartProps) {

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent < 0.04) return null; 
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
          <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold pointer-events-none drop-shadow-md">
            {`${(percent * 100).toFixed(0)}%`}
          </text>
        );
    };

    return (
        <div className="section-card flex flex-col relative !p-10 h-full min-h-[350px]">
             {/* Header */}
             <div className="mb-2">
                 <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Patrimonio Visual
                 </h3>
             </div>

             {/* MAIN LAYOUT: 3 COLUMNS [Total Left | Chart Center | Controls Right] */}
             <div className="flex-1 flex items-center justify-between w-full h-full relative">
                 
                 {/* COL A: Total Area (Left) */}
                 <div className="flex flex-col justify-center min-w-[140px] z-10">
                    <span className="text-xs uppercase text-gray-400 font-bold mb-1 opacity-70 tracking-wider">
                        {drillLevel ? 'Subtotal' : 'Total Activos'}
                    </span>
                    <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">
                        {formatCurrency(currentTotal)}
                    </span>
                    {drillLevel && (
                        <span className="text-xs font-medium text-primary mt-1 bg-primary/10 px-2 py-1 rounded-md self-start">
                            {drillLevel.name}
                        </span>
                    )}
                 </div>

                 {/* COL B: Chart Area (Center) - Now Responsive */}
                 <div className="flex items-center justify-center relative flex-1 min-w-0 overflow-hidden">
                     <div className="w-full h-full max-w-[280px] max-h-[280px] aspect-square mx-auto">
                         <PieChart width={280} height={280} className="mx-auto">
                            <Pie
                               data={currentData}
                               cx="50%"
                               cy={(activeConfig as any).cy ? '75%' : '50%'}
                               innerRadius={activeConfig.inner * 0.85}
                               outerRadius={activeConfig.outer * 0.85}
                               paddingAngle={activeConfig.padding}
                               startAngle={activeConfig.start}
                               endAngle={activeConfig.end}
                               dataKey="value"
                               stroke="none"
                               onClick={(data) => !drillLevel && data.subItems && setDrillLevel(data)}
                               className="cursor-pointer outline-none focus:outline-none"
                               isAnimationActive={true}
                               label={renderCustomizedLabel}
                               labelLine={false}
                            >
                               {currentData.map((entry: any, i: number) => (
                                  <Cell 
                                    key={`cell-${i}`} 
                                    fill={drillLevel ? getDynamicColor(i) : (entry.color || COLORS_MAP[entry.name] || '#94a3b8')} 
                                    strokeWidth={0} 
                                    className="hover:opacity-90 transition-opacity" 
                                  />
                               ))}
                            </Pie>
                            <Tooltip 
                               formatter={(v: any) => formatCurrency(v)} 
                               contentStyle={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}
                               itemStyle={{ color: 'var(--text-primary)' }}
                            />
                         </PieChart>
                     </div>
                 </div>

                {/* COL C: Controls Area (Right) */}
                <div className="flex flex-col items-center justify-center p-2 shrink-0 z-10">
                    {/* Ultimate Glass Control Strip */}
                    <div className="relative flex flex-col items-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-full p-1.5 shadow-[0_8px_32px_rgb(0,0,0,0.12)] border border-white/40 dark:border-white/5 ring-1 ring-black/5">
                        
                        {/* Glowing Gradient Active Indicator */}
                        <div 
                            className="absolute left-1.5 w-10 h-10 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
                            style={{ 
                                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                top: '6px', 
                                transform: `translateY(${
                                    ['pie', 'donut', 'thin', 'half', 'spaced'].indexOf(chartType) * 48 // 40px height + 8px gap
                                }px)` 
                            }}
                        />

                        <div className="flex flex-col gap-2 relative">
                            {[
                               { id: 'pie', Icon: PieIcon },
                               { id: 'donut', Icon: Disc },
                               { id: 'thin', Icon: Circle },
                               { id: 'half', Icon: Activity },
                               { id: 'spaced', Icon: Grid }
                            ].map((opt) => {
                               const isActive = chartType === opt.id
                               return (
                                   <button 
                                      key={opt.id}
                                      onClick={() => setChartType(opt.id as ChartType)}
                                      className={`
                                         w-10 h-10 flex items-center justify-center rounded-full relative z-10 transition-all duration-300
                                         ${isActive 
                                            ? 'text-white scale-110' 
                                            : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:scale-110'}
                                      `}
                                   >
                                      <opt.Icon 
                                          size={18} 
                                          strokeWidth={isActive ? 2.5 : 2} 
                                          className={`filter ${isActive ? 'drop-shadow-md' : ''} transition-all duration-300`}
                                      />
                                   </button>
                               )
                            })}
                        </div>
                    </div>
                </div>
             </div>
        </div>
    )
}
