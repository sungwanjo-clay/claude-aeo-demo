'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { SENTIMENT_COLORS } from '@/lib/utils/colors'

interface SentimentBarData {
  name: string
  Positive: number
  Neutral: number
  Negative: number
}

interface SentimentStackedBarProps {
  data: SentimentBarData[]
  height?: number
}

export default function SentimentStackedBar({ data, height = 200 }: SentimentStackedBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Tooltip formatter={(val: any) => [`${Number(val).toFixed(1)}%`]} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Positive" stackId="a" fill={SENTIMENT_COLORS.Positive} radius={[0, 0, 0, 0]} />
        <Bar dataKey="Neutral" stackId="a" fill={SENTIMENT_COLORS.Neutral} />
        <Bar dataKey="Negative" stackId="a" fill={SENTIMENT_COLORS.Negative} radius={[0, 2, 2, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
