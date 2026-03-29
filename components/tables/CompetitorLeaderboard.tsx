'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { CompetitorRow } from '@/lib/queries/types'

interface CompetitorLeaderboardProps {
  data: CompetitorRow[]
  compareEnabled?: boolean
}

export default function CompetitorLeaderboard({ data, compareEnabled = false }: CompetitorLeaderboardProps) {
  const [expanded, setExpanded] = useState(false)
  const rows = expanded ? data : data.slice(0, 5)

  if (!data.length) {
    return (
      <div className="p-8 text-center text-[12px] font-semibold" style={{ color: 'rgba(26,25,21,0.35)' }}>
        No competitor data for this period
      </div>
    )
  }

  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--clay-border-dashed)' }}>
            <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider w-10" style={{ color: 'rgba(26,25,21,0.4)' }}>#</th>
            <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(26,25,21,0.4)' }}>Competitor</th>
            <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(26,25,21,0.4)' }}>Visibility</th>
            {compareEnabled && (
              <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(26,25,21,0.4)' }}>vs Prev</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isUp = row.delta != null ? row.delta > 0 : null
            return (
              <tr key={row.competitor_name} style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                <td className="py-2.5 text-[12px] font-bold" style={{ color: 'rgba(26,25,21,0.35)', width: '32px' }}>
                  {idx + 1}
                </td>
                <td className="py-2.5 font-semibold" style={{ color: 'var(--clay-black)' }}>
                  {row.competitor_name}
                </td>
                <td className="py-2.5 text-right font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                  {(row.visibility_score ?? row.sov_pct).toFixed(1)}%
                </td>
                {compareEnabled && (
                  <td className="py-2.5 text-right">
                    {row.delta != null ? (
                      <span
                        className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5"
                        style={{
                          borderRadius: '4px',
                          background: isUp ? 'var(--clay-lime)' : '#FFE0DD',
                          color: isUp ? 'var(--clay-black)' : 'var(--clay-pomegranate)',
                        }}
                      >
                        {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {isUp ? '+' : ''}{row.delta.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: 'rgba(26,25,21,0.3)' }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {data.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[11px] font-bold uppercase tracking-wider hover:opacity-60 transition-opacity"
          style={{ color: 'rgba(26,25,21,0.5)' }}
        >
          {expanded ? 'Show less ↑' : `Show all ${data.length} competitors ↓`}
        </button>
      )}
    </div>
  )
}
