'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { TimeseriesRow } from '@/lib/queries/types'
import { PLATFORM_COLORS, CHART_COLORS } from '@/lib/utils/colors'
import { formatShortDate } from '@/lib/utils/formatters'

interface VisibilityLineChartProps {
  data: TimeseriesRow[]
  groupKey?: 'platform' | 'topic'
  height?: number
  yLabel?: string
}

function pivot(data: TimeseriesRow[], groupKey: 'platform' | 'topic') {
  const map = new Map<string, Record<string, number>>()
  const keys = new Set<string>()

  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = (row as any)[groupKey] as string | undefined ?? 'Unknown'
    const entry = map.get(row.date) ?? {}
    entry[group] = row.value
    map.set(row.date, entry)
    keys.add(group)
  }

  return {
    chartData: Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals })),
    keys: Array.from(keys),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtVal = ((val: any, name: string) => [`${Number(val).toFixed(1)}%`, name]) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtLabel = (label: any) => formatShortDate(String(label))

export default function VisibilityLineChart({
  data,
  groupKey = 'platform',
  height = 280,
  yLabel,
}: VisibilityLineChartProps) {
  const { chartData, keys } = pivot(data, groupKey)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={v => `${v.toFixed(0)}%`}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 } : undefined}
        />
        <Tooltip
          formatter={fmtVal}
          labelFormatter={fmtLabel}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            stroke={
              groupKey === 'platform'
                ? (PLATFORM_COLORS[k] ?? CHART_COLORS[i % CHART_COLORS.length])
                : CHART_COLORS[i % CHART_COLORS.length]
            }
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
