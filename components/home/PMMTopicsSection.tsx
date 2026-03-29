'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatShortDate } from '@/lib/utils/formatters'
import { CHART_COLORS } from '@/lib/utils/colors'

interface TimeseriesRow { date: string; value: number; pmm_use_case?: string }
interface PMMRow {
  pmm_use_case: string
  visibility_score: number
  delta: number | null
  total_responses: number
  timeseries: { date: string; value: number }[]
}
interface PromptDrillRow {
  prompt_id: string
  prompt_text: string
  visibility_pct: number
  avg_position: number | null
  response_count: number
}

interface Props {
  series: TimeseriesRow[]
  table: PMMRow[]
  compareEnabled: boolean
  onDrilldown: (pmmUseCase: string) => Promise<PromptDrillRow[]>
}

const cardStyle = { background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }
const labelStyle = { color: 'rgba(26,25,21,0.45)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }

function buildChartData(series: TimeseriesRow[]) {
  const groups = [...new Set(series.map(r => r.pmm_use_case).filter(Boolean))]
  const dates = [...new Set(series.map(r => r.date))].sort()
  const lookup = new Map(series.map(r => [`${r.date}|||${r.pmm_use_case}`, r.value]))
  return dates.map(date => {
    const row: Record<string, string | number> = { date }
    for (const g of groups) row[g!] = lookup.get(`${date}|||${g}`) ?? 0
    return row
  })
}

export default function PMMTopicsSection({ series, table, compareEnabled, onDrilldown }: Props) {
  const [expandedPMM, setExpandedPMM] = useState<string | null>(null)
  const [drillRows, setDrillRows] = useState<Record<string, PromptDrillRow[]>>({})
  const [loadingDrill, setLoadingDrill] = useState<string | null>(null)

  const groups = [...new Set(series.map(r => r.pmm_use_case).filter(Boolean))]
  const chartData = buildChartData(series)

  async function toggleDrill(pmm: string) {
    if (expandedPMM === pmm) { setExpandedPMM(null); return }
    setExpandedPMM(pmm)
    if (!drillRows[pmm]) {
      setLoadingDrill(pmm)
      const rows = await onDrilldown(pmm)
      setDrillRows(prev => ({ ...prev, [pmm]: rows }))
      setLoadingDrill(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Line chart */}
      <div className="p-5" style={cardStyle}>
        <h2 style={labelStyle} className="mb-4">Visibility by PMM Solution</h2>
        {chartData.length > 0 && groups.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,25,21,0.06)" />
              <XAxis dataKey="date" tickFormatter={formatShortDate}
                tick={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(26,25,21,0.4)' }}
                tickLine={false} axisLine={false} />
              <YAxis tickFormatter={v => `${Number(v).toFixed(0)}%`}
                tick={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(26,25,21,0.4)' }}
                tickLine={false} axisLine={false} width={36} domain={[0, 100]} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(l: any) => formatShortDate(String(l))}
                contentStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', border: '1px solid var(--clay-border-dashed)', borderRadius: '8px' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans' }} />
              {groups.map((g, i) => (
                <Line key={g} type="monotone" dataKey={g!}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1.8}
                  dot={{ r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-[12px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>No PMM use case data</p>
        )}
      </div>

      {/* Table */}
      <div className="p-5" style={cardStyle}>
        <h2 style={labelStyle} className="mb-4">PMM Breakdown — click to drill into prompts</h2>
        {table.length === 0 ? (
          <p className="py-6 text-center text-[12px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>No PMM data</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--clay-border-dashed)' }}>
                <th className="pb-2 text-left" style={labelStyle}>PMM Solution</th>
                <th className="pb-2 text-right" style={labelStyle}>Visibility</th>
                {compareEnabled && <th className="pb-2 text-right" style={labelStyle}>vs Prev</th>}
                <th className="pb-2 text-right" style={labelStyle}>Responses</th>
                <th className="pb-2" style={{ width: '24px' }} />
              </tr>
            </thead>
            <tbody>
              {table.map(row => {
                const isUp = row.delta != null ? row.delta > 0 : null
                const expanded = expandedPMM === row.pmm_use_case
                const drill = drillRows[row.pmm_use_case]
                return (
                  <React.Fragment key={row.pmm_use_case}>
                    <tr
                      onClick={() => toggleDrill(row.pmm_use_case)}
                      className="cursor-pointer hover:bg-[rgba(26,25,21,0.02)] transition-colors"
                      style={{ borderBottom: expanded ? 'none' : '1px solid rgba(26,25,21,0.05)' }}
                    >
                      <td className="py-2.5 text-[13px] font-semibold" style={{ color: 'var(--clay-black)' }}>{row.pmm_use_case}</td>
                      <td className="py-2.5 text-right text-[13px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                        {row.visibility_score.toFixed(1)}%
                      </td>
                      {compareEnabled && (
                        <td className="py-2.5 text-right">
                          {row.delta != null ? (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5"
                              style={{ borderRadius: '4px', background: isUp ? 'var(--clay-lime)' : '#FFE0DD', color: isUp ? 'var(--clay-black)' : 'var(--clay-pomegranate)' }}>
                              {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {isUp ? '+' : ''}{row.delta!.toFixed(1)}%
                            </span>
                          ) : <span style={{ color: 'rgba(26,25,21,0.3)', fontSize: '11px' }}>—</span>}
                        </td>
                      )}
                      <td className="py-2.5 text-right text-[12px] font-semibold tabular-nums" style={{ color: 'rgba(26,25,21,0.5)' }}>
                        {row.total_responses.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-center">
                        {expanded
                          ? <ChevronDown size={12} style={{ color: 'rgba(26,25,21,0.4)' }} />
                          : <ChevronRight size={12} style={{ color: 'rgba(26,25,21,0.4)' }} />}
                      </td>
                    </tr>
                    {expanded && (
                      <tr style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                        <td colSpan={compareEnabled ? 5 : 4} style={{ paddingBottom: '8px' }}>
                          <div className="ml-4 rounded-lg overflow-hidden" style={{ background: 'rgba(26,25,21,0.02)', border: '1px solid rgba(26,25,21,0.06)' }}>
                            {loadingDrill === row.pmm_use_case ? (
                              <p className="px-3 py-4 text-[11px] font-semibold" style={{ color: 'rgba(26,25,21,0.4)' }}>Loading prompts…</p>
                            ) : !drill || drill.length === 0 ? (
                              <p className="px-3 py-4 text-[11px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>No prompt data</p>
                            ) : (
                              <table className="w-full">
                                <thead>
                                  <tr style={{ borderBottom: '1px solid rgba(26,25,21,0.06)' }}>
                                    <th className="px-3 py-1.5 text-left" style={{ ...labelStyle, fontSize: '9px' }}>Prompt</th>
                                    <th className="px-3 py-1.5 text-right" style={{ ...labelStyle, fontSize: '9px' }}>Visibility</th>
                                    <th className="px-3 py-1.5 text-right" style={{ ...labelStyle, fontSize: '9px' }}>Avg Pos</th>
                                    <th className="px-3 py-1.5 text-right" style={{ ...labelStyle, fontSize: '9px' }}>Responses</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {drill.map(p => (
                                    <tr key={p.prompt_id} style={{ borderBottom: '1px solid rgba(26,25,21,0.04)' }}>
                                      <td className="px-3 py-2 text-[12px] font-semibold max-w-md" style={{ color: 'var(--clay-black)' }}>
                                        {p.prompt_text}
                                      </td>
                                      <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                                        {p.visibility_pct.toFixed(1)}%
                                      </td>
                                      <td className="px-3 py-2 text-right text-[12px] tabular-nums" style={{ color: 'rgba(26,25,21,0.6)' }}>
                                        {p.avg_position != null ? `#${p.avg_position.toFixed(1)}` : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right text-[12px] tabular-nums" style={{ color: 'rgba(26,25,21,0.5)' }}>
                                        {p.response_count}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
