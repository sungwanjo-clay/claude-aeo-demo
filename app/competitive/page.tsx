'use client'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { useEffect, useState } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import {
  getCompetitorList,
  getCompetitorKPIs,
  getPlatformHeatmap,
  getCompetitorVsClayTimeseries,
  getClaygentMcpStats,
  getWinnersAndLosers,
  getCompetitorByPMMTopic,
  getCompetitorCoCitedDomains,
} from '@/lib/queries/competitive'
import KpiCard from '@/components/cards/KpiCard'
import HeatmapMatrix from '@/components/charts/HeatmapMatrix'
import { SkeletonCard, SkeletonChart } from '@/components/shared/Skeleton'
import { getPlatformColor } from '@/lib/utils/colors'
import { CHART_COLORS } from '@/lib/utils/colors'
import MetricTooltip from '@/components/shared/MetricTooltip'
import { formatShortDate } from '@/lib/utils/formatters'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts'

const LABEL_STYLE = {
  color: 'rgba(26,25,21,0.45)',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}

const CARD_STYLE = {
  background: '#FFFFFF',
  border: '1px solid var(--clay-border)',
  borderRadius: '8px',
}

interface HeatmapCell { competitor: string; platform: string; visibility_score: number }
interface CompKPIs {
  visibilityScore: number | null
  mentionCount: number
  avgPosition: number | null
  topTopic: string | null
  topPlatform: string | null
  deltaVisibility: number | null
}
interface CompTimeseries { date: string; clay: number; competitor: number }
interface WinnerLoser {
  competitor_name: string
  current: number
  previous: number | null
  delta: number | null
  isNew: boolean
}
interface PMMTopic { pmm_use_case: string; visibility_score: number; mention_count: number }
interface CoCitedDomain { domain: string; count: number; share_pct: number; is_own_domain: boolean }
interface ClaygentStats {
  rate: number | null
  byPlatform: { platform: string; rate: number }[]
  byTopic: { topic: string; rate: number }[]
  snippets: { platform: string; topic: string; snippet: string; prompt_text: string; run_date: string }[]
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span style={{ color: 'rgba(26,25,21,0.35)', fontSize: '11px' }}>—</span>
  const positive = delta >= 0
  return (
    <span
      style={{
        background: positive ? 'var(--clay-lime)' : '#FFE0DD',
        color: positive ? 'var(--clay-black)' : 'var(--clay-pomegranate)',
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '11px',
        fontWeight: 700,
      }}
    >
      {positive ? '+' : ''}{delta.toFixed(1)}%
    </span>
  )
}

export default function CompetitivePage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [loadingExtra, setLoadingExtra] = useState(true)

  const [competitors, setCompetitors] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('')

  const [compKPIs, setCompKPIs] = useState<CompKPIs | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [compTs, setCompTs] = useState<CompTimeseries[]>([])
  const [claygent, setClaygent] = useState<ClaygentStats | null>(null)
  const [winnersLosers, setWinnersLosers] = useState<WinnerLoser[]>([])

  const [pmmTopics, setPmmTopics] = useState<PMMTopic[]>([])
  const [coCited, setCoCited] = useState<CoCitedDomain[]>([])

  const [showAllHeatmap, setShowAllHeatmap] = useState(false)
  const [showAllDomains, setShowAllDomains] = useState(false)

  // Load competitor list once
  useEffect(() => {
    getCompetitorList(supabase).then(list => {
      setCompetitors(list)
      if (list.length > 0 && !selected) setSelected(list[0])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Effect 1 (fast): KPIs, timeseries, winners/losers, heatmap, claygent
  useEffect(() => {
    if (!selected) return
    setLoading(true)
    Promise.all([
      getPlatformHeatmap(supabase, f),
      getClaygentMcpStats(supabase, f),
      getCompetitorKPIs(supabase, f, selected),
      getCompetitorVsClayTimeseries(supabase, f, selected),
      getWinnersAndLosers(supabase, f),
    ]).then(([heat, cg, kpis, ts, wl]) => {
      setHeatmap(heat)
      setClaygent(cg)
      setCompKPIs(kpis)
      setCompTs(ts as CompTimeseries[])
      setWinnersLosers(wl as WinnerLoser[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter, selected])

  // Effect 2 (slow/extra): PMM topics, co-cited domains
  useEffect(() => {
    if (!selected) return
    setLoadingExtra(true)
    Promise.all([
      getCompetitorByPMMTopic(supabase, f, selected),
      getCompetitorCoCitedDomains(supabase, f, selected),
    ]).then(([pmm, coCitedData]) => {
      setPmmTopics(pmm as PMMTopic[])
      setCoCited(coCitedData as CoCitedDomain[])
      setLoadingExtra(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter, selected])

  const tsData = compTs.map(r => ({
    date: r.date,
    Clay: parseFloat(r.clay.toFixed(1)),
    [selected]: parseFloat(r.competitor.toFixed(1)),
  }))

  // Winners & Losers
  const winners = winnersLosers.filter(r => (r.delta ?? 0) >= 0).slice(0, 5)
  const losers = [...winnersLosers].reverse().filter(r => (r.delta ?? 0) < 0).slice(0, 5)
  const emerging = winnersLosers.filter(r => r.isNew)

  // Heatmap data with 50-row limit
  const heatmapCompetitors = [...new Set(heatmap.map(d => d.competitor))].sort((a, b) => {
    const aScore = heatmap.filter(d => d.competitor === a).reduce((s, r) => s + r.visibility_score, 0)
    const bScore = heatmap.filter(d => d.competitor === b).reduce((s, r) => s + r.visibility_score, 0)
    return bScore - aScore
  })
  const limitedHeatmapCompetitors = showAllHeatmap ? heatmapCompetitors : heatmapCompetitors.slice(0, 50)
  const filteredHeatmap = heatmap.filter(d => limitedHeatmapCompetitors.includes(d.competitor))

  // Domains display
  const displayedDomains = showAllDomains ? coCited : coCited.slice(0, 10)

  // PMM bar chart height
  const pmmChartHeight = Math.max(200, pmmTopics.length * 40)

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">

      {/* Header + Competitor Selector */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--clay-black)' }}>Competitive Intelligence</h1>
        <p className="text-sm" style={{ color: 'rgba(26,25,21,0.55)' }}>
          How do competitors compare to Clay in AI visibility — and where are the gaps?
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span style={LABEL_STYLE}>Analyzing competitor:</span>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{
              border: '1px solid var(--clay-border)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--clay-black)',
              background: '#FFFFFF',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {competitors.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : compKPIs ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Visibility Score"
            value={compKPIs.visibilityScore != null ? `${compKPIs.visibilityScore.toFixed(1)}%` : '—'}
            delta={compKPIs.deltaVisibility}
            deltaLabel="vs prev period"
          />
          <KpiCard
            label="Mention Count"
            value={compKPIs.mentionCount.toLocaleString()}
            delta={null}
            deltaLabel="total mentions"
          />
          <KpiCard
            label="Avg Position"
            value={compKPIs.avgPosition != null ? `#${compKPIs.avgPosition.toFixed(1)}` : '—'}
            delta={null}
            deltaLabel={selected}
          />
          <div style={CARD_STYLE} className="p-5 flex flex-col gap-2">
            <div style={LABEL_STYLE}>Top Topic</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--clay-black)', letterSpacing: '-0.02em' }}>
              {compKPIs.topTopic ?? '—'}
            </div>
            <div style={{ color: 'rgba(26,25,21,0.35)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {compKPIs.topPlatform ?? ''}
            </div>
          </div>
        </div>
      ) : null}

      {/* Visibility vs Clay Chart + Winners/Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Visibility Trend Chart (2/3 width) */}
        <div style={CARD_STYLE} className="p-4 lg:col-span-2">
          <div style={LABEL_STYLE} className="mb-3">Clay vs. {selected} — Visibility Over Time</div>
          {loading ? <SkeletonChart /> : tsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,32,38,0.06)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: any) => formatShortDate(v)}
                  tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.45)' }}
                />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.45)' }} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(val: any) => `${Number(val).toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="Clay" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={selected} stroke="#4A5AFF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
              No timeseries data available
            </div>
          )}
        </div>

        {/* Winners & Losers placeholder in grid */}
        <div style={CARD_STYLE} className="p-4">
          <div style={LABEL_STYLE} className="mb-3">Movers This Period</div>
          {loading ? <SkeletonCard /> : (
            <div className="space-y-3">
              {/* Winners */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <span style={{ ...LABEL_STYLE, color: '#3DAA6A' }}>Winners</span>
                </div>
                {winners.length === 0 ? (
                  <p style={{ color: 'rgba(26,25,21,0.35)', fontSize: '12px' }}>No winners this period</p>
                ) : winners.map((w, i) => (
                  <div key={w.competitor_name} className="flex items-center gap-2 py-1">
                    <span style={{ color: 'rgba(26,25,21,0.35)', fontSize: '11px', width: '14px' }}>{i + 1}</span>
                    <span
                      className="flex-1 truncate text-xs font-medium"
                      style={{ color: 'var(--clay-black)' }}
                    >
                      {w.competitor_name}
                      {w.isNew && (
                        <span
                          className="ml-1"
                          style={{
                            background: 'var(--clay-lime)',
                            color: 'var(--clay-black)',
                            borderRadius: '3px',
                            padding: '1px 4px',
                            fontSize: '9px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          New
                        </span>
                      )}
                    </span>
                    <span style={{ color: 'rgba(26,25,21,0.55)', fontSize: '11px' }}>{w.current.toFixed(1)}%</span>
                    <DeltaBadge delta={w.delta} />
                  </div>
                ))}
              </div>

              {/* Losers */}
              <div className="pt-2" style={{ borderTop: '1px solid var(--clay-border)' }}>
                <div className="flex items-center gap-1 mb-2">
                  <span style={{ ...LABEL_STYLE, color: 'var(--clay-pomegranate)' }}>Losers</span>
                </div>
                {losers.length === 0 ? (
                  <p style={{ color: 'rgba(26,25,21,0.35)', fontSize: '12px' }}>No losers this period</p>
                ) : losers.map((w, i) => (
                  <div key={w.competitor_name} className="flex items-center gap-2 py-1">
                    <span style={{ color: 'rgba(26,25,21,0.35)', fontSize: '11px', width: '14px' }}>{i + 1}</span>
                    <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--clay-black)' }}>
                      {w.competitor_name}
                    </span>
                    <span style={{ color: 'rgba(26,25,21,0.55)', fontSize: '11px' }}>{w.current.toFixed(1)}%</span>
                    <DeltaBadge delta={w.delta} />
                  </div>
                ))}
              </div>

              {/* Emerging */}
              {emerging.length > 0 && (
                <div className="pt-2" style={{ borderTop: '1px solid var(--clay-border)' }}>
                  <div style={LABEL_STYLE} className="mb-2">Emerging Threats</div>
                  {emerging.slice(0, 4).map(w => (
                    <div key={w.competitor_name} className="flex items-center gap-2 py-1">
                      <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--clay-black)' }}>
                        {w.competitor_name}
                      </span>
                      <span style={{ color: 'rgba(26,25,21,0.55)', fontSize: '11px' }}>{w.current.toFixed(1)}%</span>
                      <span
                        style={{
                          background: 'var(--clay-lime)',
                          color: 'var(--clay-black)',
                          borderRadius: '3px',
                          padding: '1px 4px',
                          fontSize: '9px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        New
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visibility by PMM Topic */}
      <div style={CARD_STYLE} className="p-4">
        <div style={LABEL_STYLE} className="mb-1">Visibility by PMM Topic — {selected}</div>
        <p className="text-xs mb-3" style={{ color: 'rgba(26,25,21,0.45)' }}>
          How often {selected} appears in AI responses per use case category
        </p>
        {loadingExtra ? <SkeletonChart /> : pmmTopics.length === 0 ? (
          <div className="flex items-center justify-center py-12" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
            No PMM topic data available for {selected}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={pmmChartHeight}>
            <BarChart
              data={pmmTopics}
              layout="vertical"
              margin={{ top: 4, right: 60, left: 10, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(29,32,38,0.06)" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.45)' }}
                tickFormatter={(v: any) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="pmm_use_case"
                width={160}
                tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.55)' }}
              />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, 'Visibility Score']} />
              <Bar dataKey="visibility_score" fill="#4A5AFF" radius={[0, 3, 3, 0]}>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Domain Citation Analysis */}
      <div style={CARD_STYLE} className="p-4">
        <div style={LABEL_STYLE} className="mb-1">Domains Cited Alongside {selected}</div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          These domains frequently appear in the same AI responses that mention {selected}, indicating they are seen as authoritative sources in the same category.
        </p>
        {loadingExtra ? <SkeletonChart /> : coCited.length === 0 ? (
          <div className="flex items-center justify-center py-10" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
            No citation co-occurrence data available
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--clay-border)' }}>
                    <th className="text-left py-2 pr-3" style={LABEL_STYLE}>#</th>
                    <th className="text-left py-2 pr-3" style={LABEL_STYLE}>Domain</th>
                    <th className="text-right py-2 pr-3" style={LABEL_STYLE}>Count</th>
                    <th className="text-right py-2" style={LABEL_STYLE}>Share %</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDomains.map((d, i) => (
                    <tr
                      key={d.domain}
                      style={{
                        borderBottom: '1px solid rgba(29,32,38,0.06)',
                        background: d.is_own_domain ? 'rgba(200,240,64,0.08)' : 'transparent',
                      }}
                    >
                      <td className="py-2 pr-3" style={{ color: 'rgba(26,25,21,0.35)' }}>{i + 1}</td>
                      <td className="py-2 pr-3 font-medium" style={{ color: 'var(--clay-black)' }}>
                        {d.domain}
                        {d.is_own_domain && (
                          <span
                            className="ml-2"
                            style={{
                              background: 'var(--clay-lime)',
                              color: 'var(--clay-black)',
                              borderRadius: '3px',
                              padding: '1px 5px',
                              fontSize: '9px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                            }}
                          >
                            own
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'rgba(26,25,21,0.7)' }}>
                        {d.count.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums" style={{ color: 'rgba(26,25,21,0.55)' }}>
                        {d.share_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {coCited.length > 10 && (
              <button
                onClick={() => setShowAllDomains(v => !v)}
                className="mt-3 text-xs font-semibold"
                style={{ color: '#4A5AFF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showAllDomains ? 'Show fewer' : `Show all ${coCited.length} domains`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Platform Heatmap */}
      <div style={CARD_STYLE} className="p-4">
        <div style={LABEL_STYLE} className="mb-1">Platform Visibility Heatmap</div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          Visibility Score % per competitor per platform. Top 50 by visibility score. Clay row pinned to top.
        </p>
        {loading ? <SkeletonChart /> : (
          <>
            <HeatmapMatrix data={filteredHeatmap} />
            {heatmapCompetitors.length > 50 && (
              <button
                onClick={() => setShowAllHeatmap(v => !v)}
                className="mt-3 text-xs font-semibold"
                style={{ color: '#4A5AFF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showAllHeatmap ? 'Show top 50 only' : `Show all ${heatmapCompetitors.length} competitors`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Claygent & Clay MCP */}
      <div style={CARD_STYLE} className="p-4">
        <div className="mb-1 flex items-center gap-1" style={LABEL_STYLE}>
          Claygent &amp; Clay MCP Tracker
          <MetricTooltip text="% of responses that mention Claygent or Clay MCP as a tool or integration" />
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          Tracking mentions of Claygent and Clay MCP across platforms and topics
        </p>

        {loading ? <SkeletonCard /> : claygent && (
          <div className="space-y-4">
            <div
              className="inline-block"
              style={{ ...CARD_STYLE, padding: '10px 16px' }}
            >
              <p style={LABEL_STYLE}>Overall Rate</p>
              <p className="text-3xl font-bold" style={{ color: '#4A5AFF', letterSpacing: '-0.02em' }}>
                {claygent.rate != null ? `${claygent.rate.toFixed(1)}%` : '—'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p style={{ ...LABEL_STYLE, marginBottom: '8px' }}>By Platform</p>
                <div className="space-y-2">
                  {claygent.byPlatform.map(p => (
                    <div key={p.platform} className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white w-20 text-center"
                        style={{ backgroundColor: getPlatformColor(p.platform) }}
                      >
                        {p.platform}
                      </span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(29,32,38,0.08)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(p.rate, 100)}%`, background: '#4A5AFF' }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-10 text-right" style={{ color: 'rgba(26,25,21,0.7)' }}>
                        {p.rate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ ...LABEL_STYLE, marginBottom: '8px' }}>By Topic</p>
                <div className="space-y-2">
                  {claygent.byTopic.slice(0, 8).map(t => (
                    <div key={t.topic} className="flex items-center gap-2">
                      <span className="text-xs w-28 truncate" style={{ color: 'rgba(26,25,21,0.55)' }}>{t.topic}</span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(29,32,38,0.08)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(t.rate, 100)}%`, background: '#4A5AFF' }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-10 text-right" style={{ color: 'rgba(26,25,21,0.7)' }}>
                        {t.rate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {claygent.snippets.length > 0 && (
              <div>
                <p style={{ ...LABEL_STYLE, marginBottom: '8px' }}>Sample Mentions</p>
                <div className="space-y-2">
                  {claygent.snippets.slice(0, 5).map((s, i) => (
                    <div
                      key={i}
                      className="text-xs p-2.5"
                      style={{ border: '1px solid var(--clay-border)', borderRadius: '6px' }}
                    >
                      <div className="flex gap-1 mb-1">
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: getPlatformColor(s.platform) }}
                        >
                          {s.platform}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(29,32,38,0.07)', color: 'rgba(26,25,21,0.6)' }}
                        >
                          {s.topic}
                        </span>
                        <span className="text-[10px] ml-auto" style={{ color: 'rgba(26,25,21,0.35)' }}>
                          {s.run_date}
                        </span>
                      </div>
                      <p className="italic" style={{ color: 'rgba(26,25,21,0.7)' }}>
                        &ldquo;{s.snippet}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
