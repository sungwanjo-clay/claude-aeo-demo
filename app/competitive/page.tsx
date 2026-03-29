'use client'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { useEffect, useState } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import {
  getCompetitorList,
  getCompetitorKPIs,
  getClayKPIs,
  getPlatformHeatmap,
  getCompetitorVsClayTimeseries,
  getClayVisibilityTimeseries,
  getClaygentMcpStats,
  getWinnersAndLosers,
  getCompetitorByPMMTopic,
  getCompetitorCoCitedDomains,
  getCompetitorCitationRate,
  getCompetitorCitationProfile,
} from '@/lib/queries/competitive'
import KpiCard from '@/components/cards/KpiCard'
import HeatmapMatrix from '@/components/charts/HeatmapMatrix'
import { SkeletonCard, SkeletonChart } from '@/components/shared/Skeleton'
import { getPlatformColor, CHART_COLORS, getCitationTypeColor } from '@/lib/utils/colors'
import MetricTooltip from '@/components/shared/MetricTooltip'
import { formatShortDate } from '@/lib/utils/formatters'
import { ExternalLink } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar,
} from 'recharts'

const LABEL = {
  color: 'rgba(26,25,21,0.45)',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}
const CARD = { background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }

interface HeatmapCell { competitor: string; platform: string; visibility_score: number }
interface AnyKPIs {
  visibilityScore: number | null
  deltaVisibility: number | null
  citationRate: number | null
  deltaCitationRate: number | null
  mentionCount: number
  topTopic: string | null
  topPlatform: string | null
  avgPosition?: number | null
}
interface WinnerLoser { competitor_name: string; current: number; previous: number | null; delta: number | null; isNew: boolean }
interface PMMTopic { pmm_use_case: string; visibility_score: number; mention_count: number }
interface CoCitedDomain { domain: string; count: number; share_pct: number; is_own_domain: boolean }
interface CitationProfileItem { url: string; title: string | null; domain: string; count: number; citation_type: string | null }

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span style={{ color: 'rgba(26,25,21,0.35)', fontSize: '11px' }}>—</span>
  const pos = delta >= 0
  return (
    <span style={{
      background: pos ? 'var(--clay-lime)' : '#FFE0DD',
      color: pos ? 'var(--clay-black)' : 'var(--clay-pomegranate)',
      borderRadius: '4px', padding: '1px 6px', fontSize: '11px', fontWeight: 700,
    }}>
      {pos ? '+' : ''}{delta.toFixed(1)}%
    </span>
  )
}

export default function CompetitivePage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [loadingExtra, setLoadingExtra] = useState(true)

  const [competitors, setCompetitors] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('Clay')

  const [kpis, setKpis] = useState<AnyKPIs | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [tsData, setTsData] = useState<{ date: string; [k: string]: string | number }[]>([])
  const [claygent, setClaygent] = useState<any>(null)
  const [movers, setMovers] = useState<WinnerLoser[]>([])

  const [pmmTopics, setPmmTopics] = useState<PMMTopic[]>([])
  const [coCited, setCoCited] = useState<CoCitedDomain[]>([])
  const [citProfile, setCitProfile] = useState<CitationProfileItem[]>([])

  const [showAllHeatmap, setShowAllHeatmap] = useState(false)
  const [showAllDomains, setShowAllDomains] = useState(false)
  const [showAllProfile, setShowAllProfile] = useState(false)

  // Load competitor list once — Clay first
  useEffect(() => {
    getCompetitorList(supabase).then(list => {
      setCompetitors(list)
      // default stays 'Clay'; only override if Clay not in list
      if (!list.includes('Clay') && list.length > 0) setSelected(list[0])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isClay = selected === 'Clay'

  // Effect 1: KPIs, timeseries, movers, heatmap, claygent
  useEffect(() => {
    if (!selected) return
    setLoading(true)

    const kpiPromise = isClay
      ? getClayKPIs(supabase, f).then(r => ({
          visibilityScore: r.visibilityScore,
          deltaVisibility: r.deltaVisibility,
          citationRate: r.citationRate,
          deltaCitationRate: r.deltaCitationRate,
          mentionCount: r.mentionCount,
          avgPosition: r.avgPosition,
          topTopic: r.topTopic,
          topPlatform: r.topPlatform,
        }))
      : Promise.all([
          getCompetitorKPIs(supabase, f, selected),
          getCompetitorCitationRate(supabase, f, selected),
        ]).then(([k, cit]) => ({
          visibilityScore: k.visibilityScore,
          deltaVisibility: k.deltaVisibility,
          citationRate: cit.rate,
          deltaCitationRate: cit.deltaRate,
          mentionCount: k.mentionCount,
          avgPosition: k.avgPosition,
          topTopic: k.topTopic,
          topPlatform: k.topPlatform,
        }))

    const tsPromise = isClay
      ? getClayVisibilityTimeseries(supabase, f).then(rows =>
          rows.map(r => ({ date: r.date, Clay: r.value }))
        )
      : getCompetitorVsClayTimeseries(supabase, f, selected).then(rows =>
          rows.map(r => ({ date: r.date, Clay: r.clay, [selected]: r.competitor }))
        )

    Promise.all([
      kpiPromise,
      tsPromise,
      getPlatformHeatmap(supabase, f),
      getClaygentMcpStats(supabase, f),
      getWinnersAndLosers(supabase, f),
    ]).then(([k, ts, heat, cg, wl]) => {
      setKpis(k)
      setTsData(ts)
      setHeatmap(heat)
      setClaygent(cg)
      setMovers(wl as WinnerLoser[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter, selected])

  // Effect 2: PMM topics, co-cited domains, citation profile
  useEffect(() => {
    if (!selected) return
    setLoadingExtra(true)
    Promise.all([
      getCompetitorByPMMTopic(supabase, f, selected),
      isClay ? Promise.resolve([]) : getCompetitorCoCitedDomains(supabase, f, selected),
      getCompetitorCitationProfile(supabase, f, selected),
    ]).then(([pmm, coCitedData, profile]) => {
      setPmmTopics(pmm as PMMTopic[])
      setCoCited(coCitedData as CoCitedDomain[])
      setCitProfile(profile as CitationProfileItem[])
      setLoadingExtra(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter, selected])

  // Static top-5 competitors (by current score, descending)
  const topCompetitors = [...movers].sort((a, b) => b.current - a.current).slice(0, 5)
  const biggestLosers = [...movers].filter(r => (r.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 5)
  const emerging = movers.filter(r => r.isNew)

  // Heatmap top-50
  const heatmapComps = [...new Set(heatmap.map(d => d.competitor))].sort((a, b) => {
    const aS = heatmap.filter(d => d.competitor === a).reduce((s, r) => s + r.visibility_score, 0)
    const bS = heatmap.filter(d => d.competitor === b).reduce((s, r) => s + r.visibility_score, 0)
    return bS - aS
  })
  const limitedComps = showAllHeatmap ? heatmapComps : heatmapComps.slice(0, 50)
  const filteredHeatmap = heatmap.filter(d => limitedComps.includes(d.competitor))

  const pmmChartHeight = Math.max(200, pmmTopics.length * 44)
  const profileVisible = showAllProfile ? citProfile : citProfile.slice(0, 10)
  const domainsVisible = showAllDomains ? coCited : coCited.slice(0, 10)

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">

      {/* Header + selector */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--clay-black)', letterSpacing: '-0.03em' }}>
          Competitive Intelligence
        </h1>
        <p className="text-sm" style={{ color: 'rgba(26,25,21,0.55)' }}>
          AI visibility benchmarks across domains, topics, and platforms.
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span style={LABEL}>Analyzing Domain:</span>
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
            {competitors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* KPI cards — 5 tiles */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Visibility Score"
            value={kpis.visibilityScore != null ? `${kpis.visibilityScore.toFixed(1)}%` : '—'}
            delta={kpis.deltaVisibility}
            deltaLabel="vs prev period"
          />
          <KpiCard
            label="Citation Rate"
            value={kpis.citationRate != null ? `${kpis.citationRate.toFixed(1)}%` : '—'}
            delta={kpis.deltaCitationRate}
            deltaLabel="vs prev period"
          />
          <KpiCard
            label="Mention Count"
            value={kpis.mentionCount.toLocaleString()}
            delta={null}
            deltaLabel="times mentioned"
          />
          {kpis.avgPosition != null ? (
            <KpiCard
              label="Avg Position"
              value={`#${kpis.avgPosition.toFixed(1)}`}
              delta={null}
              deltaLabel={selected}
            />
          ) : (
            <div style={CARD} className="p-5 flex flex-col gap-2">
              <div style={LABEL}>Avg Position</div>
              <div className="text-2xl font-bold" style={{ color: 'rgba(26,25,21,0.25)' }}>—</div>
              <div style={{ ...LABEL, color: 'rgba(26,25,21,0.3)' }}>tracked for Clay only</div>
            </div>
          )}
          <div style={CARD} className="p-5 flex flex-col gap-2">
            <div style={LABEL}>Top Topic</div>
            <div className="text-lg font-bold leading-tight" style={{ color: 'var(--clay-black)', letterSpacing: '-0.02em' }}>
              {kpis.topTopic ?? '—'}
            </div>
            <div style={{ ...LABEL, color: 'rgba(26,25,21,0.3)' }}>{kpis.topPlatform ?? ''}</div>
          </div>
        </div>
      ) : null}

      {/* Trend chart + static top-competitors / movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Trend chart (2/3) */}
        <div style={CARD} className="p-4 lg:col-span-2">
          <div style={LABEL} className="mb-3">
            {isClay ? 'Clay Visibility — Trend Over Time' : `Clay vs. ${selected} — Visibility Over Time`}
          </div>
          {loading ? <SkeletonChart /> : tsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,25,21,0.06)" />
                <XAxis dataKey="date" tickFormatter={(v: any) => formatShortDate(v)}
                  tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.45)' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v: any) => `${v}%`}
                  tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.45)' }} tickLine={false} axisLine={false} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(val: any, name: any) => [`${Number(val).toFixed(1)}%`, name]}
                  contentStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', border: '1px solid var(--clay-border)', borderRadius: '8px' }} />
                {!isClay && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                <Line type="monotone" dataKey="Clay" stroke="var(--clay-black)" strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: 'var(--clay-black)' }} activeDot={{ r: 5 }} />
                {!isClay && (
                  <Line type="monotone" dataKey={selected} stroke="#4A5AFF" strokeWidth={2}
                    dot={{ r: 2, strokeWidth: 0 }} activeDot={{ r: 4 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
              No trend data available
            </div>
          )}
        </div>

        {/* Static right panel: Top Competitors + Movers */}
        <div style={CARD} className="p-4 flex flex-col gap-0">
          {/* Top Competitors */}
          <div style={LABEL} className="mb-2">Top Competitors</div>
          {loading ? <SkeletonCard /> : (
            <div className="mb-4">
              {topCompetitors.map((w, i) => (
                <div key={w.competitor_name} className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                  <span style={{ color: 'rgba(26,25,21,0.3)', fontSize: '11px', fontWeight: 700, width: '16px' }}>{i + 1}</span>
                  <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: 'var(--clay-black)' }}>
                    {w.competitor_name}
                    {w.isNew && (
                      <span className="ml-1.5" style={{ background: 'var(--clay-lime)', color: 'var(--clay-black)', borderRadius: '3px', padding: '1px 4px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                        New
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                    {w.current.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Biggest Losers */}
          <div style={{ borderTop: '1px solid var(--clay-border)', paddingTop: '12px' }}>
            <div style={{ ...LABEL, color: 'var(--clay-pomegranate)' }} className="mb-2">Biggest Losers</div>
            {loading ? <SkeletonCard /> : biggestLosers.length === 0 ? (
              <p style={{ color: 'rgba(26,25,21,0.35)', fontSize: '12px' }}>No losses this period</p>
            ) : biggestLosers.map((w, i) => (
              <div key={w.competitor_name} className="flex items-center gap-2 py-1.5"
                style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                <span style={{ color: 'rgba(26,25,21,0.3)', fontSize: '11px', fontWeight: 700, width: '16px' }}>{i + 1}</span>
                <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: 'var(--clay-black)' }}>
                  {w.competitor_name}
                </span>
                <DeltaBadge delta={w.delta} />
              </div>
            ))}
          </div>

          {/* Emerging Threats */}
          {!loading && emerging.length > 0 && (
            <div style={{ borderTop: '1px solid var(--clay-border)', paddingTop: '12px', marginTop: '12px' }}>
              <div style={LABEL} className="mb-2">Emerging Threats</div>
              {emerging.slice(0, 4).map(w => (
                <div key={w.competitor_name} className="flex items-center gap-2 py-1.5"
                  style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                  <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: 'var(--clay-black)' }}>
                    {w.competitor_name}
                  </span>
                  <span style={{ color: 'rgba(26,25,21,0.55)', fontSize: '12px' }}>{w.current.toFixed(1)}%</span>
                  <span style={{ background: 'var(--clay-lime)', color: 'var(--clay-black)', borderRadius: '3px', padding: '1px 5px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                    New
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Visibility by PMM Topic */}
      <div style={CARD} className="p-4">
        <div style={LABEL} className="mb-1">Visibility by PMM Topic — {selected}</div>
        <p className="text-xs mb-3" style={{ color: 'rgba(26,25,21,0.45)' }}>
          How often {selected} appears in AI responses per use case category
        </p>
        {loadingExtra ? <SkeletonChart /> : pmmTopics.length === 0 ? (
          <div className="flex items-center justify-center py-12" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
            No PMM topic data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={pmmChartHeight}>
            <BarChart data={pmmTopics} layout="vertical" margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(26,25,21,0.06)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'rgba(26,25,21,0.45)' }}
                tickFormatter={(v: any) => `${v}%`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="pmm_use_case" width={170}
                tick={{ fontSize: 11, fill: 'rgba(26,25,21,0.6)', fontFamily: 'Plus Jakarta Sans' }} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip formatter={(val: any) => [`${Number(val).toFixed(1)}%`, 'Visibility Score']}
                contentStyle={{ fontSize: 11, fontFamily: 'Plus Jakarta Sans', border: '1px solid var(--clay-border)', borderRadius: '8px' }} />
              <Bar dataKey="visibility_score" fill={isClay ? 'var(--clay-black)' : '#4A5AFF'} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Citation Profile */}
      <div style={CARD} className="p-4">
        <div style={LABEL} className="mb-1">Citation Profile — {selected}</div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          Top pieces of content from {selected}'s domain being cited by AI models — ranked by citation frequency.
        </p>
        {loadingExtra ? <SkeletonChart /> : citProfile.length === 0 ? (
          <div className="flex items-center justify-center py-10" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
            No citation data found for {selected}'s domain
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--clay-border)' }}>
                    <th className="pb-2 text-left pr-3" style={{ ...LABEL, width: '24px' }}>#</th>
                    <th className="pb-2 text-left pr-3" style={LABEL}>Title / URL</th>
                    <th className="pb-2 text-left pr-3" style={LABEL}>Domain</th>
                    <th className="pb-2 text-left pr-3" style={LABEL}>Type</th>
                    <th className="pb-2 text-right" style={LABEL}>Cited</th>
                  </tr>
                </thead>
                <tbody>
                  {profileVisible.map((item, idx) => (
                    <tr key={item.url} style={{ borderBottom: '1px solid rgba(26,25,21,0.05)' }}>
                      <td className="py-2.5 pr-3 text-[11px] font-bold" style={{ color: 'rgba(26,25,21,0.3)' }}>{idx + 1}</td>
                      <td className="py-2.5 pr-3" style={{ maxWidth: '360px' }}>
                        {item.title && (
                          <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--clay-black)' }}>
                            {item.title}
                          </p>
                        )}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 group"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={10} className="shrink-0 opacity-40 group-hover:opacity-70" />
                          <span className="text-[11px] truncate group-hover:underline" style={{ color: 'rgba(26,25,21,0.45)', maxWidth: '320px' }}>
                            {item.url}
                          </span>
                        </a>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[11px] font-medium" style={{ color: 'rgba(26,25,21,0.6)' }}>
                          {item.domain}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {item.citation_type ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{
                              background: getCitationTypeColor(item.citation_type) + '20',
                              color: getCitationTypeColor(item.citation_type),
                              border: `1px solid ${getCitationTypeColor(item.citation_type)}40`,
                            }}>
                            {item.citation_type}
                          </span>
                        ) : <span style={{ color: 'rgba(26,25,21,0.25)', fontSize: '11px' }}>—</span>}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                          {item.count.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {citProfile.length > 10 && (
              <button
                onClick={() => setShowAllProfile(v => !v)}
                className="mt-3 text-[11px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(26,25,21,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showAllProfile ? 'Show top 10 ↑' : `Show all ${citProfile.length} URLs ↓`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Domains Co-cited (competitors only) */}
      {!isClay && (
        <div style={CARD} className="p-4">
          <div style={LABEL} className="mb-1">Domains Cited Alongside {selected}</div>
          <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
            Domains that appear in the same AI responses that mention {selected} — these are the authoritative sources in their competitive space.
          </p>
          {loadingExtra ? <SkeletonChart /> : coCited.length === 0 ? (
            <div className="flex items-center justify-center py-10" style={{ color: 'rgba(26,25,21,0.35)', fontSize: '13px' }}>
              No co-citation data available
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--clay-border)' }}>
                      <th className="pb-2 text-left pr-3" style={{ ...LABEL, width: '24px' }}>#</th>
                      <th className="pb-2 text-left pr-3" style={LABEL}>Domain</th>
                      <th className="pb-2 text-right pr-3" style={LABEL}>Count</th>
                      <th className="pb-2 text-right" style={LABEL}>Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domainsVisible.map((d, i) => (
                      <tr key={d.domain} style={{
                        borderBottom: '1px solid rgba(26,25,21,0.05)',
                        background: d.is_own_domain ? 'rgba(200,240,64,0.07)' : 'transparent',
                      }}>
                        <td className="py-2.5 pr-3 text-[11px] font-bold" style={{ color: 'rgba(26,25,21,0.3)' }}>{i + 1}</td>
                        <td className="py-2.5 pr-3">
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--clay-black)' }}>{d.domain}</span>
                          {d.is_own_domain && (
                            <span className="ml-1.5" style={{ background: 'var(--clay-lime)', color: 'var(--clay-black)', borderRadius: '3px', padding: '1px 5px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>
                              own
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-[13px] font-bold tabular-nums" style={{ color: 'var(--clay-black)' }}>
                          {d.count.toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right text-[12px] tabular-nums" style={{ color: 'rgba(26,25,21,0.55)' }}>
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
                  className="mt-3 text-[11px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
                  style={{ color: 'rgba(26,25,21,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showAllDomains ? 'Show top 10 ↑' : `Show all ${coCited.length} domains ↓`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Platform Heatmap */}
      <div style={CARD} className="p-4">
        <div style={LABEL} className="mb-1">Platform Visibility Heatmap</div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          Visibility Score % per competitor per platform. Showing top {Math.min(50, heatmapComps.length)} by visibility score.
        </p>
        {loading ? <SkeletonChart /> : (
          <>
            <HeatmapMatrix data={filteredHeatmap} />
            {heatmapComps.length > 50 && (
              <button
                onClick={() => setShowAllHeatmap(v => !v)}
                className="mt-3 text-[11px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(26,25,21,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showAllHeatmap ? 'Show top 50 ↑' : `Show all ${heatmapComps.length} competitors ↓`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Claygent & Clay MCP */}
      <div style={CARD} className="p-4">
        <div className="mb-1 flex items-center gap-1" style={LABEL}>
          Claygent &amp; Clay MCP Tracker
          <MetricTooltip text="% of responses that mention Claygent or Clay MCP as a tool or integration" />
        </div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>
          Tracking mentions of Claygent and Clay MCP across platforms and topics
        </p>
        {loading ? <SkeletonCard /> : claygent && (
          <div className="space-y-4">
            <div style={{ ...CARD, padding: '10px 16px', display: 'inline-block' }}>
              <p style={LABEL}>Overall Rate</p>
              <p className="text-3xl font-bold" style={{ color: '#4A5AFF', letterSpacing: '-0.02em' }}>
                {claygent.rate != null ? `${claygent.rate.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p style={{ ...LABEL, marginBottom: '8px' }}>By Platform</p>
                <div className="space-y-2">
                  {claygent.byPlatform.map((p: any) => (
                    <div key={p.platform} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white w-20 text-center"
                        style={{ backgroundColor: getPlatformColor(p.platform) }}>{p.platform}</span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(26,25,21,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(p.rate, 100)}%`, background: '#4A5AFF' }} />
                      </div>
                      <span className="text-xs tabular-nums w-10 text-right" style={{ color: 'rgba(26,25,21,0.7)' }}>
                        {p.rate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ ...LABEL, marginBottom: '8px' }}>By Topic</p>
                <div className="space-y-2">
                  {claygent.byTopic.slice(0, 8).map((t: any) => (
                    <div key={t.topic} className="flex items-center gap-2">
                      <span className="text-xs w-28 truncate" style={{ color: 'rgba(26,25,21,0.55)' }}>{t.topic}</span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(26,25,21,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(t.rate, 100)}%`, background: '#4A5AFF' }} />
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
                <p style={{ ...LABEL, marginBottom: '8px' }}>Sample Mentions</p>
                <div className="space-y-2">
                  {claygent.snippets.slice(0, 5).map((s: any, i: number) => (
                    <div key={i} className="text-xs p-2.5" style={{ border: '1px solid var(--clay-border)', borderRadius: '6px' }}>
                      <div className="flex gap-1 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: getPlatformColor(s.platform) }}>{s.platform}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(26,25,21,0.07)', color: 'rgba(26,25,21,0.6)' }}>{s.topic}</span>
                        <span className="text-[10px] ml-auto" style={{ color: 'rgba(26,25,21,0.35)' }}>{s.run_date}</span>
                      </div>
                      <p className="italic" style={{ color: 'rgba(26,25,21,0.7)' }}>&ldquo;{s.snippet}&rdquo;</p>
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
