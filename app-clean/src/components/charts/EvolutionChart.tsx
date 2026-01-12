import { useState } from 'react'
import { 
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend
} from 'recharts'
import { BarChart3, TrendingUp } from 'lucide-react'

interface EvolutionChartProps {
  data: {
    period: string
    income: number
    expense: number
  }[]
  title?: string
}

export function EvolutionChart({ data, title = 'Evolución Financiera' }: EvolutionChartProps) {
  const [chartType, setChartType] = useState<'bars' | 'lines'>('bars')
  
  // Add profit/loss to data for line chart
  const enrichedData = data.map(d => ({
    ...d,
    profit: d.income - d.expense
  }))

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0)
  
  const formatCompact = (value: number) => 
    new Intl.NumberFormat('es-ES', { notation: 'compact', compactDisplay: 'short' }).format(value)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null
    
    return (
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
      }}>
        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>
          {label}
        </div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: 4,
            fontSize: 13
          }}>
            <div style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: p.color 
            }} />
            <span style={{ color: '#94a3b8' }}>{p.name}:</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {formatCurrency(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: 16,
      border: '1px solid #334155',
      padding: 24,
      marginBottom: 24
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <h3 style={{ 
          color: '#e2e8f0', 
          fontSize: 16, 
          fontWeight: 600,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(59,130,246,0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {chartType === 'bars' ? (
              <BarChart3 size={16} style={{ color: '#10b981' }} />
            ) : (
              <TrendingUp size={16} style={{ color: '#3b82f6' }} />
            )}
          </div>
          {title}
        </h3>

        {/* Toggle Buttons */}
        <div style={{
          display: 'flex',
          background: '#0f172a',
          borderRadius: 10,
          padding: 4,
          gap: 4
        }}>
          <button
            onClick={() => setChartType('bars')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: chartType === 'bars' ? '#10b981' : 'transparent',
              color: chartType === 'bars' ? 'white' : '#64748b',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <BarChart3 size={14} />
            Barras
          </button>
          <button
            onClick={() => setChartType('lines')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: chartType === 'lines' ? '#3b82f6' : 'transparent',
              color: chartType === 'lines' ? 'white' : '#64748b',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <TrendingUp size={14} />
            Líneas
          </button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          {chartType === 'bars' ? (
            <BarChart
              data={enrichedData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis 
                dataKey="period" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={formatCompact}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => (
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>
                )}
              />
              <Bar 
                dataKey="income" 
                name="Ingresos" 
                fill="#10b981" 
                radius={[6, 6, 0, 0]} 
                barSize={24}
              />
              <Bar 
                dataKey="expense" 
                name="Gastos" 
                fill="#ef4444" 
                radius={[6, 6, 0, 0]} 
                barSize={24}
              />
            </BarChart>
          ) : (
            <LineChart
              data={enrichedData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis 
                dataKey="period" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={formatCompact}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => (
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>
                )}
              />
              <Line 
                type="monotone" 
                dataKey="income" 
                name="Ingresos" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="expense" 
                name="Gastos" 
                stroke="#ef4444" 
                strokeWidth={3}
                dot={{ fill: '#ef4444', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#ef4444', stroke: '#0f172a', strokeWidth: 2 }}
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                name="Beneficio" 
                stroke="#3b82f6" 
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
