'use client'

import { useEffect, useState } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import { getLatestInsight, getActiveAnomalies } from '@/lib/queries/home'
import { getVisibilityScore, getDataFreshnessStats, getClayOverallTimeseries, getCompetitorLeaderboard } from '@/lib/queries/visibility'
import { getSentimentBreakdown } from '@/lib/queries/sentiment'
import { getCitationShare } from '@/lib/queries/citations'
import { getAvgPosition } from '@/lib/queries/visibility'
import type { InsightRow, AnomalyRow, CompetitorRow } from '@/lib/queries/types'
import InsightCard from '@/components/cards/InsightCard'
import AnomalyAlert from '@/components/cards/AnomalyAlert'
import KpiCard from '@/components/cards/KpiCard'
import { SkeletonCard, SkeletonChart } from '@/components/shared/Skeleton'
import { formatDate, formatShortDate } from '@/lib/utils/formatters'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export default function HomePage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [insight, setInsight] = useState<InsightRow | null>(null)
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([])
  const [visibility, setVisibility] = useState<{ current: number | null; previous: number | null; total: number } | null>(null)
  const [sentiment, setSentiment] = useState<{ positive: number | null } | null>(null)
  const [citationShare, setCitationShare] = useState<{ current: number | null; previous: number | null } | null>(null)
  const [avgPos, setAvgPos] = useState<{ current: number | null; previous: number | null } | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([])
  const [sparkData, setSparkData] = useState<{ date: string; value: number }[]>([])
  const [freshness, setFreshness] = useState<{ lastRunDate: string | null; promptCount: number; platformCount: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getLatestInsight(supabase),
      getActiveAnomalies(supabase),
      getVisibilityScore(supabase, f),
      getSentimentBreakdown(supabase, f),
      getCitationShare(supabase, f),
      getAvgPosition(supabase, f),
      getCompetitorLeaderboard(supabase, f),
      getClayOverallTimeseries(supabase, f),
      getDataFreshnessStats(supabase),
    ]).then(([ins, ano, vis, sent, cit, pos, comp, spark, fresh]) => {
      setInsight(ins)
      setAnomalies(ano)
      setVisibility(vis)
      setSentiment({ positive: sent.positive })
      setCitationShare(cit)
      setAvgPos(pos)
      setCompetitors((comp as CompetitorRow[]).slice(0, 6))
      setFreshness(fresh)
      setSparkData(spark)

      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter])

  function visDelta() {
    if (!visibility?.current || !visibility?.previous) return null
    return visibility.current - visibility.previous
  }
  function citDelta() {
    if (!citationShare?.current || !citationShare?.previous) return null
    return citationShare.current - citationShare.previous
  }
  function posDelta() {
    if (!avgPos?.current || !avgPos?.previous) return null
    return avgPos.current - avgPos.previous
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--clay-black)', letterSpacing: '-0.03em' }}>Good morning</h1>
          <p className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: 'rgba(26,25,21,0.45)' }}>Here&apos;s what happened with Clay&apos;s AI visibility</p>
        </div>
      </div>

      {/* Insight */}
      <InsightCard insight={insight} />

      {/* Anomaly alerts */}
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(26,25,21,0.45)' }}>Alerts</h2>
        <AnomalyAlert
          anomalies={anomalies}
          onDismiss={id => setAnomalies(prev => prev.filter(a => a.id !== id))}
        />
      </div>

      {/* KPI row */}
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(26,25,21,0.45)' }}>Key Metrics</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Visibility Score"
              value={visibility?.current != null ? `${visibility.current.toFixed(1)}%` : '—'}
              delta={visDelta()}
            />
            <KpiCard
              label="Citation Share"
              value={citationShare?.current != null ? `${citationShare.current.toFixed(1)}%` : '—'}
              delta={citDelta()}
            />
            <KpiCard
              label="Avg Position"
              value={avgPos?.current != null ? `#${avgPos.current.toFixed(1)}` : '—'}
              delta={posDelta()}
              invertDelta
            />
            <KpiCard
              label="Positive Sentiment %"
              value={sentiment?.positive != null ? `${sentiment.positive.toFixed(1)}%` : '—'}
              delta={null}
              deltaLabel="of Clay mentions"
            />
            <KpiCard
              label="Total Prompts"
              value={visibility?.total != null ? visibility.total.toLocaleString() : '—'}
              delta={null}
              deltaLabel="in period"
            />
          </div>
        )}
      </div>

      {/* Sparkline + top competitor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 p-4" style={{ background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(26,25,21,0.45)' }}>Visibility Score — 7-day trend</h3>
          {loading ? (
            <SkeletonChart />
          ) : sparkData.length > 1 ? (
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,25,21,0.06)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 10, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(26,25,21,0.4)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={v => `${Number(v).toFixed(0)}%`}
                  tick={{ fontSize: 10, fontFamily: 'Plus Jakarta Sans', fill: 'rgba(26,25,21,0.4)' }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  domain={[0, 100]}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [`${Number(val).toFixed(1)}%`, 'Visibility']}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(l: any) => formatShortDate(String(l))}
                  contentStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', border: '1px solid var(--clay-border-dashed)', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="value" stroke="var(--clay-black)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: 'var(--clay-black)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : sparkData.length === 1 ? (
            <div className="py-6 text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--clay-black)' }}>{sparkData[0].value.toFixed(1)}%</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(26,25,21,0.4)' }}>Only 1 data point — run again tomorrow to see a trend</p>
            </div>
          ) : (
            <p className="text-xs font-bold py-6 text-center" style={{ color: 'rgba(26,25,21,0.35)' }}>No trend data yet</p>
          )}
        </div>

        <div className="p-4" style={{ background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }}>
          <h3 className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'rgba(26,25,21,0.45)' }}>Top Competitors</h3>
          {loading ? (
            <SkeletonCard />
          ) : competitors.length > 0 ? (
            <table className="w-full">
              <tbody>
                {competitors.map((row, idx) => (
                  <tr key={row.competitor_name} style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                    <td className="py-1.5 text-[11px] font-bold tabular-nums" style={{ color: 'rgba(26,25,21,0.3)', width: '20px' }}>{idx + 1}</td>
                    <td className="py-1.5 text-[13px] font-semibold" style={{ color: 'var(--clay-black)' }}>{row.competitor_name}</td>
                    <td className="py-1.5 text-right text-[13px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                      {(row.visibility_score ?? row.sov_pct).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs font-bold" style={{ color: 'rgba(26,25,21,0.35)' }}>No competitor data</p>
          )}
        </div>
      </div>

      {/* Data freshness */}
      {freshness && (
        <div className="text-[10px] font-bold uppercase tracking-wider pt-4" style={{ borderTop: '1px solid var(--clay-border)', color: 'rgba(26,25,21,0.35)' }}>
          Last ingestion: {freshness.lastRunDate ? formatDate(freshness.lastRunDate) : '—'} —{' '}
          {freshness.promptCount} prompts × {freshness.platformCount} platform{freshness.platformCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
