'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useGlobalFilters } from '@/context/GlobalFilters'
import { supabase } from '@/lib/supabase/client'
import { getDistinctTopics, getDistinctTags, getLastRunDate } from '@/lib/queries/visibility'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/formatters'

const PLATFORMS = ['ChatGPT', 'Claude']
const BRANDED_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'branded', label: 'Branded' },
  { value: 'non-branded', label: 'Non-Branded' },
]
const DATE_PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
]

const pillActive: React.CSSProperties = {
  background: 'var(--clay-black)',
  color: '#FFFFFF',
  border: '1px solid var(--clay-black)',
}
const pillInactive: React.CSSProperties = {
  background: '#FFFFFF',
  color: 'var(--clay-black)',
  border: '1px solid var(--clay-border-dashed)',
}

export default function GlobalFilterBar() {
  const { filters, setFilters, activeFilterCount, clearAll } = useGlobalFilters()
  const [topics, setTopics] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [lastRunDate, setLastRunDate] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<number>(7)

  useEffect(() => {
    Promise.all([
      getDistinctTopics(supabase),
      getDistinctTags(supabase),
      getLastRunDate(supabase),
    ]).then(([t, tg, lr]) => {
      setTopics(t)
      setTags(tg)
      setLastRunDate(lr)
    })
  }, [])

  const isStale = lastRunDate
    ? Date.now() - new Date(lastRunDate).getTime() > 24 * 60 * 60 * 1000
    : false

  function applyDatePreset(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    setDatePreset(days)
    setFilters({ dateRange: { start, end } })
  }

  function togglePlatform(p: string) {
    const current = filters.platforms
    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p]
    setFilters({ platforms: next })
  }

  function toggleTopic(t: string) {
    const current = filters.topics
    const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t]
    setFilters({ topics: next })
  }

  const pillBase = 'px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer'
  const pillRadius = { borderRadius: '99rem' }

  return (
    <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--clay-border)', background: '#FFFFFF' }}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Prompt Type */}
        <div className="flex items-center gap-1">
          {['benchmark', 'all', ...tags].map(opt => (
            <button
              key={opt}
              onClick={() => setFilters({ promptType: opt })}
              className={pillBase}
              style={{ ...(filters.promptType === opt ? pillActive : pillInactive), ...pillRadius }}
            >
              {opt === 'benchmark' ? 'Benchmark' : opt === 'all' ? 'All Prompts' : opt}
            </button>
          ))}
        </div>

        <div className="w-px h-4" style={{ background: 'var(--clay-border-dashed)' }} />

        {/* Date Range */}
        <div className="flex items-center gap-1">
          {DATE_PRESETS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => applyDatePreset(days)}
              className={pillBase}
              style={{ ...(datePreset === days ? pillActive : pillInactive), ...pillRadius }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-4" style={{ background: 'var(--clay-border-dashed)' }} />

        {/* Platform */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'rgba(26,25,21,0.4)' }}>Platform:</span>
          {PLATFORMS.map(p => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={pillBase}
              style={{ ...(filters.platforms.includes(p) ? pillActive : pillInactive), ...pillRadius }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Topics */}
        {topics.length > 0 && (
          <>
            <div className="w-px h-4" style={{ background: 'var(--clay-border-dashed)' }} />
            <div className="flex items-center gap-1 flex-wrap max-w-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'rgba(26,25,21,0.4)' }}>Topic:</span>
              {topics.slice(0, 6).map(t => (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  className={pillBase}
                  style={{ ...(filters.topics.includes(t) ? pillActive : pillInactive), ...pillRadius }}
                >
                  {t}
                </button>
              ))}
              {topics.length > 6 && (
                <span className="text-[10px] font-bold" style={{ color: 'rgba(26,25,21,0.4)' }}>+{topics.length - 6} more</span>
              )}
            </div>
          </>
        )}

        <div className="w-px h-4" style={{ background: 'var(--clay-border-dashed)' }} />

        {/* Branded */}
        <select
          value={filters.brandedFilter}
          onChange={e => setFilters({ brandedFilter: e.target.value as 'all' | 'branded' | 'non-branded' })}
          className="text-[11px] font-semibold uppercase tracking-wider px-2 py-1 focus:outline-none cursor-pointer"
          style={{
            border: '1px solid var(--clay-border-dashed)',
            borderRadius: '99rem',
            background: '#FFFFFF',
            color: 'var(--clay-black)',
          }}
        >
          {BRANDED_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-opacity hover:opacity-60"
              style={{ color: 'var(--clay-black)' }}
            >
              <X size={11} />
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active — clear all
            </button>
          )}
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(26,25,21,0.4)' }}>
            {isStale && <AlertTriangle size={11} style={{ color: 'var(--clay-tangerine)' }} />}
            <span>Updated: {lastRunDate ? formatDate(lastRunDate) : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
