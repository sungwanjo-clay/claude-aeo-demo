import { SupabaseClient } from '@supabase/supabase-js'
import type { FilterParams } from './types'

export interface PromptRow {
  prompt_id: string
  prompt_text: string
  topic: string | null
  intent: string | null
  pmm_use_case: string | null
  pmm_classification: string | null
  prompt_type: string | null
  tags: string | null
  branded_or_non_branded: string | null
  is_active: boolean
  last_seen_at: string | null
  responses: ResponseRow[]
}

export interface ResponseRow {
  id: string
  platform: string
  run_date: string
  clay_mentioned: string | null
  clay_mention_snippet: string | null
  brand_sentiment: string | null
  brand_sentiment_score: number | null
  competitors_mentioned: string[] | null
  cited_domains: string[] | null
  themes: { theme: string; sentiment: string; snippet: string }[] | null
  primary_use_case_attributed: string | null
  positioning_vs_competitors: string | null
  response_text: string | null
  clay_mention_position: number | null
  claygent_or_mcp_mentioned: string | null
}

export async function getPromptsWithResponses(
  sb: SupabaseClient,
  f: FilterParams,
  showInactive = false
): Promise<PromptRow[]> {
  let rQuery = sb
    .from('responses')
    .select('*')
    .gte('run_date', f.startDate)
    .lte('run_date', f.endDate)

  if (f.platforms.length > 0) rQuery = rQuery.in('platform', f.platforms)
  if (f.topics.length > 0) rQuery = rQuery.in('topic', f.topics)
  if (f.promptType === 'benchmark') rQuery = rQuery.eq('prompt_type', 'benchmark')
  else if (f.promptType !== 'all') rQuery = rQuery.eq('tags', f.promptType)
  if (f.brandedFilter !== 'all') {
    const val = f.brandedFilter === 'branded' ? 'Branded' : 'Non-Branded'
    rQuery = rQuery.eq('branded_or_non_branded', val)
  }

  const { data: responses } = await rQuery
  if (!responses?.length) return []

  const promptIds = [...new Set(responses.map(r => r.prompt_id))]
  let promptQuery = sb
    .from('prompts')
    .select('*')
    .in('prompt_id', promptIds)

  // By default, only return active prompts unless explicitly showing inactive
  if (!showInactive) {
    promptQuery = promptQuery.eq('is_active', true)
  }

  const { data: prompts } = await promptQuery
  if (!prompts) return []

  const responsesByPrompt = new Map<string, ResponseRow[]>()
  for (const r of responses) {
    const arr = responsesByPrompt.get(r.prompt_id) ?? []
    arr.push({
      id: r.id,
      platform: r.platform,
      run_date: r.run_date,
      clay_mentioned: r.clay_mentioned,
      clay_mention_snippet: r.clay_mention_snippet,
      brand_sentiment: r.brand_sentiment,
      brand_sentiment_score: r.brand_sentiment_score,
      competitors_mentioned: Array.isArray(r.competitors_mentioned)
        ? r.competitors_mentioned
        : tryParse(r.competitors_mentioned),
      cited_domains: Array.isArray(r.cited_domains)
        ? r.cited_domains
        : tryParse(r.cited_domains),
      themes: Array.isArray(r.themes) ? r.themes : tryParse(r.themes),
      primary_use_case_attributed: r.primary_use_case_attributed,
      positioning_vs_competitors: r.positioning_vs_competitors,
      response_text: r.response_text,
      clay_mention_position: r.clay_mention_position,
      claygent_or_mcp_mentioned: r.claygent_or_mcp_mentioned,
    })
    responsesByPrompt.set(r.prompt_id, arr)
  }

  return prompts.map(p => ({
    prompt_id: p.prompt_id,
    prompt_text: p.prompt_text,
    topic: p.topic,
    intent: p.intent,
    pmm_use_case: p.pmm_use_case,
    pmm_classification: p.pmm_classification,
    prompt_type: p.prompt_type,
    tags: p.tags,
    branded_or_non_branded: p.branded_or_non_branded,
    is_active: p.is_active ?? true,
    last_seen_at: p.last_seen_at ?? null,
    responses: responsesByPrompt.get(p.prompt_id) ?? [],
  }))
}

function tryParse<T>(val: unknown): T | null {
  if (val == null) return null
  if (typeof val !== 'string') return null
  try { return JSON.parse(val) } catch { return null }
}

export async function getPromptStats(
  sb: SupabaseClient
): Promise<{ total: number; benchmark: number; campaign: number; inactive: number }> {
  const { data } = await sb.from('prompts').select('prompt_type, tags, is_active')
  if (!data) return { total: 0, benchmark: 0, campaign: 0, inactive: 0 }
  const active = data.filter(p => p.is_active !== false)
  return {
    total: active.length,
    benchmark: active.filter(p => p.prompt_type === 'benchmark').length,
    campaign: active.filter(p => p.tags && p.prompt_type !== 'benchmark').length,
    inactive: data.filter(p => p.is_active === false).length,
  }
}
