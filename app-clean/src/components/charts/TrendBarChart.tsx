import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TrendBarChartProps {
  data: {
    period: string
    income: number
    expense: number
  }[]
}

export function TrendBarChart({ data }: TrendBarChartProps) {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="period" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6B7280', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickFormatter={(value) => new Intl.NumberFormat('es-ES', { notation: 'compact', compactDisplay: 'short' }).format(value)}
          />
          <Tooltip 
            formatter={(value: number) => [new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0), '']}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            cursor={{ fill: '#F3F4F6' }}
          />
          <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="expense" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
