// @ts-nocheck
import { SupabaseClient } from '@supabase/supabase-js'
import type { FilterParams, TimeseriesRow, CompetitorRow } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, f: FilterParams): any {
  query = query.gte('run_date', f.startDate).lte('run_date', f.endDate)
  if (f.platforms.length > 0) query = query.in('platform', f.platforms)
  if (f.topics.length > 0) query = query.in('topic', f.topics)
  if (f.brandedFilter !== 'all') {
    const val = f.brandedFilter === 'branded' ? 'Branded' : 'Non-Branded'
    query = query.eq('branded_or_non_branded', val)
  }
  if (f.promptType === 'benchmark') {
    query = query.eq('prompt_type', 'benchmark')
  } else if (f.promptType !== 'all') {
    query = query.eq('tags', f.promptType)
  }
  return query
}

export async function getVisibilityScore(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ current: number | null; previous: number | null; total: number }> {
  const [cur, prev] = await Promise.all([
    applyFilters(sb.from('responses').select('clay_mentioned'), f).then((r: any) => r.data ?? []),
    applyFilters(
      sb.from('responses').select('clay_mentioned'),
      { ...f, startDate: f.prevStartDate, endDate: f.prevEndDate }
    ).then((r: any) => r.data ?? []),
  ])
  const pct = (rows: any[]) => {
    if (!rows.length) return null
    const yes = rows.filter((r: any) => r.clay_mentioned === 'Yes').length
    return (yes / rows.length) * 100
  }
  return { current: pct(cur), previous: pct(prev), total: cur.length }
}

export async function getVisibilityTimeseries(
  sb: SupabaseClient,
  f: FilterParams
): Promise<TimeseriesRow[]> {
  const { data } = await applyFilters(
    sb.from('responses').select('run_date, platform, clay_mentioned'),
    f
  )
  if (!data) return []

  // Group by date + platform
  const map = new Map<string, { total: number; mentioned: number }>()
  for (const row of data) {
    const date = row.run_date?.split('T')[0] ?? ''
    const key = `${date}|||${row.platform}`
    const cur = map.get(key) ?? { total: 0, mentioned: 0 }
    cur.total++
    if (row.clay_mentioned === 'Yes') cur.mentioned++
    map.set(key, cur)
  }

  return Array.from(map.entries()).map(([key, { total, mentioned }]) => {
    const [date, platform] = key.split('|||')
    return { date, platform, value: total > 0 ? (mentioned / total) * 100 : 0 }
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getVisibilityByTopic(
  sb: SupabaseClient,
  f: FilterParams
): Promise<TimeseriesRow[]> {
  const { data } = await applyFilters(
    sb.from('responses').select('run_date, topic, clay_mentioned'),
    f
  )
  if (!data) return []

  const map = new Map<string, { total: number; mentioned: number }>()
  for (const row of data) {
    const date = row.run_date?.split('T')[0] ?? ''
    const key = `${date}|||${row.topic ?? 'Unknown'}`
    const cur = map.get(key) ?? { total: 0, mentioned: 0 }
    cur.total++
    if (row.clay_mentioned === 'Yes') cur.mentioned++
    map.set(key, cur)
  }

  return Array.from(map.entries()).map(([key, { total, mentioned }]) => {
    const [date, topic] = key.split('|||')
    return { date, topic, value: total > 0 ? (mentioned / total) * 100 : 0 }
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getShareOfVoice(
  sb: SupabaseClient,
  f: FilterParams
): Promise<CompetitorRow[]> {
  let query = sb
    .from('response_competitors')
    .select('competitor_name, run_date, platform')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  if (f.platforms.length > 0) query = query.in('platform', f.platforms)

  const { data } = await query
  if (!data || !data.length) return []

  const counts = new Map<string, number>()
  let total = 0
  for (const row of data) {
    const name = row.competitor_name ?? ''
    counts.set(name, (counts.get(name) ?? 0) + 1)
    total++
  }

  return Array.from(counts.entries())
    .map(([competitor_name, mention_count]) => ({
      competitor_name,
      mention_count,
      sov_pct: total > 0 ? (mention_count / total) * 100 : 0,
    }))
    .sort((a, b) => b.mention_count - a.mention_count)
}

export async function getMentionShare(
  sb: SupabaseClient,
  f: FilterParams
): Promise<number | null> {
  // Clay's mentions / total competitor mentions in same responses
  const sov = await getShareOfVoice(sb, f)
  const clay = sov.find(r => r.competitor_name.toLowerCase() === 'clay')
  return clay?.sov_pct ?? null
}

export async function getAvgPosition(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ current: number | null; previous: number | null }> {
  const fetch = async (start: string, end: string) => {
    let q = sb
      .from('responses')
      .select('clay_mention_position')
      .gte('run_date', start)
      .lte('run_date', end)
      .eq('clay_mentioned', 'Yes')
      .not('clay_mention_position', 'is', null)

    if (f.platforms.length > 0) q = q.in('platform', f.platforms)
    if (f.topics.length > 0) q = q.in('topic', f.topics)
    if (f.promptType === 'benchmark') q = q.eq('prompt_type', 'benchmark')
    else if (f.promptType !== 'all') q = q.eq('tags', f.promptType)

    const { data } = await q
    if (!data?.length) return null
    const sum = data.reduce((acc, r) => acc + (r.clay_mention_position ?? 0), 0)
    return sum / data.length
  }

  const [current, previous] = await Promise.all([
    fetch(f.startDate, f.endDate),
    fetch(f.prevStartDate, f.prevEndDate),
  ])
  return { current, previous }
}

export async function getDistinctTopics(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb.from('responses').select('topic').not('topic', 'is', null)
  if (!data) return []
  return [...new Set(data.map(r => r.topic).filter(Boolean))].sort() as string[]
}

export async function getDistinctTags(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb.from('responses').select('tags').not('tags', 'is', null)
  if (!data) return []
  return [...new Set(data.map(r => r.tags).filter(Boolean))].sort() as string[]
}

export async function getLastRunDate(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb
    .from('responses')
    .select('run_date')
    .order('run_date', { ascending: false })
    .limit(1)
  return data?.[0]?.run_date ?? null
}

export async function getDataFreshnessStats(
  sb: SupabaseClient
): Promise<{ lastRunDate: string | null; promptCount: number; platformCount: number }> {
  const [dateRes, statsRes] = await Promise.all([
    sb.from('responses').select('run_date').order('run_date', { ascending: false }).limit(1),
    sb.from('responses').select('prompt_id, platform'),
  ])
  const lastRunDate = dateRes.data?.[0]?.run_date ?? null
  const promptCount = new Set(statsRes.data?.map(r => r.prompt_id)).size
  const platformCount = new Set(statsRes.data?.map(r => r.platform)).size
  return { lastRunDate, promptCount, platformCount }
}
