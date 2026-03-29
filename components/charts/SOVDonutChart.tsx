'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { CompetitorRow } from '@/lib/queries/types'
import { CHART_COLORS, CLAY_BRAND } from '@/lib/utils/colors'

interface SOVDonutChartProps {
  data: CompetitorRow[]
  height?: number
}

export default function SOVDonutChart({ data, height = 240 }: SOVDonutChartProps) {
  const chartData = data.map(r => ({
    name: r.competitor_name,
    value: parseFloat(r.sov_pct.toFixed(1)),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={entry.name.toLowerCase() === 'clay' ? CLAY_BRAND : CHART_COLORS[(i + 1) % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Tooltip formatter={(val: any) => [`${Number(val).toFixed(1)}%`, 'Share']} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
