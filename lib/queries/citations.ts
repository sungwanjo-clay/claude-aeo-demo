// @ts-nocheck
import { SupabaseClient } from '@supabase/supabase-js'
import type { FilterParams, CitationDomainRow } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyResponseFilters(query: any, f: FilterParams): any {
  query = query.gte('run_date', f.startDate).lte('run_date', f.endDate)
  if (f.platforms && f.platforms.length > 0) query = query.in('platform', f.platforms)
  if (f.topics && f.topics.length > 0) query = query.in('topic', f.topics)
  if (f.promptType === 'benchmark') {
    query = query.eq('prompt_type', 'benchmark')
  } else if (f.promptType === 'campaign') {
    query = query.not('prompt_type', 'is', null).neq('prompt_type', 'benchmark')
  }
  if (f.tags && f.tags !== 'all') query = query.eq('tags', f.tags)
  return query
}

export async function getCitationShare(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ current: number | null; previous: number | null }> {
  const calc = async (start: string, end: string) => {
    const { data } = await applyResponseFilters(
      sb.from('responses').select('cited_domains, clay_mentioned'),
      { ...f, startDate: start, endDate: end }
    )
    if (!data?.length) return null
    const withClayCited = data.filter(r => {
      try {
        const domains = Array.isArray(r.cited_domains) ? r.cited_domains : JSON.parse(r.cited_domains ?? '[]')
        return domains.some((d: string) => d.includes('clay.com'))
      } catch { return false }
    }).length
    return (withClayCited / data.length) * 100
  }

  const [current, previous] = await Promise.all([
    calc(f.startDate, f.endDate),
    calc(f.prevStartDate, f.prevEndDate),
  ])
  return { current, previous }
}

export async function getCitationDomains(
  sb: SupabaseClient,
  f: FilterParams
): Promise<CitationDomainRow[]> {
  let query = sb
    .from('citation_domains')
    .select('domain, citation_type, url_type')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  if (f.platforms.length > 0) query = query.in('platform', f.platforms)

  const { data } = await query
  if (!data) return []

  const map = new Map<string, { citation_type: string | null; url_type: string | null; count: number }>()
  for (const row of data) {
    const d = row.domain ?? ''
    const cur = map.get(d) ?? { citation_type: row.citation_type, url_type: row.url_type, count: 0 }
    cur.count++
    map.set(d, cur)
  }

  return Array.from(map.entries()).map(([domain, { citation_type, url_type, count }]) => ({
    domain,
    citation_type,
    url_type,
    citation_count: count,
    is_clay: domain.includes('clay.com'),
  })).sort((a, b) => b.citation_count - a.citation_count)
}

export async function getCitationShareTimeseries(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ date: string; platform: string; value: number }[]> {
  const { data } = await applyResponseFilters(
    sb.from('responses').select('run_date, platform, cited_domains'),
    f
  )
  if (!data) return []

  const map = new Map<string, { clayCited: number; total: number }>()
  for (const row of data) {
    const date = row.run_date?.split('T')[0] ?? ''
    const key = `${date}|||${row.platform}`
    const cur = map.get(key) ?? { clayCited: 0, total: 0 }
    cur.total++
    try {
      const domains = Array.isArray(row.cited_domains) ? row.cited_domains : JSON.parse(row.cited_domains ?? '[]')
      if (domains.some((d: string) => typeof d === 'string' && d.includes('clay.com'))) cur.clayCited++
    } catch { /* ignore */ }
    map.set(key, cur)
  }

  return Array.from(map.entries()).map(([key, { clayCited, total }]) => {
    const [date, platform] = key.split('|||')
    return { date, platform, value: total > 0 ? (clayCited / total) * 100 : 0 }
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getCitationGaps(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ domain: string; topic: string; prompt_count: number; pct_of_topic: number }[]> {
  // Competitor domains cited when Clay is not mentioned
  let query = sb
    .from('citation_domains')
    .select('domain, topic, citation_type')
    .eq('citation_type', 'Competition')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  if (f.platforms.length > 0) query = query.in('platform', f.platforms)
  const { data } = await query

  // Also get total per topic to calc pct
  const topicQuery = await applyResponseFilters(
    sb.from('responses').select('topic, clay_mentioned'),
    f
  )

  const topicTotals = new Map<string, number>()
  for (const r of topicQuery.data ?? []) {
    if (r.topic) topicTotals.set(r.topic, (topicTotals.get(r.topic) ?? 0) + 1)
  }

  if (!data) return []
  const map = new Map<string, { count: number; topic: string }>()
  for (const row of data) {
    const key = `${row.domain}|||${row.topic ?? 'Unknown'}`
    const cur = map.get(key) ?? { count: 0, topic: row.topic ?? 'Unknown' }
    cur.count++
    map.set(key, cur)
  }

  return Array.from(map.entries()).map(([key, { count, topic }]) => {
    const [domain] = key.split('|||')
    const topicTotal = topicTotals.get(topic) ?? 0
    return {
      domain,
      topic,
      prompt_count: count,
      pct_of_topic: topicTotal > 0 ? (count / topicTotal) * 100 : 0,
    }
  }).sort((a, b) => b.prompt_count - a.prompt_count)
}

export async function getCitationTypeBreakdown(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ type: string; count: number; pct: number }[]> {
  let query = sb
    .from('citation_domains')
    .select('citation_type')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)
  if (f.platforms.length > 0) query = query.in('platform', f.platforms)

  const { data } = await query
  if (!data?.length) return []

  const map = new Map<string, number>()
  for (const row of data) {
    const t = row.citation_type ?? 'Other'
    map.set(t, (map.get(t) ?? 0) + 1)
  }
  const total = data.length
  return Array.from(map.entries()).map(([type, count]) => ({
    type, count, pct: (count / total) * 100,
  })).sort((a, b) => b.count - a.count)
}

export async function getCitationCount(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ current: number; previous: number }> {
  const count = async (start: string, end: string) => {
    const { data } = await applyResponseFilters(
      sb.from('responses').select('cited_domains'),
      { ...f, startDate: start, endDate: end }
    )
    if (!data?.length) return 0
    return data.filter(r => {
      try {
        const domains = Array.isArray(r.cited_domains) ? r.cited_domains : JSON.parse(r.cited_domains ?? '[]')
        return domains.some((d: string) => typeof d === 'string' && d.includes('clay.com'))
      } catch { return false }
    }).length
  }
  const [current, previous] = await Promise.all([
    count(f.startDate, f.endDate),
    count(f.prevStartDate, f.prevEndDate),
  ])
  return { current, previous }
}

export async function getCitationOverallTimeseries(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ date: string; value: number }[]> {
  const { data } = await applyResponseFilters(
    sb.from('responses').select('run_date, cited_domains'),
    f
  )
  if (!data) return []

  const map = new Map<string, { clayCited: number; total: number }>()
  for (const row of data) {
    const date = (row.run_date ?? '').substring(0, 10)
    if (!date) continue
    const cur = map.get(date) ?? { clayCited: 0, total: 0 }
    cur.total++
    try {
      const domains = Array.isArray(row.cited_domains) ? row.cited_domains : JSON.parse(row.cited_domains ?? '[]')
      if (domains.some((d: string) => typeof d === 'string' && d.includes('clay.com'))) cur.clayCited++
    } catch { /* ignore */ }
    map.set(date, cur)
  }

  return Array.from(map.entries())
    .map(([date, { clayCited, total }]) => ({ date, value: total > 0 ? (clayCited / total) * 100 : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getTopCitedDomainsWithURLs(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ domain: string; citation_count: number; share_pct: number; is_clay: boolean; top_urls: { url: string; title: string | null; count: number }[] }[]> {
  let query = sb
    .from('citation_domains')
    .select('domain, url, title, citation_type')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)
  if (f.platforms && f.platforms.length > 0) query = query.in('platform', f.platforms)

  const { data } = await query
  if (!data?.length) return []

  const total = data.length
  const domainMap = new Map<string, { count: number; is_clay: boolean; urls: Map<string, { title: string | null; count: number }> }>()

  for (const row of data) {
    const d = (row.domain ?? '').toLowerCase()
    if (!d) continue
    const cur = domainMap.get(d) ?? { count: 0, is_clay: d.includes('clay.com'), urls: new Map() }
    cur.count++
    if (row.url) {
      const u = cur.urls.get(row.url) ?? { title: row.title ?? null, count: 0 }
      u.count++
      cur.urls.set(row.url, u)
    }
    domainMap.set(d, cur)
  }

  return Array.from(domainMap.entries())
    .map(([domain, { count, is_clay, urls }]) => ({
      domain,
      citation_count: count,
      share_pct: total > 0 ? (count / total) * 100 : 0,
      is_clay,
      top_urls: Array.from(urls.entries())
        .map(([url, { title, count }]) => ({ url, title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    }))
    .sort((a, b) => b.citation_count - a.citation_count)
    .slice(0, 20)
}
