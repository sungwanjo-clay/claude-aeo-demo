'use client'

import { useEffect, useState } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import {
  getVisibilityScore, getVisibilityTimeseries, getVisibilityByTopic,
  getShareOfVoice, getAvgPosition, getMentionShare,
} from '@/lib/queries/visibility'
import type { TimeseriesRow, CompetitorRow } from '@/lib/queries/types'
import KpiCard from '@/components/cards/KpiCard'
import VisibilityLineChart from '@/components/charts/VisibilityLineChart'
import SOVDonutChart from '@/components/charts/SOVDonutChart'
import CompetitorRankTable from '@/components/tables/CompetitorRankTable'
import MetricTooltip from '@/components/shared/MetricTooltip'
import { SkeletonCard, SkeletonChart } from '@/components/shared/Skeleton'

type TopicMetric = 'visibility' | 'avg_position'

export default function VisibilityPage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [visibility, setVisibility] = useState<{ current: number | null; previous: number | null } | null>(null)
  const [mentionShare, setMentionShare] = useState<number | null>(null)
  const [avgPos, setAvgPos] = useState<{ current: number | null; previous: number | null } | null>(null)
  const [timeseries, setTimeseries] = useState<TimeseriesRow[]>([])
  const [topicSeries, setTopicSeries] = useState<TimeseriesRow[]>([])
  const [sov, setSov] = useState<CompetitorRow[]>([])
  const [topicMetric, setTopicMetric] = useState<TopicMetric>('visibility')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getVisibilityScore(supabase, f),
      getMentionShare(supabase, f),
      getAvgPosition(supabase, f),
      getVisibilityTimeseries(supabase, f),
      getVisibilityByTopic(supabase, f),
      getShareOfVoice(supabase, f),
    ]).then(([vis, ms, pos, ts, topicTs, sovData]) => {
      setVisibility(vis)
      setMentionShare(ms)
      setAvgPos(pos)
      setTimeseries(ts)
      setTopicSeries(topicTs)
      setSov(sovData)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter])

  const visDelta = (visibility?.current != null && visibility?.previous != null)
    ? visibility.current - visibility.previous : null
  const posDelta = (avgPos?.current != null && avgPos?.previous != null)
    ? avgPos.current - avgPos.previous : null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Visibility</h1>
      <p className="text-sm text-gray-500 -mt-4">How often is Clay appearing in AI responses?</p>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Visibility Score" value={visibility?.current != null ? `${visibility.current.toFixed(1)}%` : '—'} delta={visDelta} />
          <KpiCard label="Mention Share" value={mentionShare != null ? `${mentionShare.toFixed(1)}%` : '—'} delta={null} deltaLabel="of competitor mentions" />
          <KpiCard label="Share of Voice" value={sov.find(r => r.competitor_name.toLowerCase() === 'clay')?.sov_pct != null ? `${sov.find(r => r.competitor_name.toLowerCase() === 'clay')!.sov_pct.toFixed(1)}%` : '—'} delta={null} deltaLabel="of all mentions" />
          <KpiCard label="Avg Position" value={avgPos?.current != null ? `#${avgPos.current.toFixed(1)}` : '—'} delta={posDelta} invertDelta />
        </div>
      )}

      {/* Visibility over time */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Visibility Score over Time</h2>
        {loading ? <SkeletonChart /> : (
          <VisibilityLineChart data={timeseries} groupKey="platform" height={280} />
        )}
      </div>

      {/* By Topic */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Visibility by Topic</h2>
          <div className="flex gap-1">
            {(['visibility', 'avg_position'] as TopicMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setTopicMetric(m)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${topicMetric === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
              >
                {m === 'visibility' ? 'Visibility Score' : 'Avg Position'}
              </button>
            ))}
          </div>
        </div>
        {loading ? <SkeletonChart /> : (
          <VisibilityLineChart data={topicSeries} groupKey="topic" height={240} />
        )}
      </div>

      {/* SOV + Competitor table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">
            Share of Voice <MetricTooltip text="Clay's share of all competitor mentions. Different from Visibility Score — this measures relative presence, not just whether Clay appeared." />
          </h2>
          {loading ? <SkeletonChart /> : <SOVDonutChart data={sov} height={200} />}
        </div>

        <div className="lg:col-span-2">
          {loading ? <SkeletonChart /> : <CompetitorRankTable data={sov} />}
        </div>
      </div>

      {/* Average Position over time */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Average Position over Time</h2>
        <p className="text-xs text-gray-400 mb-4">Position 1 = first mentioned. Lower is better.</p>
        {loading ? <SkeletonChart /> : (
          <VisibilityLineChart
            data={timeseries.map(r => ({ ...r, value: r.value }))}
            groupKey="platform"
            height={200}
            yLabel="Position"
          />
        )}
      </div>
    </div>
  )
}
