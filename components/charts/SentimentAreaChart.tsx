'use client'

import { useState } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { SENTIMENT_COLORS } from '@/lib/utils/colors'
import { formatShortDate } from '@/lib/utils/formatters'

interface SentimentPoint {
  date: string
  positive: number
  neutral: number
  negative: number
}

interface SentimentAreaChartProps {
  data: SentimentPoint[]
  height?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtVal = ((val: any, name: string) => [`${Number(val).toFixed(1)}%`, name]) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtLabel = (label: any) => formatShortDate(String(label))

export default function SentimentAreaChart({ data, height = 280 }: SentimentAreaChartProps) {
  const [stacked, setStacked] = useState(true)

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setStacked(s => !s)}
          className="text-xs border border-gray-200 rounded-md px-2.5 py-1 text-gray-600 hover:bg-gray-50"
        >
          {stacked ? 'Switch to lines' : 'Switch to stacked'}
        </button>
      </div>

      {stacked ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={fmtVal} labelFormatter={fmtLabel} />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="positive" name="Positive" stackId="1" stroke={SENTIMENT_COLORS.Positive} fill={SENTIMENT_COLORS.Positive} fillOpacity={0.3} />
            <Area type="monotone" dataKey="neutral" name="Neutral" stackId="1" stroke={SENTIMENT_COLORS.Neutral} fill={SENTIMENT_COLORS.Neutral} fillOpacity={0.3} />
            <Area type="monotone" dataKey="negative" name="Negative" stackId="1" stroke={SENTIMENT_COLORS.Negative} fill={SENTIMENT_COLORS.Negative} fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={fmtVal} labelFormatter={fmtLabel} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="positive" name="Positive" stroke={SENTIMENT_COLORS.Positive} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="neutral" name="Neutral" stroke={SENTIMENT_COLORS.Neutral} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="negative" name="Negative" stroke={SENTIMENT_COLORS.Negative} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
