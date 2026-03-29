'use client'

import { useEffect, useState } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import {
  getSentimentBreakdown, getSentimentTimeseries, getThemes,
  getUseCaseAttribution, getPositioningSnippets,
} from '@/lib/queries/sentiment'
import type { ThemeRow } from '@/lib/queries/types'
import KpiCard from '@/components/cards/KpiCard'
import SentimentAreaChart from '@/components/charts/SentimentAreaChart'
import SentimentStackedBar from '@/components/charts/SentimentStackedBar'
import ThemesTable from '@/components/tables/ThemesTable'
import MetricTooltip from '@/components/shared/MetricTooltip'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/shared/Skeleton'
import { getPlatformColor, getSentimentColor } from '@/lib/utils/colors'

interface SentimentPoint { date: string; positive: number; neutral: number; negative: number }
interface UseCaseRow { use_case: string; count: number; pct: number; top_platform: string; top_topic: string }
interface PositioningSnippet { topic: string; platform: string; snippet: string; prompt_text: string }

export default function SentimentPage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [breakdown, setBreakdown] = useState<{ positive: number | null; neutral: number | null; negative: number | null; notMentioned: number | null; avgScore: number | null } | null>(null)
  const [timeseries, setTimeseries] = useState<SentimentPoint[]>([])
  const [themes, setThemes] = useState<ThemeRow[]>([])
  const [useCases, setUseCases] = useState<UseCaseRow[]>([])
  const [positioning, setPositioning] = useState<PositioningSnippet[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getSentimentBreakdown(supabase, f),
      getSentimentTimeseries(supabase, f),
      getThemes(supabase, f),
      getUseCaseAttribution(supabase, f),
      getPositioningSnippets(supabase, f),
    ]).then(([bdown, ts, th, uc, pos]) => {
      setBreakdown(bdown)
      setTimeseries(ts)
      setThemes(th)
      setUseCases(uc)
      setPositioning(pos)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter])

  // Stacked bar per platform - mock with overall data
  const barData = breakdown ? [
    {
      name: 'Overall',
      Positive: breakdown.positive ?? 0,
      Neutral: breakdown.neutral ?? 0,
      Negative: breakdown.negative ?? 0,
    },
  ] : []

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Sentiment</h1>
      <p className="text-sm text-gray-500 -mt-4">What are AI platforms saying about Clay?</p>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Positive Sentiment %" value={breakdown?.positive != null ? `${breakdown.positive.toFixed(1)}%` : '—'} delta={null} deltaLabel="of Clay mentions" />
          <KpiCard label="Neutral %" value={breakdown?.neutral != null ? `${breakdown.neutral.toFixed(1)}%` : '—'} delta={null} deltaLabel="of Clay mentions" />
          <KpiCard label="Negative %" value={breakdown?.negative != null ? `${breakdown.negative.toFixed(1)}%` : '—'} delta={null} deltaLabel="of Clay mentions" invertDelta />
          <KpiCard label="Brand Sentiment Score" value={breakdown?.avgScore != null ? `${breakdown.avgScore.toFixed(0)}/100` : '—'} delta={null} deltaLabel="avg score" />
        </div>
      )}

      {/* Sentiment over time */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Sentiment over Time</h2>
        {loading ? <SkeletonChart /> : <SentimentAreaChart data={timeseries} />}
      </div>

      {/* Breakdown bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Sentiment Breakdown</h2>
        {loading ? <SkeletonChart /> : (
          barData.length > 0
            ? <SentimentStackedBar data={barData} height={120} />
            : <p className="text-sm text-gray-400 py-6 text-center">No sentiment data yet</p>
        )}
      </div>

      {/* Themes table */}
      {loading ? <SkeletonTable /> : <ThemesTable data={themes} />}

      {/* Use Case Attribution */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Use Case Attribution</h2>
          <p className="text-xs text-gray-400 mt-0.5">What use cases does AI attribute to Clay?</p>
        </div>
        {loading ? (
          <div className="p-4"><SkeletonTable /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Use Case</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Responses</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Clay-mentioned</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Platform</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Top Topic</th>
              </tr>
            </thead>
            <tbody>
              {useCases.map((uc, i) => (
                <tr key={uc.use_case} className={`border-b border-gray-50 text-sm ${i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}>
                  <td className="px-3 py-2.5 font-medium text-gray-900">{uc.use_case}</td>
                  <td className="px-3 py-2.5 text-gray-700 tabular-nums">{uc.count}</td>
                  <td className="px-3 py-2.5 text-gray-700 tabular-nums">{uc.pct.toFixed(1)}%</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: getPlatformColor(uc.top_platform) }}>
                      {uc.top_platform}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{uc.top_topic}</td>
                </tr>
              ))}
              {!useCases.length && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">No use case data</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Positioning snippets */}
      {positioning.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Competitive Positioning</h2>
          <p className="text-xs text-gray-400 mb-4">How does AI describe Clay vs. competitors?</p>
          <div className="space-y-3">
            {positioning.slice(0, 10).map((p, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{p.topic}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: getPlatformColor(p.platform) }}>{p.platform}</span>
                </div>
                <p className="text-xs text-gray-700 italic">&ldquo;{p.snippet}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
