// @ts-nocheck
import { SupabaseClient } from '@supabase/supabase-js'
import type { FilterParams, CompetitorRow } from './types'

export async function getCompetitorList(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb
    .from('response_competitors')
    .select('competitor_name')
    .not('competitor_name', 'is', null)
  if (!data) return []
  return [...new Set(data.map(r => r.competitor_name))].sort() as string[]
}

export async function getCompetitorKPIs(
  sb: SupabaseClient,
  f: FilterParams,
  competitor: string
): Promise<{ visibilityScore: number | null; mentionCount: number; avgPosition: number | null; topTopic: string | null; topPlatform: string | null }> {
  const { data: rcData } = await sb
    .from('response_competitors')
    .select('response_id, platform, topic')
    .eq('competitor_name', competitor)
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  if (!rcData?.length) return { visibilityScore: null, mentionCount: 0, avgPosition: null, topTopic: null, topPlatform: null }

  // Total responses for visibility denominator
  const { data: total } = await sb
    .from('responses')
    .select('id')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  const topicMap = new Map<string, number>()
  const platformMap = new Map<string, number>()
  for (const r of rcData) {
    if (r.topic) topicMap.set(r.topic, (topicMap.get(r.topic) ?? 0) + 1)
    if (r.platform) platformMap.set(r.platform, (platformMap.get(r.platform) ?? 0) + 1)
  }

  const topTopic = [...topicMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topPlatform = [...platformMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    visibilityScore: total?.length ? (rcData.length / total.length) * 100 : null,
    mentionCount: rcData.length,
    avgPosition: null, // positions tracked for Clay only
    topTopic,
    topPlatform,
  }
}

export async function getPlatformHeatmap(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ competitor: string; platform: string; visibility_score: number }[]> {
  const [rcRes, totalRes] = await Promise.all([
    sb.from('response_competitors')
      .select('competitor_name, platform')
      .gte('run_date', f.startDate)
      .lte('run_date', f.endDate),
    sb.from('responses')
      .select('platform')
      .gte('run_date', f.startDate)
      .lte('run_date', f.endDate),
  ])

  const rc = rcRes.data ?? []
  const totals = new Map<string, number>()
  for (const r of totalRes.data ?? []) {
    totals.set(r.platform, (totals.get(r.platform) ?? 0) + 1)
  }

  const map = new Map<string, number>()
  for (const r of rc) {
    const key = `${r.competitor_name}|||${r.platform}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  return Array.from(map.entries()).map(([key, count]) => {
    const [competitor, platform] = key.split('|||')
    return {
      competitor,
      platform,
      visibility_score: totals.get(platform) ? (count / totals.get(platform)!) * 100 : 0,
    }
  })
}

export async function getCompetitorVsClayTimeseries(
  sb: SupabaseClient,
  f: FilterParams,
  competitor: string
): Promise<{ date: string; clay: number; competitor: number }[]> {
  const [rcData, clayData] = await Promise.all([
    sb.from('response_competitors')
      .select('run_date, response_id')
      .eq('competitor_name', competitor)
      .gte('run_date', f.startDate)
      .lte('run_date', f.endDate),
    sb.from('responses')
      .select('run_date, clay_mentioned')
      .gte('run_date', f.startDate)
      .lte('run_date', f.endDate),
  ])

  const compByDate = new Map<string, number>()
  for (const r of rcData.data ?? []) {
    const d = r.run_date?.split('T')[0] ?? ''
    compByDate.set(d, (compByDate.get(d) ?? 0) + 1)
  }

  const clayByDate = new Map<string, { total: number; yes: number }>()
  for (const r of clayData.data ?? []) {
    const d = r.run_date?.split('T')[0] ?? ''
    const cur = clayByDate.get(d) ?? { total: 0, yes: 0 }
    cur.total++
    if (r.clay_mentioned === 'Yes') cur.yes++
    clayByDate.set(d, cur)
  }

  const allDates = new Set([...compByDate.keys(), ...clayByDate.keys()])
  return Array.from(allDates).sort().map(date => {
    const totalForDate = clayByDate.get(date)?.total ?? 0
    const clayScore = totalForDate > 0 ? ((clayByDate.get(date)?.yes ?? 0) / totalForDate) * 100 : 0
    const compScore = totalForDate > 0 ? ((compByDate.get(date) ?? 0) / totalForDate) * 100 : 0
    return { date, clay: clayScore, competitor: compScore }
  })
}

export async function getClaygentMcpStats(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{
  rate: number | null
  byPlatform: { platform: string; rate: number }[]
  byTopic: { topic: string; rate: number }[]
  snippets: { platform: string; topic: string; snippet: string; prompt_text: string; run_date: string }[]
}> {
  const { data } = await sb
    .from('responses')
    .select('claygent_or_mcp_mentioned, clay_followup_snippet, platform, topic, run_date')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  if (!data?.length) return { rate: null, byPlatform: [], byTopic: [], snippets: [] }

  const overall = data.filter(r => r.claygent_or_mcp_mentioned === 'Yes').length
  const rate = (overall / data.length) * 100

  const platformMap = new Map<string, { yes: number; total: number }>()
  const topicMap = new Map<string, { yes: number; total: number }>()

  for (const r of data) {
    const p = r.platform ?? ''
    const t = r.topic ?? 'Unknown'
    const pc = platformMap.get(p) ?? { yes: 0, total: 0 }
    const tc = topicMap.get(t) ?? { yes: 0, total: 0 }
    pc.total++; tc.total++
    if (r.claygent_or_mcp_mentioned === 'Yes') { pc.yes++; tc.yes++ }
    platformMap.set(p, pc)
    topicMap.set(t, tc)
  }

  return {
    rate,
    byPlatform: [...platformMap.entries()].map(([platform, { yes, total }]) => ({
      platform, rate: total > 0 ? (yes / total) * 100 : 0,
    })),
    byTopic: [...topicMap.entries()].map(([topic, { yes, total }]) => ({
      topic, rate: total > 0 ? (yes / total) * 100 : 0,
    })),
    snippets: data
      .filter(r => r.claygent_or_mcp_mentioned === 'Yes' && r.clay_followup_snippet)
      .slice(0, 20)
      .map(r => ({
        platform: r.platform,
        topic: r.topic ?? 'Unknown',
        snippet: r.clay_followup_snippet,
        prompt_text: '',
        run_date: r.run_date?.split('T')[0] ?? '',
      })),
  }
}
