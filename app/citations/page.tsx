'use client'

import { useEffect, useState } from 'react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import {
  getCitationShare, getCitationDomains, getCitationShareTimeseries,
  getCitationGaps, getCitationTypeBreakdown,
} from '@/lib/queries/citations'
import type { CitationDomainRow } from '@/lib/queries/types'
import KpiCard from '@/components/cards/KpiCard'
import VisibilityLineChart from '@/components/charts/VisibilityLineChart'
import CitationProportionalBar from '@/components/charts/CitationProportionalBar'
import CitationDomainsTable from '@/components/tables/CitationDomainsTable'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/shared/Skeleton'
import type { TimeseriesRow } from '@/lib/queries/types'

interface GapRow { domain: string; topic: string; prompt_count: number; pct_of_topic: number }
interface TypeItem { type: string; count: number; pct: number }

export default function CitationsPage() {
  const { toQueryParams } = useGlobalFilters()
  const f = toQueryParams()

  const [loading, setLoading] = useState(true)
  const [citShare, setCitShare] = useState<{ current: number | null; previous: number | null } | null>(null)
  const [domains, setDomains] = useState<CitationDomainRow[]>([])
  const [timeseries, setTimeseries] = useState<TimeseriesRow[]>([])
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [typeBreakdown, setTypeBreakdown] = useState<TypeItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getCitationShare(supabase, f),
      getCitationDomains(supabase, f),
      getCitationShareTimeseries(supabase, f),
      getCitationGaps(supabase, f),
      getCitationTypeBreakdown(supabase, f),
    ]).then(([share, doms, ts, gapData, typeData]) => {
      setCitShare(share)
      setDomains(doms)
      setTimeseries(ts)
      setGaps(gapData)
      setTypeBreakdown(typeData)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.startDate, f.endDate, f.promptType, f.platforms.join(), f.topics.join(), f.brandedFilter])

  const citDelta = (citShare?.current != null && citShare?.previous != null)
    ? citShare.current - citShare.previous : null

  const clayDomainRank = domains.findIndex(d => d.is_clay) + 1
  const uniqueDomains = domains.length
  const filteredDomains = searchQuery
    ? domains.filter(d => d.domain.toLowerCase().includes(searchQuery.toLowerCase()))
    : domains

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Citations</h1>
      <p className="text-sm text-gray-500 -mt-4">What content is being cited, and where are the gaps?</p>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Citation Share" value={citShare?.current != null ? `${citShare.current.toFixed(1)}%` : '—'} delta={citDelta} />
          <KpiCard label="Citation Domain Rank" value={clayDomainRank > 0 ? `#${clayDomainRank}` : '—'} delta={null} deltaLabel="clay.com rank" />
          <KpiCard label="Total Unique Domains" value={uniqueDomains.toLocaleString()} delta={null} deltaLabel="in period" />
          <KpiCard label="Avg Citations per Response" value="—" delta={null} deltaLabel="citations/response" />
        </div>
      )}

      {/* Citation Share over time */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Citation Share over Time</h2>
        {loading ? <SkeletonChart /> : (
          <VisibilityLineChart data={timeseries} groupKey="platform" height={240} />
        )}
      </div>

      {/* Citation type breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Citation Categories</h2>
        {loading ? <SkeletonChart /> : (
          <CitationProportionalBar data={typeBreakdown} />
        )}
      </div>

      {/* URL / Domain search */}
      <div>
        <input
          type="text"
          placeholder="Search domains or URLs…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Citation domains table */}
      {loading ? <SkeletonTable /> : (
        <CitationDomainsTable data={filteredDomains} />
      )}

      {/* Citation Gap Analysis */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Citation Gap Analysis</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Competitor content cited when Clay isn&apos;t mentioned — topics where competitor content ranks in AI but Clay content doesn&apos;t appear.
          </p>
        </div>
        {loading ? (
          <div className="p-4"><SkeletonTable /></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Competitor Domain</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide"># Prompts</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">% of Topic</th>
              </tr>
            </thead>
            <tbody>
              {gaps.slice(0, 25).map((g, i) => (
                <tr key={`${g.domain}-${g.topic}`} className={`border-b border-gray-50 text-sm ${i % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}>
                  <td className="px-3 py-2.5 font-medium text-red-700">{g.domain}</td>
                  <td className="px-3 py-2.5 text-gray-700">{g.topic}</td>
                  <td className="px-3 py-2.5 text-gray-700 tabular-nums">{g.prompt_count}</td>
                  <td className="px-3 py-2.5 text-gray-700 tabular-nums">{g.pct_of_topic.toFixed(1)}%</td>
                </tr>
              ))}
              {!gaps.length && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-gray-400">No gap data found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
