'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatShortDate } from '@/lib/utils/formatters'

interface Props {
  timeseries: { date: string; value: number }[]
}

const cardStyle = { background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }
const labelStyle = { color: 'rgba(26,25,21,0.45)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }

export default function ClaygentSection({ timeseries }: Props) {
  return (
    <div className="p-5" style={cardStyle}>
      <h2 style={labelStyle} className="mb-1">ClayMCP & Agent Mention Rate</h2>
      <p className="text-[11px] font-semibold mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
        % of AI responses that mention ClayMCP or Clay Agent
      </p>
      {timeseries.length > 1 ? (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={timeseries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,25,21,0.06)" />
            <XAxis dataKey="date" tickFormatter={formatShortDate}
              tick={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(26,25,21,0.4)' }}
              tickLine={false} axisLine={false} />
            <YAxis tickFormatter={v => `${Number(v).toFixed(0)}%`}
              tick={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(26,25,21,0.4)' }}
              tickLine={false} axisLine={false} width={36} domain={[0, 'auto']} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(val: any) => [`${Number(val).toFixed(1)}%`, 'ClayMCP / Agent mentions']}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              labelFormatter={(l: any) => formatShortDate(String(l))}
              contentStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', border: '1px solid var(--clay-border-dashed)', borderRadius: '8px' }}
            />
            <Line type="monotone" dataKey="value" stroke="#4A5AFF" strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0, fill: '#4A5AFF' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : timeseries.length === 1 ? (
        <div className="py-6 text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--clay-black)' }}>{timeseries[0].value.toFixed(1)}%</p>
          <p style={{ ...labelStyle, marginTop: '4px' }}>Only 1 data point — run again tomorrow to see a trend</p>
        </div>
      ) : (
        <p className="py-6 text-center text-[12px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>No ClayMCP / Agent mention data</p>
      )}
    </div>
  )
}
