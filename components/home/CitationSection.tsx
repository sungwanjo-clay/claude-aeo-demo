'use client'

import React, { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatShortDate } from '@/lib/utils/formatters'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

interface CitationTimepoint { date: string; value: number }
interface DomainRow {
  domain: string
  citation_count: number
  share_pct: number
  is_clay: boolean
  top_urls: { url: string; title: string | null; count: number }[]
}

interface Props {
  timeseries: CitationTimepoint[]
  domains: DomainRow[]
}

const cardStyle = { background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }
const labelStyle = { color: 'rgba(26,25,21,0.45)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }

export default function CitationSection({ timeseries, domains }: Props) {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const visibleDomains = showAll ? domains : domains.slice(0, 8)

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="p-5" style={cardStyle}>
        <h2 style={labelStyle} className="mb-4">Citation Share Over Time</h2>
        {timeseries.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
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
                formatter={(val: any) => [`${Number(val).toFixed(1)}%`, 'Clay Citation Share']}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(l: any) => formatShortDate(String(l))}
                contentStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', border: '1px solid var(--clay-border-dashed)', borderRadius: '8px' }}
              />
              <Line type="monotone" dataKey="value" stroke="var(--clay-black)" strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: 'var(--clay-black)' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : timeseries.length === 1 ? (
          <div className="py-8 text-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--clay-black)' }}>{timeseries[0].value.toFixed(1)}%</p>
            <p style={{ ...labelStyle, marginTop: '4px' }}>Only 1 data point — run again tomorrow to see a trend</p>
          </div>
        ) : (
          <p className="py-8 text-center text-[12px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>No citation data</p>
        )}
      </div>

      {/* Domain table */}
      <div className="p-5" style={cardStyle}>
        <h2 style={labelStyle} className="mb-4">Top Cited Domains</h2>
        {domains.length === 0 ? (
          <p className="py-6 text-center text-[12px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>No citation domain data</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--clay-border-dashed)' }}>
                  <th className="pb-2 text-left" style={{ ...labelStyle, width: '28px' }}>#</th>
                  <th className="pb-2 text-left" style={labelStyle}>Domain</th>
                  <th className="pb-2 text-right" style={labelStyle}>Citations</th>
                  <th className="pb-2 text-right" style={labelStyle}>Share</th>
                  <th className="pb-2" style={{ width: '24px' }} />
                </tr>
              </thead>
              <tbody>
                {visibleDomains.map((row, idx) => (
                  <React.Fragment key={row.domain}>
                    <tr
                      onClick={() => setExpandedDomain(expandedDomain === row.domain ? null : row.domain)}
                      className="cursor-pointer hover:bg-[rgba(26,25,21,0.02)] transition-colors"
                      style={{
                        borderBottom: expandedDomain === row.domain ? 'none' : '1px solid rgba(26,25,21,0.05)',
                        background: row.is_clay ? 'rgba(200,240,64,0.06)' : 'transparent',
                      }}
                    >
                      <td className="py-2.5 text-[12px] font-bold" style={{ color: 'rgba(26,25,21,0.3)' }}>{idx + 1}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--clay-black)' }}>{row.domain}</span>
                          {row.is_clay && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                              style={{ background: 'var(--clay-lime)', color: 'var(--clay-black)', borderRadius: '4px' }}>
                              Owned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-[13px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                        {row.citation_count.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-[13px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                        {row.share_pct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 text-center">
                        {row.top_urls.length > 0 && (
                          expandedDomain === row.domain
                            ? <ChevronDown size={12} style={{ color: 'rgba(26,25,21,0.4)' }} />
                            : <ChevronRight size={12} style={{ color: 'rgba(26,25,21,0.4)' }} />
                        )}
                      </td>
                    </tr>
                    {expandedDomain === row.domain && row.top_urls.length > 0 && (
                      <tr style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                        <td colSpan={5} style={{ paddingBottom: '8px' }}>
                          <div className="ml-6 rounded-lg overflow-hidden" style={{ background: 'rgba(26,25,21,0.02)', border: '1px solid rgba(26,25,21,0.06)' }}>
                            <table className="w-full">
                              <thead>
                                <tr style={{ borderBottom: '1px solid rgba(26,25,21,0.06)' }}>
                                  <th className="px-3 py-1.5 text-left" style={{ ...labelStyle, fontSize: '9px' }}>URL</th>
                                  <th className="px-3 py-1.5 text-right" style={{ ...labelStyle, fontSize: '9px' }}>Count</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.top_urls.map(u => (
                                  <tr key={u.url} style={{ borderBottom: '1px solid rgba(26,25,21,0.04)' }}>
                                    <td className="px-3 py-2">
                                      <a href={u.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-start gap-1.5 group"
                                        onClick={e => e.stopPropagation()}>
                                        <ExternalLink size={10} className="mt-0.5 shrink-0 opacity-40 group-hover:opacity-70" />
                                        <div>
                                          {u.title && (
                                            <p className="text-[12px] font-semibold group-hover:underline" style={{ color: 'var(--clay-black)' }}>
                                              {u.title}
                                            </p>
                                          )}
                                          <p className="text-[10px] truncate max-w-md" style={{ color: 'rgba(26,25,21,0.45)' }}>{u.url}</p>
                                        </div>
                                      </a>
                                    </td>
                                    <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                                      {u.count}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {domains.length > 8 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="mt-3 w-full py-2 text-[11px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
                style={{ border: '1px solid var(--clay-border-dashed)', borderRadius: '6px', color: 'rgba(26,25,21,0.5)' }}
              >
                {showAll ? 'Show less ↑' : `Show all ${domains.length} domains`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
