import { useMemo } from 'react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, Building2, TrendingUp, Activity } from 'lucide-react'

interface AdminDashboardProps {
  users: any[]
  organizations: any[]
}

export function AdminDashboard({ users, organizations }: AdminDashboardProps) {
  
  // 1. Calculate Stats
  const stats = useMemo(() => {
    const totalUsers = users.length
    const totalOrgs = organizations.length
    
    // Get current month users
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    const usersThisMonth = users.filter(u => {
      const d = new Date(u.created_at || u.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    }).length

    const orgsThisMonth = organizations.filter(o => {
      const d = new Date(o.created_at || o.date)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    }).length

    return { totalUsers, totalOrgs, usersThisMonth, orgsThisMonth }
  }, [users, organizations])

  // 2. Process Growth Data (Last 12 months)
  const growthData = useMemo(() => {
    interface MonthlyStat {
      name: string;
      fullDate: Date;
      key: string;
      users: number;
      orgs: number;
    }
    const months: MonthlyStat[] = []
    const now = new Date()
    
    // Generate last 12 month labels
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      months.push({
        name: d.toLocaleString('default', { month: 'short' }),
        fullDate: d,
        key,
        users: 0,
        orgs: 0
      })
    }

    // Fill data
    users.forEach(u => {
      if (!u.created_at) return
      const d = new Date(u.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const month = months.find(m => m.key === key)
      if (month) month.users++
    })

    organizations.forEach(o => {
      if (!o.created_at) return
      const d = new Date(o.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const month = months.find(m => m.key === key)
      if (month) month.orgs++
    })

    // Cumulative or Monthly? Let's do Monthly New for now, maybe toggle to Cumulative later if requested
    // But for 'Growth', cumulative is often expected. Let's do Monthly New Activity to show trends.
    return months
  }, [users, organizations])

  // 3. Status Distributions
  const userStatusData = useMemo(() => {
    const active = users.filter(u => !u.is_suspended).length
    const suspended = users.length - active
    return [
      { name: 'Activos', value: active, color: '#10b981' }, // Emerald
      { name: 'Suspendidos', value: suspended, color: '#ef4444' } // Red
    ]
  }, [users])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 border border-gray-100 dark:border-slate-700 shadow-xl rounded-lg text-sm">
          <p className="font-bold mb-2 text-gray-700 dark:text-gray-200">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
              <span className="font-semibold" style={{ color: entry.color }}>{entry.value}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="mb-8 space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Users Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-violet-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
                <Users size={20} />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Usuarios Totales</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{stats.totalUsers}</span>
              <span className="text-xs font-medium text-emerald-500 mb-1 flex items-center">
                <TrendingUp size={12} className="mr-0.5" />
                +{stats.usersThisMonth} este mes
              </span>
            </div>
          </div>
        </div>

        {/* Orgs Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                <Building2 size={20} />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Organizaciones</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{stats.totalOrgs}</span>
              <span className="text-xs font-medium text-emerald-500 mb-1 flex items-center">
                <TrendingUp size={12} className="mr-0.5" />
                +{stats.orgsThisMonth} este mes
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Activity size={18} className="text-violet-500" />
              Crecimiento Mensual
            </h3>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOrgs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.1} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}/>
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  name="Usuarios"
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorUsers)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="orgs" 
                  name="Organizaciones"
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorOrgs)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Status Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700/50">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Estado de Usuarios</h3>
          <div style={{ width: '100%', height: 300, position: 'relative' }}>
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                    data={userStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                 >
                    {userStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                 </Pie>
                 <Tooltip />
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
             {/* Center Label */}
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mb-8">
                <span className="block text-3xl font-bold text-gray-800 dark:text-white">{stats.totalUsers}</span>
                <span className="text-xs text-gray-500 uppercase font-semibold">Total</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
