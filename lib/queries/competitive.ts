// @ts-nocheck
import { SupabaseClient } from '@supabase/supabase-js'
import type { FilterParams, CompetitorRow } from './types'

export async function getWinnersAndLosers(
  sb: SupabaseClient,
  f: FilterParams
): Promise<{ competitor_name: string; current: number; previous: number | null; delta: number | null; isNew: boolean }[]> {
  const [rcCur, rcPrev, totalCur, totalPrev] = await Promise.all([
    sb.from('response_competitors')
      .select('competitor_name, response_id')
      .gte('run_date', f.startDate).lte('run_date', f.endDate),
    sb.from('response_competitors')
      .select('competitor_name, response_id')
      .gte('run_date', f.prevStartDate).lte('run_date', f.prevEndDate),
    sb.from('responses').select('id').gte('run_date', f.startDate).lte('run_date', f.endDate).then(r => r.data ?? []),
    sb.from('responses').select('id').gte('run_date', f.prevStartDate).lte('run_date', f.prevEndDate).then(r => r.data ?? []),
  ])

  const totalNow = totalCur.length
  const totalPrevCount = totalPrev.length

  const curCounts = new Map<string, Set<string>>()
  for (const r of rcCur.data ?? []) {
    if (!curCounts.has(r.competitor_name)) curCounts.set(r.competitor_name, new Set())
    curCounts.get(r.competitor_name)!.add(r.response_id)
  }

  const prevCounts = new Map<string, Set<string>>()
  for (const r of rcPrev.data ?? []) {
    if (!prevCounts.has(r.competitor_name)) prevCounts.set(r.competitor_name, new Set())
    prevCounts.get(r.competitor_name)!.add(r.response_id)
  }

  const allNames = new Set([...curCounts.keys(), ...prevCounts.keys()])

  return Array.from(allNames).map(competitor_name => {
    const curIds = curCounts.get(competitor_name)?.size ?? 0
    const prevIds = prevCounts.get(competitor_name)?.size ?? 0
    const current = totalNow > 0 ? (curIds / totalNow) * 100 : 0
    const previous = totalPrevCount > 0 ? (prevIds / totalPrevCount) * 100 : null
    const delta = previous !== null ? current - previous : null
    const isNew = (previous === null || previous === 0) && current > 0
    return { competitor_name, current, previous, delta, isNew }
  }).sort((a, b) => (b.delta ?? b.current) - (a.delta ?? a.current))
}

export async function getCompetitorByPMMTopic(
  sb: SupabaseClient,
  f: FilterParams,
  competitor: string
): Promise<{ pmm_use_case: string; visibility_score: number; mention_count: number }[]> {
  // Get response_ids where competitor is mentioned
  const { data: rcData } = await sb
    .from('response_competitors')
    .select('response_id')
    .eq('competitor_name', competitor)
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  const competitorResponseIds = new Set((rcData ?? []).map(r => r.response_id))

  // Fetch all responses in period with pmm_use_case
  const { data: allResponses } = await sb
    .from('responses')
    .select('id, pmm_use_case')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)
    .not('pmm_use_case', 'is', null)

  if (!allResponses?.length) return []

  // Build totals per pmm_use_case and competitor mentions per pmm_use_case
  const totalsMap = new Map<string, number>()
  const mentionsMap = new Map<string, number>()

  for (const r of allResponses) {
    const uc = r.pmm_use_case
    if (!uc) continue
    totalsMap.set(uc, (totalsMap.get(uc) ?? 0) + 1)
    if (competitorResponseIds.has(r.id)) {
      mentionsMap.set(uc, (mentionsMap.get(uc) ?? 0) + 1)
    }
  }

  return Array.from(totalsMap.entries()).map(([pmm_use_case, total]) => {
    const mention_count = mentionsMap.get(pmm_use_case) ?? 0
    return {
      pmm_use_case,
      visibility_score: total > 0 ? (mention_count / total) * 100 : 0,
      mention_count,
    }
  }).sort((a, b) => b.visibility_score - a.visibility_score)
}

export async function getCompetitorCoCitedDomains(
  sb: SupabaseClient,
  f: FilterParams,
  competitor: string
): Promise<{ domain: string; count: number; share_pct: number; is_own_domain: boolean }[]> {
  // Step 1: Get response_ids where competitor is mentioned
  const { data: rcData } = await sb
    .from('response_competitors')
    .select('response_id')
    .eq('competitor_name', competitor)
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  if (!rcData?.length) return []

  const responseIds = rcData.map(r => r.response_id)

  // Step 2: Batch-fetch responses (slice to first 500 for safety)
  const { data: responses } = await sb
    .from('responses')
    .select('id, cited_domains')
    .in('id', responseIds.slice(0, 500))

  if (!responses?.length) return []

  // Step 3: Parse cited_domains JSON array and aggregate domain counts
  const domainCounts = new Map<string, number>()
  let responsesWithCitations = 0

  for (const r of responses) {
    if (!r.cited_domains) continue
    let domains: string[] = []
    try {
      domains = Array.isArray(r.cited_domains) ? r.cited_domains : JSON.parse(r.cited_domains)
    } catch { continue }
    if (!domains.length) continue
    responsesWithCitations++
    for (const d of domains) {
      if (typeof d !== 'string' || !d) continue
      domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1)
    }
  }

  if (!domainCounts.size) return []

  // Step 4: Detect competitor's own domain
  const competitorSlug = competitor.toLowerCase().split(/[\s.]/)[0]

  return Array.from(domainCounts.entries())
    .map(([domain, count]) => ({
      domain,
      count,
      share_pct: responsesWithCitations > 0 ? (count / responsesWithCitations) * 100 : 0,
      is_own_domain: domain.toLowerCase().includes(competitorSlug),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
}

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
): Promise<{ visibilityScore: number | null; mentionCount: number; avgPosition: number | null; topTopic: string | null; topPlatform: string | null; deltaVisibility: number | null }> {
  const [rcRes, totalRes, prevRcRes, prevTotalRes] = await Promise.all([
    sb.from('response_competitors')
      .select('response_id, platform, topic')
      .eq('competitor_name', competitor)
      .gte('run_date', f.startDate)
      .lte('run_date', f.endDate),
    sb.from('responses').select('id').gte('run_date', f.startDate).lte('run_date', f.endDate),
    sb.from('response_competitors')
      .select('response_id')
      .eq('competitor_name', competitor)
      .gte('run_date', f.prevStartDate)
      .lte('run_date', f.prevEndDate),
    sb.from('responses').select('id').gte('run_date', f.prevStartDate).lte('run_date', f.prevEndDate),
  ])

  const rcData = rcRes.data ?? []
  const total = totalRes.data ?? []
  const prevRcData = prevRcRes.data ?? []
  const prevTotal = prevTotalRes.data ?? []

  if (!rcData.length) return { visibilityScore: null, mentionCount: 0, avgPosition: null, topTopic: null, topPlatform: null, deltaVisibility: null }

  const topicMap = new Map<string, number>()
  const platformMap = new Map<string, number>()
  for (const r of rcData) {
    if (r.topic) topicMap.set(r.topic, (topicMap.get(r.topic) ?? 0) + 1)
    if (r.platform) platformMap.set(r.platform, (platformMap.get(r.platform) ?? 0) + 1)
  }

  const topTopic = [...topicMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topPlatform = [...platformMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const currentVis = total.length ? (rcData.length / total.length) * 100 : null
  const prevVis = prevTotal.length ? (prevRcData.length / prevTotal.length) * 100 : null
  const deltaVisibility = currentVis !== null && prevVis !== null ? currentVis - prevVis : null

  return {
    visibilityScore: currentVis,
    mentionCount: rcData.length,
    avgPosition: null, // positions tracked for Clay only
    topTopic,
    topPlatform,
    deltaVisibility,
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
