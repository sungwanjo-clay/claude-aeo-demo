'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getPlatformColor } from '@/lib/utils/colors'
import type { SentimentVsClayData, SentimentCoMentionSnippet } from '@/lib/queries/competitive'

const LABEL = {
  color: 'rgba(26,25,21,0.45)',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1').replace(/#+\s+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*>]\s+/gm, '').replace(/\|\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

function sentimentColor(s: string | null) {
  if (s === 'Positive') return { bg: 'rgba(200,240,64,0.2)', text: 'var(--clay-black)', border: 'rgba(200,240,64,0.5)' }
  if (s === 'Negative') return { bg: 'rgba(229,54,42,0.1)', text: 'var(--clay-pomegranate)', border: 'rgba(229,54,42,0.3)' }
  return { bg: 'rgba(26,25,21,0.06)', text: 'rgba(26,25,21,0.55)', border: 'rgba(26,25,21,0.15)' }
}

// ── Stacked sentiment bar ─────────────────────────────────────────────────────
function SentimentBar({ pos, neu, neg }: { pos: number; neu: number; neg: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden flex" style={{ height: '8px', background: 'rgba(26,25,21,0.06)' }}>
      <div style={{ width: `${pos}%`, background: '#C8F040', transition: 'width 0.4s' }} />
      <div style={{ width: `${neu}%`, background: 'rgba(26,25,21,0.2)', transition: 'width 0.4s' }} />
      <div style={{ width: `${neg}%`, background: 'var(--clay-pomegranate)', transition: 'width 0.4s', opacity: 0.7 }} />
    </div>
  )
}

// ── Full response expandable block ────────────────────────────────────────────
function FullResponseBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const cleaned = stripMarkdown(text)
  const preview = cleaned.slice(0, 200)
  const hasMore = cleaned.length > 200

  return (
    <div className="rounded-lg px-3 py-2.5 mt-2"
      style={{ background: 'rgba(26,25,21,0.03)', border: '1px solid rgba(26,25,21,0.07)' }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: 'rgba(26,25,21,0.45)' }}>Full AI Response</p>
      <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(26,25,21,0.75)' }}>
        {open ? cleaned : preview}{!open && hasMore ? '…' : ''}
      </p>
      {hasMore && (
        <button
          onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          className="mt-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
          style={{ color: 'rgba(26,25,21,0.45)' }}
        >
          {open ? 'Show less ↑' : 'Show full response ↓'}
        </button>
      )}
    </div>
  )
}

// ── Single co-mention snippet card ────────────────────────────────────────────
function SnippetCard({ s }: { s: SentimentCoMentionSnippet }) {
  const [open, setOpen] = useState(false)
  const colors = sentimentColor(s.brand_sentiment)
  const hasDetail = !!(s.clay_mention_snippet || s.positioning_vs_competitors || s.response_text)

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${colors.border}`, background: colors.bg }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => hasDetail && setOpen(v => !v)}
      >
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-center shrink-0"
          style={{ background: getPlatformColor(s.platform) + '20', color: getPlatformColor(s.platform) }}>
          {s.platform}
        </span>
        <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'rgba(26,25,21,0.5)' }}>{s.run_date}</span>
        {s.brand_sentiment && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
            Clay: {s.brand_sentiment}
          </span>
        )}
        {s.brand_sentiment_score != null && (
          <span className="text-[11px] font-bold tabular-nums shrink-0"
            style={{ color: 'rgba(26,25,21,0.45)' }}>
            {s.brand_sentiment_score.toFixed(1)}/10
          </span>
        )}
        <div className="flex-1" />
        {hasDetail && (
          open
            ? <ChevronDown size={10} style={{ color: 'rgba(26,25,21,0.35)', flexShrink: 0 }} />
            : <ChevronRight size={10} style={{ color: 'rgba(26,25,21,0.35)', flexShrink: 0 }} />
        )}
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${colors.border}` }}>
          {/* Positioning vs competitors */}
          {s.positioning_vs_competitors && (
            <div className="rounded px-2.5 py-2 mt-2"
              style={{ background: 'rgba(74,90,255,0.06)', border: '1px solid rgba(74,90,255,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: '#4A5AFF', opacity: 0.7 }}>Positioning vs Competitors</p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--clay-black)' }}>
                {stripMarkdown(s.positioning_vs_competitors)}
              </p>
            </div>
          )}

          {/* Clay mention snippet */}
          {s.clay_mention_snippet && (
            <div className="rounded px-2.5 py-2"
              style={{ background: 'rgba(200,240,64,0.1)', border: '1px solid rgba(200,240,64,0.3)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: 'rgba(26,25,21,0.45)' }}>Clay mention snippet</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--clay-black)' }}>
                &ldquo;{stripMarkdown(s.clay_mention_snippet)}&rdquo;
              </p>
            </div>
          )}

          {/* Full response */}
          {s.response_text && <FullResponseBlock text={s.response_text} />}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  data: SentimentVsClayData | null
  selected: string
  loading: boolean
}

export default function CompSentimentVsClay({ data, selected, loading }: Props) {
  const [showAll, setShowAll] = useState(false)
  const CARD = { background: '#FFFFFF', border: '1px solid var(--clay-border)', borderRadius: '8px' }
  const isClay = selected === 'Clay'

  const heading = isClay
    ? 'Clay Sentiment Profile'
    : `Sentiment — Clay vs ${selected}`
  const subtitle = isClay
    ? 'How AI models talk about Clay: sentiment breakdown across all mentions.'
    : `Clay's sentiment in the ${data?.coMentionCount?.toLocaleString() ?? '…'} responses where both Clay and ${selected} were mentioned together.`

  if (loading) {
    return (
      <div style={CARD} className="p-4">
        <div style={LABEL} className="mb-1">{heading}</div>
        <div className="animate-pulse space-y-3 mt-4">
          <div className="h-4 rounded" style={{ background: 'rgba(26,25,21,0.06)', width: '60%' }} />
          <div className="h-8 rounded" style={{ background: 'rgba(26,25,21,0.06)' }} />
          <div className="h-24 rounded" style={{ background: 'rgba(26,25,21,0.06)' }} />
        </div>
      </div>
    )
  }

  if (!data || data.coMentionCount === 0) {
    return (
      <div style={CARD} className="p-4">
        <div style={LABEL} className="mb-1">{heading}</div>
        <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>{subtitle}</p>
        <div className="flex items-center justify-center py-10 text-[13px]" style={{ color: 'rgba(26,25,21,0.35)' }}>
          {isClay ? 'No sentiment data available' : `No responses found where both Clay and ${selected} were mentioned`}
        </div>
      </div>
    )
  }

  const visibleSnippets = showAll ? data.snippets : data.snippets.slice(0, 10)

  return (
    <div style={CARD} className="p-4">
      <div style={LABEL} className="mb-1">{heading}</div>
      <p className="text-xs mb-4" style={{ color: 'rgba(26,25,21,0.45)' }}>{subtitle}</p>

      {/* Summary stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg p-3" style={{ background: 'rgba(26,25,21,0.03)', border: '1px solid rgba(26,25,21,0.07)' }}>
          <div style={LABEL}>{isClay ? 'Mentions' : 'Co-mentions'}</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--clay-black)', letterSpacing: '-0.02em' }}>
            {data.coMentionCount.toLocaleString()}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(26,25,21,0.4)' }}>
            {isClay ? 'responses' : 'both mentioned'}
          </div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(200,240,64,0.12)', border: '1px solid rgba(200,240,64,0.35)' }}>
          <div style={LABEL}>Positive</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--clay-black)', letterSpacing: '-0.02em' }}>
            {data.clayPositivePct.toFixed(1)}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(26,25,21,0.4)' }}>of Clay mentions</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(26,25,21,0.03)', border: '1px solid rgba(26,25,21,0.07)' }}>
          <div style={LABEL}>Neutral</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--clay-black)', letterSpacing: '-0.02em' }}>
            {data.clayNeutralPct.toFixed(1)}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(26,25,21,0.4)' }}>of Clay mentions</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'rgba(229,54,42,0.06)', border: '1px solid rgba(229,54,42,0.2)' }}>
          <div style={LABEL}>Negative</div>
          <div className="text-xl font-bold mt-1" style={{ color: 'var(--clay-pomegranate)', letterSpacing: '-0.02em' }}>
            {data.clayNegativePct.toFixed(1)}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(26,25,21,0.4)' }}>of Clay mentions</div>
        </div>
      </div>

      {/* Sentiment bar */}
      <div className="mb-1">
        <SentimentBar
          pos={data.clayPositivePct}
          neu={data.clayNeutralPct}
          neg={data.clayNegativePct}
        />
      </div>
      <div className="flex gap-4 mb-5">
        {[
          { label: 'Positive', color: '#C8F040', pct: data.clayPositivePct },
          { label: 'Neutral', color: 'rgba(26,25,21,0.3)', pct: data.clayNeutralPct },
          { label: 'Negative', color: 'var(--clay-pomegranate)', pct: data.clayNegativePct },
        ].map(({ label, color, pct }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[11px]" style={{ color: 'rgba(26,25,21,0.55)' }}>{label} {pct.toFixed(0)}%</span>
          </div>
        ))}
        {data.clayAvgScore != null && (
          <div className="ml-auto">
            <span className="text-[11px] font-bold" style={{ color: 'rgba(26,25,21,0.55)' }}>
              Avg score: <span style={{ color: 'var(--clay-black)' }}>{data.clayAvgScore.toFixed(1)}/10</span>
            </span>
          </div>
        )}
      </div>

      {/* Snippet list */}
      {data.snippets.length > 0 && (
        <>
          <div style={LABEL} className="mb-2">
            {isClay ? 'Mentions with context' : `Positioning snippets — how Clay appears when ${selected} is also present`}
          </div>
          <div className="space-y-2">
            {visibleSnippets.map(s => <SnippetCard key={s.id} s={s} />)}
          </div>
          {data.snippets.length > 10 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full mt-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
              style={{ borderTop: '1px solid rgba(26,25,21,0.06)', color: 'rgba(26,25,21,0.4)' }}
            >
              {showAll ? 'Show top 10 ↑' : `Show all ${data.snippets.length} responses ↓`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
