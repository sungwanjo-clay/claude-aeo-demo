'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { PLATFORM_COLORS } from '@/lib/utils/colors'

interface SparkPoint {
  date: string
  [platform: string]: string | number
}

interface SparklineChartProps {
  data: SparkPoint[]
  platforms: string[]
  height?: number
}

export default function SparklineChart({ data, platforms, height = 48 }: SparklineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Tooltip
          contentStyle={{ fontSize: 11, padding: '4px 8px' }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(val: any) => [`${Number(val).toFixed(1)}%`]}
        />
        {platforms.map(p => (
          <Line
            key={p}
            type="monotone"
            dataKey={p}
            stroke={PLATFORM_COLORS[p] ?? '#6b7280'}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
