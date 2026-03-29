import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Provider = 'chatgpt' | 'claude' | 'gemini' | 'perplexity'

export const PROVIDERS: { id: Provider; label: string; color: string }[] = [
  { id: 'chatgpt',    label: 'ChatGPT',    color: '#10a37f' },
  { id: 'claude',     label: 'Claude',     color: '#d97706' },
  { id: 'gemini',     label: 'Gemini',     color: '#4285f4' },
  { id: 'perplexity', label: 'Perplexity', color: '#7c3aed' },
]

export interface Prompt {
  id: string
  prompt_text: string
  category: string | null
  subcategory: string | null
  topic: string | null
  modifier: string | null
  use_case: string | null
  created_at: string
}

export interface Response {
  id: string
  prompt_id: string
  provider: Provider
  run_date: string
  response_text: string | null
  clay_mentioned: boolean
  clay_rank: number | null
  clay_sentiment: string | null
  clay_cited: boolean
  citation_count: number
  brands_mentioned: string[] | null
  raw_json: Record<string, unknown> | null
  created_at: string
}
