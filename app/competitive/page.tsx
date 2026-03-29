'use client'

import { useEffect, useState } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import {
  getCompetitorList, getCompetitorKPIs, getPlatformHeatmap,
  getCompetitorVsClayTimeseries, getClaygentMcpStats,
} from '@/lib/queries/competitive'
import KpiCard from '@/components/cards/KpiCard'
import VisibilityLineChart from '@/components/charts/VisibilityLineChart'
import HeatmapMatrix from '@/components/charts/HeatmapMatrix'
import { SkeletonCard, SkeletonChart } from '@/components/shared/Skeleton'
import { getPlatformColor } from '@/lib/utils/colors'
import MetricTooltip from '@/components/shared/MetricTooltip'

interface HeatmapCell { competitor: string; platform: string; visibility_score: number }
interface CompKPIs { visibilityScore: number | null; mentionCount: number; avgPosition: number | null; topTopic: string | null; topPlatform: string | null }
interface CompTimeseries { date: string; clay: number; competitor: number }
interface ClaygentStats { rate: number | null; byPlatform: { platform: string; rate: number }[]; byTopic: { topic: string; rate: number }[]; snippets: { platform: string; topic: string; snippet: string; prompt_text: string; run_date: string }[] }

export default function CompetitivePage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [competitors, setCompetitors] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('')
  const [compKPIs, setCompKPIs] = useState<CompKPIs | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [compTs, setCompTs] = useState<CompTimeseries[]>([])
  const [claygent, setClaygent] = useState<ClaygentStats | null>(null)

  useEffect(() => {
    getCompetitorList(supabase).then(list => {
      setCompetitors(list)
      if (list.length > 0 && !selected) setSelected(list[0])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPlatformHeatmap(supabase, f),
      getClaygentMcpStats(supabase, f),
      selected ? getCompetitorKPIs(supabase, f, selected) : Promise.resolve(null),
      selected ? getCompetitorVsClayTimeseries(supabase, f, selected) : Promise.resolve([]),
    ]).then(([heat, cg, kpis, ts]) => {
      setHeatmap(heat)
      setClaygent(cg)
      setCompKPIs(kpis)
      setCompTs(ts as CompTimeseries[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter, selected])

  const tsData = compTs.map(r => ({
    date: r.date,
    Clay: r.clay,
    [selected]: r.competitor,
  }))

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">Competitive</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Analyzing:</span>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {competitors.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-4">How do we compare to competitors, and where are the gaps?</p>

      {/* Competitor KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : compKPIs && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Visibility Score" value={compKPIs.visibilityScore != null ? `${compKPIs.visibilityScore.toFixed(1)}%` : '—'} delta={null} deltaLabel={selected} />
          <KpiCard label="Mention Share" value={compKPIs.mentionCount.toLocaleString()} delta={null} deltaLabel="total mentions" />
          <KpiCard label="Avg Position" value={compKPIs.avgPosition != null ? `#${compKPIs.avgPosition.toFixed(1)}` : '—'} delta={null} deltaLabel={selected} />
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Top Topic</p>
            <p className="text-lg font-bold text-gray-900">{compKPIs.topTopic ?? '—'}</p>
            <p className="text-xs text-gray-400">{compKPIs.topPlatform ?? ''}</p>
          </div>
        </div>
      )}

      {/* Platform Heatmap */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Platform Visibility Heatmap</h2>
        <p className="text-xs text-gray-400 mb-4">Visibility Score % per competitor per platform. Clay row is pinned and highlighted.</p>
        {loading ? <SkeletonChart /> : <HeatmapMatrix data={heatmap} />}
      </div>

      {/* Competitor vs Clay over time */}
      {selected && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Clay vs. {selected} — Visibility over Time</h2>
          {loading ? <SkeletonChart /> : (
            <VisibilityLineChart
              data={tsData.flatMap(r => [
                { date: r.date, platform: 'Clay', value: r.Clay as number },
                { date: r.date, platform: selected, value: r[selected] as number },
              ])}
              groupKey="platform"
              height={240}
            />
          )}
        </div>
      )}

      {/* Claygent & Clay MCP */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1">
          Claygent & Clay MCP Tracker
          <MetricTooltip text="% of responses that mention Claygent or Clay MCP as a tool or integration" />
        </h2>
        <p className="text-xs text-gray-400 mb-4">Tracking mentions of Claygent and Clay MCP across platforms and topics</p>

        {loading ? <SkeletonCard /> : claygent && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-100 p-3 inline-block">
              <p className="text-xs text-gray-500">Overall Rate</p>
              <p className="text-2xl font-bold text-indigo-700">{claygent.rate != null ? `${claygent.rate.toFixed(1)}%` : '—'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* By platform */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">By Platform</p>
                <div className="space-y-2">
                  {claygent.byPlatform.map(p => (
                    <div key={p.platform} className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white w-20 text-center" style={{ backgroundColor: getPlatformColor(p.platform) }}>{p.platform}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(p.rate, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-700 tabular-nums w-10 text-right">{p.rate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By topic */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">By Topic</p>
                <div className="space-y-2">
                  {claygent.byTopic.slice(0, 8).map(t => (
                    <div key={t.topic} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-28 truncate">{t.topic}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(t.rate, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-700 tabular-nums w-10 text-right">{t.rate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sample snippets */}
            {claygent.snippets.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Sample Mentions</p>
                <div className="space-y-2">
                  {claygent.snippets.slice(0, 5).map((s, i) => (
                    <div key={i} className="text-xs border border-gray-100 rounded-lg p-2.5">
                      <div className="flex gap-1 mb-1">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: getPlatformColor(s.platform) }}>{s.platform}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{s.topic}</span>
                        <span className="text-[10px] text-gray-400 ml-auto">{s.run_date}</span>
                      </div>
                      <p className="text-gray-700 italic">&ldquo;{s.snippet}&rdquo;</p>
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
